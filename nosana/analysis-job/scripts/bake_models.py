# Build-stage only (spec §8.1): downloads the pose models into the image's
# rtmlib cache (~/.cache/rtmlib/hub) and proves the ONNX sessions load, so job
# runtime never downloads anything. 'performance' mode = YOLOX-m person
# detector (640x640) + RTMW-x-l wholebody 133-kpt (288x384) — the runtime
# pipeline must construct Wholebody with the same mode or the cache misses.
# CPU provider here: build machines have no GPU; the weights are identical.
from rtmlib import Wholebody

if __name__ == '__main__':
    Wholebody(mode='performance', backend='onnxruntime', device='cpu')
    print('pose models baked and load-checked')
