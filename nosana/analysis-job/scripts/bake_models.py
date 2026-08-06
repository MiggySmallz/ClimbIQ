# Build-stage only: downloads the pose models into the image's rtmlib cache and
# proves the ONNX sessions load, so job runtime never downloads anything. The
# runtime pipeline must construct Wholebody with the same 'performance' mode or
# the cache misses. CPU provider here (build machines have no GPU); the weights
# are identical.
from rtmlib import Wholebody

if __name__ == '__main__':
    Wholebody(mode='performance', backend='onnxruntime', device='cpu')
    print('pose models baked and load-checked')
