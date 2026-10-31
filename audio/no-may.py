"""Tiếng nẹt bô lúc bấm START / chìa khóa: web/assets/no-may.mp3.

Chạy:  python audio/no-may.py   (cần numpy và ffmpeg trong PATH)

Tiếng máy là bản ghi âm xe thật: audio/xe-that-043.flac = giây 3,0 → 8,3 của file 043 trong bộ "Performance Cars"
của muted.io (https://muted.io/performance-cars, giấy phép CC0 — dùng thương mại, không cần ghi nguồn). Trong đoạn
đó có hai lần rú ga từ garanti, nhả ga có tiếng nổ lách tách.

Bấm là nẹt luôn (sếp không muốn nghe đoạn đề máy): lần rú thứ nhất (giây 3,22 của file gốc) bắt đầu ngay từ đầu file,
lên đỉnh lúc ~0,38 s như kim vòng tua trong ignite() (web/index.html); cắt bớt 0,45 s garanti (CUT) để lần rú thứ hai
rơi vào ~1,34 s, lúc màn hình lao đi. Đổi nhịp bên ignite() thì sửa CUT ở dưới.
"""
import subprocess
import wave
from pathlib import Path

import numpy as np

FS = 44100
HERE = Path(__file__).resolve().parent
SRC = HERE / 'xe-that-043.flac'               # bắt đầu ở giây 3,0 của file gốc
OUT = HERE.parent / 'web' / 'assets' / 'no-may.mp3'
SRC_T0 = 3.0
FLARE = 3.22                                  # lần rú thứ nhất bắt đầu (giây của file gốc)
PRE = .015                                    # vào sớm 15 ms trước tiếng rú, nâng âm lượng trong khoảng đó
CUT = (4.30, 4.75)                            # bỏ đoạn garanti này (giây của file gốc) cho lần rú thứ hai tới sớm hơn
END = 7.95
XF = .04                                      # nối mượt 40 ms


def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(p), '-ac', '2', '-ar', str(FS), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, '<f4').reshape(-1, 2).astype(float)


def at(s):                                    # giây của file gốc -> chỉ số mẫu trong SRC
    return int(round((s - SRC_T0) * FS))


def biquad(x, b, a):                          # bộ lọc (RBJ cookbook)
    b0, b1, b2 = (v / a[0] for v in b)
    a1, a2 = a[1] / a[0], a[2] / a[0]
    y = np.empty_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, o
        y[i] = o
    return y


def highpass(x, f, q=.707):
    w = 2 * np.pi * f / FS
    c, al = np.cos(w), np.sin(w) / (2 * q)
    return biquad(x, ((1 + c) / 2, -(1 + c), (1 + c) / 2), (1 + al, -2 * c, 1 - al))


def smooth(x, ms):
    k = 1 - np.exp(-1 / (FS * ms / 1000))
    return biquad(x, (k, 0, 0), (1, -(1 - k), 0))


# ── tiếng máy thật: hai khúc nối mượt, bỏ đoạn CUT ──
src = load(SRC)
a = src[at(FLARE - PRE):at(CUT[0] + XF)]
b = src[at(CUT[1]):at(END)]
n = int(XF * FS)
fade = np.sin(np.linspace(0, np.pi / 2, n))[:, None]
eng = np.concatenate([a[:-n], a[-n:] * fade[::-1] + b[:n] * fade, b[n:]])
p = int(PRE * FS)
eng[:p] *= np.linspace(0, 1, p)[:, None]
N = len(eng)
T = N / FS
t = np.arange(N) / FS

# ── làm to: bớt ù dưới 35 Hz, nén cho garanti rõ hơn, chặn đỉnh mềm ──
x = np.stack([highpass(eng[:, c], 35) for c in range(2)], 1)
rms = np.sqrt(smooth((x ** 2).mean(1), 50)) + 1e-9
thr = .3 * rms.max()
x *= np.where(rms > thr, (rms / thr) ** (1 / 2.5 - 1), 1)[:, None]
x *= np.clip((T - .05 - t) / .8, 0, 1)[:, None] ** 1.5           # êm dần như xe đi xa
x /= np.percentile(np.abs(x), 99.95)
x = np.tanh(1.25 * x) / np.tanh(1.25) * 10 ** (-.8 / 20)        # đỉnh -0,8 dBFS

wav = OUT.with_suffix('.wav')
with wave.open(str(wav), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(FS)
    w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '128k', str(OUT)], check=True)
wav.unlink()
print(OUT, OUT.stat().st_size, 'bytes', f'{T:.2f}s')
