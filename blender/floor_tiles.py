"""Vân sàn phòng trưng bày: sàn nhựa ghép (tấm 50 × 50 cm, mép răng khoá vào nhau, mặt có hạt nổi) màu xám, khu giữa
quanh bục màu xanh dương. Ghi ra blender/tex/floor.png (ảnh phủ cả sàn 7 × 6,5 m; hàng trên cùng = tường trong).

Chạy:  python blender/floor_tiles.py   (cần numpy và ffmpeg) rồi dựng + bake lại phòng (xem README).
"""
import subprocess
from pathlib import Path

import numpy as np

W_M, D_M, TILE = 7.0, 6.5, .5
PX, PY = 2048, 1901                           # cùng tỉ lệ sàn, như bake_floor
GREY, BLUE = (128, 131, 135), (40, 92, 176)
BAY = (4, 10, 2, 10)                          # khu xanh: cột 4–9 (x −1,5 → 1,5 m), hàng 2–9 tính từ tường trong (z −5,5 → −1,5 m)
TEETH, AMP = 5, .045                          # số răng mỗi cạnh, độ sâu răng (phần của một tấm)
OUT = Path(__file__).resolve().parent / 'tex' / 'floor.png'

rng = np.random.default_rng(7)
ny, nx = int(round(D_M / TILE)), int(round(W_M / TILE))
y, x = np.mgrid[0:PY, 0:PX].astype(np.float64)
X, Y = x / PX * nx, y / PY * ny               # toạ độ theo đơn vị tấm


def tooth(s):                                 # sóng gần vuông (răng khoá bo tròn)
    return np.clip(1.7 * np.sin(2 * np.pi * s), -1, 1)


col = np.floor(X + AMP * tooth(TEETH * Y)).astype(int)
row = np.floor(Y + AMP * tooth(TEETH * X)).astype(int)
col, row = np.clip(col, 0, nx - 1), np.clip(row, 0, ny - 1)

c0, c1, r0, r1 = BAY
blue = (col >= c0) & (col < c1) & (row >= r0) & (row < r1)
base = np.where(blue[..., None], np.array(BLUE, float), np.array(GREY, float))
base *= (1 + rng.uniform(-.025, .025, (ny, nx)))[row, col][..., None]      # mỗi tấm lệch màu một chút

# mặt tấm: hạt nổi tròn (sáng phía trên trái, tối phía dưới phải)
k = 12
fu, fv = (X * k) % 1 - .5, (Y * k) % 1 - .5
r = np.hypot(fu, fv)
stud = r < .26
shade = np.where(stud, 1 - 1.4 * (fu + fv) * .12, 1.0)
base *= shade[..., None]

# đường ghép: điểm ảnh có hàng xóm thuộc tấm khác; viền trong mép tối nhẹ cho có độ dày
idx = row * nx + col
seam = np.zeros((PY, PX), bool)
near = np.zeros((PY, PX), bool)
for dy, dx, out in ((0, 1, seam), (1, 0, seam), (0, 3, near), (3, 0, near)):
    a = idx[dy:, dx:] != idx[:PY - dy, :PX - dx]
    out[dy:, dx:] |= a
    out[:PY - dy, :PX - dx] |= a
base[near & ~seam] *= .86
base[seam] *= .42

img = np.clip(base, 0, 255).astype(np.uint8)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{PX}x{PY}', '-i', '-',
                str(OUT)], input=img.tobytes(), check=True)
print(OUT, OUT.stat().st_size, 'bytes')
