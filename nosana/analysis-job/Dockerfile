# CUDA runtime base, Python 3.11, no PyTorch (spec §8.1) — pose inference is
# rtmlib (YOLOX + RTMW) on onnxruntime-gpu; the LLM stage (llama.cpp + Qwen
# GGUF) is baked in later, M2.12. The cudnn variant ships cuDNN 9 system-wide,
# which ORT's CUDA provider dlopens — the pip nvidia-cudnn wheel lands in
# site-packages where ORT does not look on Linux.
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Ubuntu 22.04 ships Python 3.10; deadsnakes gets us 3.11.
RUN apt-get update && apt-get install -y --no-install-recommends \
        software-properties-common \
    && add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get update && apt-get install -y --no-install-recommends \
        python3.11 \
        python3.11-venv \
        ffmpeg \
        libglib2.0-0 \
        ca-certificates \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && python3.11 -m ensurepip --upgrade \
    && apt-get purge -y software-properties-common \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# onnxruntime-gpu and rtmlib's declared dependency both install as the same
# `onnxruntime` package name — installing both the GPU and CPU wheels in one
# env clobbers each other's files. Install onnxruntime-gpu first, then rtmlib
# with --no-deps so pip never resolves the plain `onnxruntime` package (same
# reasoning applies to opencv-python vs opencv-contrib-python-headless, hence
# rtmlib's other deps are pinned separately in requirements.txt, not resolved
# from its own metadata).
RUN python3.11 -m pip install --no-cache-dir "onnxruntime-gpu==1.26.0" \
    && python3.11 -m pip install --no-cache-dir --no-deps rtmlib==0.0.15 \
    && python3.11 -m pip install --no-cache-dir -r requirements.txt

# Bake pose models into the image (spec §8.1: never downloaded at job
# runtime). Separate layer, before src/, so pipeline-code changes don't
# re-download ~600 MB of weights.
COPY scripts/bake_models.py scripts/
RUN python3.11 scripts/bake_models.py

COPY src/ src/

ENTRYPOINT ["python3.11", "src/main.py"]
