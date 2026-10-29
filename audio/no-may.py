"""Tiếng nổ máy lúc bấm START: web/assets/no-may.mp3.

Chạy:  python audio/no-may.py   (cần numpy và ffmpeg trong PATH)

Tiếng máy là bản ghi âm xe thật: audio/xe-that-043.flac = giây 3,0 → 8,3 của file 043 trong bộ "Performance Cars"
của muted.io (https://muted.io/performance-cars, giấy phép CC0 — dùng thương mại, không cần ghi nguồn). Trong đoạn
đó có hai lần rú ga từ garanti, nhả ga có tiếng nổ lách tách. Chỉ đoạn đề máy (0,34 giây đầu) là tổng hợp, vì bộ
ghi âm không có tiếng đề.

Khớp kim vòng tua ở màn chìa khóa (ignite() trong web/index.html): đề 0 → 0,34 s; lần rú thứ nhất (giây 3,22 của
file gốc) bắt đầu đúng 0,34 s và lên đỉnh lúc 0,72 s như kim; cắt bớt 0,45 s garanti (CUT) để lần rú thứ hai
rơi vào 1,68 s, lúc màn hình lao đi. Đổi nhịp bên ignite() thì sửa CATCH / CUT ở dưới.
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
CATCH = 0.34                                  # máy nổ: lần rú thứ nhất (giây 3,22 của file gốc) bắt đầu ở đây
FLARE = 3.22
CUT = (4.30, 4.75)                            # bỏ đoạn garanti này (giây của file gốc) cho lần rú thứ hai tới sớm hơn
END = 7.95
XF = .04                                      # nối mượt 40 ms
rng = np.random.default_rng(911)


def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(p), '-ac', '2', '-ar', str(FS), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, '<f4').reshape(-1, 2).astype(float)


def at(s):                                    # giây của file gốc -> chỉ số mẫu trong SRC
    return int(round((s - SRC_T0) * FS))


# ── bộ lọc (RBJ cookbook) ──
def biquad(x, b, a):
    b0, b1, b2 = (v / a[0] for v in b)
    a1, a2 = a[1] / a[0], a[2] / a[0]
    y = np.empty_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, o
        y[i] = o
    return y


def _w(f, q):
    w = 2 * np.pi * f / FS
    return np.cos(w), np.sin(w) / (2 * q)


def lowpass(x, f, q=.707):
    c, al = _w(f, q)
    return biquad(x, ((1 - c) / 2, 1 - c, (1 - c) / 2), (1 + al, -2 * c, 1 - al))


def highpass(x, f, q=.707):
    c, al = _w(f, q)
    return biquad(x, ((1 + c) / 2, -(1 + c), (1 + c) / 2), (1 + al, -2 * c, 1 - al))


def bandpass(x, f, q=1.):
    c, al = _w(f, q)
    return biquad(x, (al, 0, -al), (1 + al, -2 * c, 1 - al))


def smooth(x, ms):
    k = 1 - np.exp(-1 / (FS * ms / 1000))
    return biquad(x, (k, 0, 0), (1, -(1 - k), 0))


# ── tiếng máy thật: hai khúc nối mượt, bỏ đoạn CUT ──
src = load(SRC)
a = src[at(FLARE - .05):at(CUT[0] + XF)]     # vào sớm 50 ms trước khi rú, nâng dần âm lượng
b = src[at(CUT[1]):at(END)]
n = int(XF * FS)
fade = np.sin(np.linspace(0, np.pi / 2, n))[:, None]
real = np.concatenate([a[:-n], a[-n:] * fade[::-1] + b[:n] * fade, b[n:]])
real[:int(.05 * FS)] *= np.linspace(0, 1, int(.05 * FS))[:, None]

T = CATCH - .05 + len(real) / FS
N = int(T * FS)
t = np.arange(N) / FS
eng = np.zeros((N, 2))
o = int((CATCH - .05) * FS)
eng[o:o + len(real)] = real[:N - o]

# ── đề (tổng hợp): rơ-le "cạch", mô-tơ đề kéo máy ~260 vòng/phút, chậm lại mỗi lần nén ──
rpm = np.zeros(N)
theta = np.zeros(N)
th = 0.0
for i in range(N):
    r = 260 * min(1, t[i] / .06) * (1 + .3 * np.sin(2 * np.pi * 4 * th))
    rpm[i] = r
    th += r / 60 / FS
    theta[i] = th
env = np.clip((CATCH + .04 - t) / .08, 0, 1) * np.clip(t / .02, 0, 1)
gear = np.cumsum(rpm / 60 * 130 / FS) * 2 * np.pi              # bánh đà 130 răng: tiếng rít ~560 Hz
press = 1 - .3 * np.sin(2 * np.pi * 4 * theta)
whine = (.5 * np.sin(gear) + .25 * np.sin(2 * gear + .3) + .12 * np.sin(3 * gear + 1)) * press
buzz = bandpass(rng.standard_normal(N), 1800, 1.5) * press
comp = np.zeros(N)
comp[np.flatnonzero(np.diff(np.floor(theta * 4)) > 0) + 1] = 1
pk = np.exp(-np.arange(int(FS * .012)) / (FS * .0025))
thump = bandpass(comp, 70, 3) * 9 + lowpass(np.convolve(comp, pk)[:N] * rng.standard_normal(N), 700) * 1.2
s0 = np.arange(int(FS * .08)) / FS
clunk = np.zeros(N)
clunk[:len(s0)] = np.sin(2 * np.pi * 170 * s0) * np.exp(-s0 / .022) + rng.standard_normal(len(s0)) * np.exp(-s0 / .003)
starter = (.1 * whine +.08 * buzz / np.abs(buzz).max() + .4 * thump / np.abs(thump).max()) * env + .35 * clunk
peak_real = np.percentile(np.abs(eng[o:]), 99.9)
eng += (.45 * peak_real * starter / np.abs(starter).max())[:, None]

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
