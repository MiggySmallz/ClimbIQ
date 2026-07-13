# Analysis job container

One image, one op, one GPU rental per video (spec §8.1). CUDA 12.4 runtime,
Python 3.11, no PyTorch — pose inference is rtmlib on `onnxruntime-gpu`.

## Build & run

```sh
docker build -t climbiq-analysis-job .
docker run --rm --gpus all climbiq-analysis-job   # entrypoint contract lands in M2.5
```

## Baked pose models (M2.4)

`scripts/bake_models.py` runs at build time and populates the rtmlib cache
(`/root/.cache/rtmlib/hub/checkpoints/`), so a job never downloads weights:

| Role | Model | Input |
| --- | --- | --- |
| Person detector | YOLOX-m (HumanArt) | 640×640 |
| Wholebody pose (133 kpts) | RTMW-x-l SimCC cocktail14 | 288×384 |

This is rtmlib `Wholebody(mode='performance')` — the runtime pipeline must
construct `Wholebody` with the same mode or the cache misses and the job
tries to download at runtime.

**Fallback (spec §8.1):** if RTMW underperforms on climbing footage, switch to
DWPose — in rtmlib that's the `Wholebody` legacy DWPose checkpoints
(`dwpose-l` ONNX, same 133-keypoint format, so the feature-extraction code is
unchanged). Swap the model URL/mode in `scripts/bake_models.py` and the
pipeline's `Wholebody(...)` call together.

## Layer ordering

The Dockerfile keeps three expensive layers independent so iteration stays
cheap: pip deps → baked models (~600 MB) → `src/` (pipeline code). Editing
pipeline code rebuilds only the last layer; LLM weights (M2.12) will get
their own layer too.
