# Khử nhiễu ảnh bake (blender/bake/*.png) -> blender/bake_dn/*.jpg
import cv2, glob, os
SRC = os.path.join(os.path.dirname(__file__), "bake")
DST = os.path.join(os.path.dirname(__file__), "bake_dn")
os.makedirs(DST, exist_ok=True)
for p in sorted(glob.glob(os.path.join(SRC, "*.png"))):
    im = cv2.imread(p)
    dn = cv2.fastNlMeansDenoisingColored(im, None, h=5, hColor=5, templateWindowSize=7, searchWindowSize=21)
    out = os.path.join(DST, os.path.basename(p)[:-4] + ".jpg")
    cv2.imwrite(out, dn, [cv2.IMWRITE_JPEG_QUALITY, 90])
    print(os.path.basename(out), im.shape[1], "x", im.shape[0])
