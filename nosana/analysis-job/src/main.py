# Placeholder entrypoint — proves the image's dependencies import and load
# correctly. Replaced by the real env-var-driven pipeline entrypoint in M2.5.
from importlib.metadata import version

import cv2
import onnxruntime
from rtmlib import Wholebody  # noqa: F401 — import check only

if __name__ == '__main__':
    print(f'onnxruntime {onnxruntime.__version__}, providers: {onnxruntime.get_available_providers()}')
    print(f'opencv {cv2.__version__}')
    print(f'rtmlib {version("rtmlib")}')
