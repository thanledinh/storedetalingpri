"""Vân sàn phòng trưng bày: sàn nhựa ghép (tấm 50 × 50 cm, mép răng khoá vào nhau, mặt có hạt nổi) màu xám; quanh bục
là một ô đậu xe viền xanh dương (viền rộng một tấm, lòng xám) như sàn tiệm thật. Mặt sàn mờ, không bóng phản chiếu.
Ghi ra blender/tex/floor.png (ảnh phủ cả sàn 7 × 6,5 m; hàng trên cùng = tường trong).

Chạy:  python blender/floor_tiles.py   (cần numpy và ffmpeg) rồi dựng + bake lại phòng (xem README).
"""
import subprocess
from pathlib import Path

import numpy as np

W_M, D_M, TILE = 7.0, 6.5, .5
PX, PY = 2048, 1901                           # cùng tỉ lệ sàn, như bake_floor
GREY, BLUE = (150, 153, 157), (38, 84, 190)
BAY = (3, 11, 2, 11)                          # ô viền xanh: cột 3–10 (x −2 → 2 m), hàng 2–10 tính từ tường trong (z −5,5 → −1 m)
TEETH, AMP = 5, .04                           # số răng mỗi cạnh, độ sâu răng (phần của một tấm)
OUT = Path(__file__).resolve().parent / 'tex' / 'floor.png'

rng = np.random.default_rng(7)
ny, nx = int(round(D_M / TILE)), int(round(W_M / TILE))
y, x = np.mgrid[0:PY, 0:PX].astype(np.float64)
X, Y = x / PX * nx, y / PY * ny               # toạ độ theo đơn vị tấm


def tooth(s):                                 # sóng gần vuông (răng khoá bo tròn)
    return np.clip(1.7 * np.sin(2 * np.pi * s), -1, 1)


col = np.clip(np.floor(X + AMP * tooth(TEETH * Y)).astype(int), 0, nx - 1)
row = np.clip(np.floor(Y + AMP * tooth(TEETH * X)).astype(int), 0, ny - 1)

c0, c1, r0, r1 = BAY
inside = (col >= c0) & (col < c1) & (row >= r0) & (row < r1)
rim = inside & ((col == c0) | (col == c1 - 1) | (row == r0) | (row == r1 - 1))
base = np.where(rim[..., None], np.array(BLUE, float), np.array(GREY, float))
base *= (1 + rng.uniform(-.006, .006, (ny, nx)))[row, col][..., None]      # mỗi tấm lệch màu rất ít

# mặt tấm: hạt nổi nhỏ (sáng phía trên trái, tối phía dưới phải)
k = 16
fu, fv = (X * k) % 1 - .5, (Y * k) % 1 - .5
stud = np.hypot(fu, fv) < .27
base *= np.where(stud, 1 - (fu + fv) * .16, 1.0)[..., None]

# tấm ép khít: giữa hai tấm cùng màu gần như không thấy đường ghép; chỗ xám giáp xanh chỉ thấy răng khoá qua màu,
# thêm một lằn rất mờ
idx = row * nx + col
same, diff = np.zeros((PY, PX), bool), np.zeros((PY, PX), bool)
for dy, dx in ((0, 1), (1, 0)):
    a = idx[dy:, dx:] != idx[:PY - dy, :PX - dx]
    d = rim[dy:, dx:] != rim[:PY - dy, :PX - dx]
    for m, v in ((same, a & ~d), (diff, a & d)):
        m[dy:, dx:] |= v
        m[:PY - dy, :PX - dx] |= v
base[same & ~diff] *= .975
base[diff] *= .9

img = np.clip(base, 0, 255).astype(np.uint8)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{PX}x{PY}', '-i', '-',
                str(OUT)], input=img.tobytes(), check=True)
print(OUT, OUT.stat().st_size, 'bytes')
