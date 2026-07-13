# LLM stage (spec §8.1): one Qwen3.6-27B call through a llama.cpp server
# started once per job (models load once, spec §3). The model VERIFIES
# rule-detected issues against evidence images and writes coaching — it never
# decides what was detected (spec §3). Structured output is parsed and
# validated strictly; an unusable response fails the stage (job-level retries
# handle transient flakiness, spec §8.3).
import base64
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from evidence import EvidenceImage

PROMPT_FILE = Path(__file__).parent.parent / 'prompts' / 'coaching_v1.md'
TEMPERATURE = 0.4
MAX_TOKENS = 800
SERVER_PORT = 8090
SERVER_STARTUP_TIMEOUT_S = 180  # 17 GB model load from a cold page cache is slow
REQUEST_TIMEOUT_S = 300
CTX_SIZE = 8192


class LlmError(Exception):
    pass


@dataclass
class CoachingOutput:
    verified: dict[str, bool]   # issue key → verified
    drills: dict[str, str]      # issue key → drill
    grade_estimate: str | None
    coaching_text: str


def _load_prompt() -> tuple[str, str]:
    text = PROMPT_FILE.read_text(encoding='utf-8')
    try:
        _, rest = text.split('---SYSTEM---', 1)
        system, user = rest.split('---USER---', 1)
    except ValueError as e:
        raise LlmError(f'malformed prompt template {PROMPT_FILE.name}') from e
    return system.strip(), user.strip()


class LlamaServer:
    """llama-server subprocess with the Qwen GGUF + vision projector."""

    def __init__(self):
        self._bin = os.environ.get('LLAMA_SERVER_BIN', '/opt/llama/llama-server')
        self._model = os.environ.get('MODEL_GGUF', '/models/Qwen3.6-27B-Q4_K_M.gguf')
        self._mmproj = os.environ.get('MMPROJ_GGUF', '/models/mmproj-F16.gguf')
        self._proc: subprocess.Popen | None = None

    def __enter__(self) -> 'LlamaServer':
        self._proc = subprocess.Popen(
            [
                self._bin,
                '--model', self._model,
                '--mmproj', self._mmproj,
                '--port', str(SERVER_PORT),
                '--host', '127.0.0.1',
                '--ctx-size', str(CTX_SIZE),
                '--n-gpu-layers', '999',
                '--no-webui',
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + SERVER_STARTUP_TIMEOUT_S
        while time.monotonic() < deadline:
            if self._proc.poll() is not None:
                raise LlmError(f'llama-server exited {self._proc.returncode} during startup')
            try:
                with urllib.request.urlopen(
                    f'http://127.0.0.1:{SERVER_PORT}/health', timeout=5
                ) as resp:
                    if resp.status == 200:
                        return self
            except (urllib.error.URLError, OSError):
                pass
            time.sleep(2)
        raise LlmError('llama-server did not become healthy in time')

    def __exit__(self, *exc) -> None:
        if self._proc is not None and self._proc.poll() is None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                self._proc.kill()

    def chat(self, messages: list[dict]) -> str:
        body = json.dumps({
            'messages': messages,
            'temperature': TEMPERATURE,
            'max_tokens': MAX_TOKENS,
            'response_format': {'type': 'json_object'},
        }).encode()
        req = urllib.request.Request(
            f'http://127.0.0.1:{SERVER_PORT}/v1/chat/completions',
            data=body,
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as resp:
                payload = json.loads(resp.read())
        except (urllib.error.URLError, OSError, json.JSONDecodeError) as e:
            raise LlmError(f'chat completion request failed: {e}') from e
        try:
            return payload['choices'][0]['message']['content']
        except (KeyError, IndexError) as e:
            raise LlmError('chat completion response missing content') from e


def _build_messages(context: dict, images: list[EvidenceImage]) -> list[dict]:
    system, user = _load_prompt()
    captions = '\n'.join(f'{i + 1}. {img.caption}' for i, img in enumerate(images))
    user = user.replace('{{LLM_CONTEXT_JSON}}', json.dumps(context, indent=1))
    user = user.replace('{{IMAGE_CAPTIONS}}', captions)
    content: list[dict] = [{'type': 'text', 'text': user}]
    for img in images:
        b64 = base64.b64encode(img.path.read_bytes()).decode()
        content.append({
            'type': 'image_url',
            'image_url': {'url': f'data:image/jpeg;base64,{b64}'},
        })
    return [
        {'role': 'system', 'content': system},
        {'role': 'user', 'content': content},
    ]


def _parse_output(raw: str, expected_keys: list[str]) -> CoachingOutput:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise LlmError(f'model output is not valid JSON: {e}') from e
    if not isinstance(data, dict):
        raise LlmError('model output is not a JSON object')

    issues = data.get('issues')
    if not isinstance(issues, list):
        raise LlmError('model output missing "issues" array')
    verified: dict[str, bool] = {}
    drills: dict[str, str] = {}
    for item in issues:
        if not isinstance(item, dict):
            raise LlmError('model output issue entry is not an object')
        key = item.get('key')
        if key not in expected_keys:
            continue  # hallucinated key — drop rather than fail
        verified[key] = bool(item.get('verified', False))
        drill = item.get('drill')
        if isinstance(drill, str) and drill.strip():
            drills[key] = drill.strip()
    missing = [k for k in expected_keys if k not in verified]
    if missing:
        raise LlmError(f'model output missing issue keys: {missing}')

    coaching = data.get('coaching_text')
    if not isinstance(coaching, str) or not coaching.strip():
        raise LlmError('model output missing coaching_text')

    grade = data.get('grade_estimate')
    if grade is not None and not isinstance(grade, str):
        grade = None

    return CoachingOutput(
        verified=verified,
        drills=drills,
        grade_estimate=grade,
        coaching_text=coaching.strip(),
    )


def run_coaching(context: dict, images: list[EvidenceImage]) -> CoachingOutput:
    expected = [i['key'] for i in context['issues']]
    messages = _build_messages(context, images)
    with LlamaServer() as server:
        raw = server.chat(messages)
    return _parse_output(raw, expected)
