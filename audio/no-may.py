"""Tiếng nổ máy lúc bấm START: web/assets/no-may.mp3 (tổng hợp, không dùng bản ghi âm nào).

Chạy:  python audio/no-may.py   (cần numpy và ffmpeg trong PATH)

Máy 6 xy-lanh nằm ngang kiểu 911: mỗi vòng tua 3 lần nổ. Vòng tua bám đúng kim đồng hồ ở màn chìa khóa
(ignite() trong web/index.html): đề 0–0,34 s → nổ, vọt lên 3800 → về garanti 900 → 1,68 s rú lên 3200 lúc xe
lao đi → về 1200 rồi êm dần. Đổi nhịp bên ignite() thì sửa SEGS ở dưới cho khớp.

Cách tạo: mỗi lần nổ là một xung áp suất ống xả (mạnh hơn khi đạp ga); chuỗi xung đi qua hai ống xả (lọc lược có
phản hồi), bầu giảm thanh (lọc thấp, sáng hơn khi ga lớn), cộng hưởng thân xe, méo nhẹ, tiếng hút gió; nhả ga ở vòng
tua cao thì có tiếng nổ lách tách. Lúc đề: tiếng "cạch" của rơ-le đề, tiếng rít bánh răng đề, nhịp nén của máy.
"""
import subprocess
import wave
from pathlib import Path

import numpy as np

FS = 44100
T = 4.6
N = int(FS * T)
t = np.arange(N) / FS
rng = np.random.default_rng(911)
OUT = Path(__file__).resolve().parent.parent / 'web' / 'assets' / 'no-may.mp3'


def eio(k):
    return np.where(k < .5, 2 * k * k, 1 - (-2 * k + 2) ** 2 / 2)


def eout(k):
    return 1 - (1 - k) ** 3


# kim vòng tua (nghìn vòng/phút) như ignite(): (bắt đầu, kết thúc, từ, tới, kiểu chạy)
SEGS = [(0.34, 0.72, 0.45, 3.8, eout), (0.72, 1.42, 3.8, 0.9, eio), (1.42, 1.68, 0.9, 0.9, eio),
        (1.68, 2.18, 0.9, 3.2, eout), (2.18, 3.08, 3.2, 1.2, eio), (3.08, 3.9, 1.2, .95, eio), (3.9, T, .95, .95, eio)]
CATCH = 0.34                                  # máy bắt nổ (hết đề)
# ga (0 nhả hẳn … 1 đạp hết): (giây, mức)
LOAD = [(0, 0), (CATCH, 0), (CATCH + .01, 1), (.6, .65), (.7, .08), (1.28, .06), (1.42, .3), (1.66, .3), (1.7, .95),
        (2.1, .8), (2.18, .08), (2.95, .06), (3.12, .28), (T, .26)]


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


def peak(x, f, db, q=1.):
    c, al = _w(f, q)
    A = 10 ** (db / 40)
    return biquad(x, (1 + al * A, -2 * c, 1 - al * A), (1 + al / A, -2 * c, 1 - al / A))


def smooth(x, ms):
    k = 1 - np.exp(-1 / (FS * ms / 1000))
    return biquad(x, (k, 0, 0), (1, -(1 - k), 0))


def comb(x, delay_s, r, damp_hz):
    """ống xả: sóng phản xạ ở miệng ống (đảo dấu, mất bớt tiếng cao) quay lại"""
    d = int(round(delay_s * FS))
    k = 1 - np.exp(-2 * np.pi * damp_hz / FS)
    y = np.zeros_like(x)
    lp = 0.0
    for i in range(len(x)):
        fb = y[i - d] if i >= d else 0.0
        lp += k * (fb - lp)
        y[i] = x[i] + r * lp
    return y


def kernel(tau0, length_ms=14):
    s = np.arange(int(FS * length_ms / 1000)) / FS
    return (s / tau0) * np.exp(1 - s / tau0)


# ── vòng tua thật và góc trục khuỷu ──
tacho = np.zeros(N)
for a, b, v0, v1, ease in SEGS:
    m = (t >= a) & (t < b)
    tacho[m] = v0 + (v1 - v0) * ease((t[m] - a) / (b - a))
target = smooth(tacho * 1000, 18)
wobble = 1 + .018 * np.sin(2 * np.pi * 1.3 * t) + .01 * np.sin(2 * np.pi * 3.7 * t + 1)
load = smooth(np.interp(t, *zip(*LOAD)), 12)

rpm = np.zeros(N)
theta = np.zeros(N)                          # số vòng đã quay
th = 0.0
for i in range(N):
    if t[i] < CATCH:                         # đề: mô-tơ đề kéo máy ~260 vòng/phút, chậm lại mỗi lần nén
        r = 260 * min(1, t[i] / .06) * (1 + .3 * np.sin(2 * np.pi * 3 * th))
    else:
        r = max(target[i] * wobble[i], 300)
    rpm[i] = r
    th += r / 60 / FS
    theta[i] = th

events = np.flatnonzero(np.diff(np.floor(theta * 3)) > 0) + 1     # mỗi 1/3 vòng: một lần nổ (hoặc một lần nén lúc đề)
crank_ev = events[t[events] < CATCH]
fire_ev = events[t[events] >= CATCH]

# ── xung nổ ──
CYL = np.array([1.0, .84, 1.1, .92, 1.14, .88])   # mỗi xy-lanh nổ hơi khác nhau: tiếng "bùng bục" lúc garanti
soft = np.zeros(N)
sharp = np.zeros(N)
pops = np.zeros(N)
for n, i in enumerate(fire_ev):
    L = load[i]
    A = (.22 + .78 * L) * CYL[n % 6] * (1 + .07 * rng.standard_normal())
    if n < 2:
        A *= 1.35                                  # hai tiếng nổ đầu: bật mạnh
    elif n == 3:
        A *= .25                                   # một lần nổ hụt ngay lúc bắt máy
    soft[i] += A
    sharp[i] += A * L
    if L < .15 and rpm[i] > 1500 and rng.random() < .16:          # nhả ga ở vòng tua cao: nổ lách tách
        pops[min(N - 1, i + rng.integers(40, 260))] += .5 + .7 * rng.random()

exc = np.convolve(soft, kernel(.0011))[:N] + 2.4 * np.convolve(sharp, kernel(.00028, 6))[:N]
exc = highpass(exc, 22)

# hai ống xả dài khác nhau
pipe = .5 * (comb(exc, .0052, -.55, 2600) + comb(exc, .0073, -.5, 2000))
bright = np.clip(.12 + .6 * load + .28 * rpm / 6000, 0, 1)
eng = lowpass(pipe, 900) * (1 - bright) + lowpass(pipe, 4000) * bright
eng = highpass(eng, 75)                       # bớt ù dưới 75 Hz (chỉ làm đầy đỉnh, loa nhỏ không phát)
eng = peak(eng, 105, 4, 1.1)
eng = peak(eng, 230, 3, 1.2)
eng = peak(eng, 620, 6, .8)                   # tiếng "gằn" ở giữa: loa điện thoại không phát được tiếng trầm, phải nghe bằng dải này
eng = peak(eng, 1600, 3, 1.)
eng /= np.percentile(np.abs(eng), 99.7)
drive = 1.6 + 3.4 * load
eng = np.tanh(drive * eng) / np.tanh(drive)

# hút gió: tiếng ù theo nhịp nổ, to khi đạp ga ở vòng tua cao
env = np.convolve(soft, np.hanning(int(FS * .004)))[:N]
noise = rng.standard_normal(N)
intake = (bandpass(noise, 520, .9) + .6 * bandpass(noise, 1500, 1.2)) * env * load * np.clip(rpm / 4500, 0, 1.3)
eng += .45 * intake / (np.abs(intake).max() + 1e-9)
eng += .025 * highpass(rng.standard_normal(N), 2500) * np.clip(rpm / 6000, 0, 1)     # gió, máy chạy
eng[t < CATCH] = 0

# nổ lách tách
pk = np.exp(-np.arange(int(FS * .012)) / (FS * .0025))
crk = np.convolve(pops, pk)[:N] * rng.standard_normal(N)
crk = lowpass(crk, 3800) + 1.5 * lowpass(np.convolve(pops, kernel(.0009))[:N], 300)
eng += .45 * crk / (np.abs(crk).max() + 1e-9)

# ── đề ──
fade = np.clip((CATCH + .07 - t) / .08, 0, 1) * np.clip(t / .02, 0, 1)
gear = np.cumsum(rpm / 60 * 130 / FS) * 2 * np.pi              # bánh đà 130 răng: tiếng rít ~560 Hz
press = 1 - .3 * np.sin(2 * np.pi * 3 * theta)
whine = (.5 * np.sin(gear) + .25 * np.sin(2 * gear + .3) + .12 * np.sin(3 * gear + 1)) * press
buzz = bandpass(rng.standard_normal(N), 1800, 1.5) * press
thump = np.zeros(N)
thump[crank_ev] = 1
thump = bandpass(thump, 70, 3) * 9 + lowpass(np.convolve(thump, pk)[:N] * rng.standard_normal(N), 700) * 1.2
s0 = np.arange(int(FS * .08)) / FS                              # rơ-le đề "cạch"
clunk = np.zeros(N)
clunk[:len(s0)] = np.sin(2 * np.pi * 170 * s0) * np.exp(-s0 / .022) + rng.standard_normal(len(s0)) * np.exp(-s0 / .003)
starter = (.16 * whine + .08 * buzz / np.abs(buzz).max() + .4 * thump / np.abs(thump).max()) * fade + .35 * clunk

dry = eng + starter
dry = highpass(dry, 28)
rms = np.sqrt(smooth(dry ** 2, 60)) + 1e-9                     # nén: garanti nghe rõ hơn, rú ga không át hẳn
thr = .35 * rms.max()
dry *= np.where(rms > thr, (rms / thr) ** (1 / 2.5 - 1), 1)
dry *= np.clip((T - .1 - t) / .85, 0, 1) ** 1.5                 # êm dần như xe đi xa


# ── vang phòng (trái / phải khác nhau cho rộng) ──
def reverb(x, seed):
    g = np.random.default_rng(seed)
    n = int(FS * .9)
    s = np.arange(n) / FS
    ir = g.standard_normal(n) * np.exp(-s / .17)
    ir = lowpass(ir, 3200)
    for ms, amp in ((9, .5), (17, .35), (26, .3), (41, .22)):
        ir[int(FS * ms / 1000)] += amp * (1 if g.random() > .5 else -1)
    ir /= np.sqrt((ir ** 2).sum())
    L = len(x) + n
    f = 1 << (L - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, f) * np.fft.rfft(ir, f), f)[:len(x)]


wet = .2
left = dry + wet * reverb(dry, 1)
right = dry + wet * reverb(dry, 2)
st = np.stack([left, right], 1)
st /= np.abs(st).max()
st = np.tanh(1.3 * st) / np.tanh(1.3) * 10 ** (-1 / 20)       # chặn đỉnh nhẹ, đỉnh -1 dBFS

wav = OUT.with_suffix('.wav')
with wave.open(str(wav), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(FS)
    w.writeframes((st * 32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '128k', str(OUT)], check=True)
wav.unlink()
print(OUT, OUT.stat().st_size, 'bytes')
