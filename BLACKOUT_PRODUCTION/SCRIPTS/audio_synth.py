"""Soundeffekte und Musik – komplett synthetisch erzeugt (numpy), daher frei von fremden Rechten."""
import numpy as np

SR = 48000
_rng = np.random.default_rng(7)


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.005, r=0.2, sustain=None):
    t = t_axis(d)
    e = np.minimum(1, t / max(a, 1e-4))
    e *= np.exp(-t / r) if sustain is None else np.where(t < d - r, 1, np.clip((d - t) / r, 0, 1))
    return e


def noise(d, color="white"):
    n = _rng.standard_normal(int(d * SR))
    if color == "pink":
        f = np.fft.rfft(n)
        f /= np.sqrt(np.maximum(np.arange(len(f)), 1))
        n = np.fft.irfft(f, len(n))
    elif color == "brown":
        n = np.cumsum(n)
        n -= smooth(n, 2000)
    return n / (np.abs(n).max() + 1e-9)


def onepole(x, fc, high=False):
    """Einfacher Tief-/Hochpass (vektorisiert über FFT)."""
    f = np.fft.rfftfreq(len(x), 1 / SR)
    h = 1 / np.sqrt(1 + (f / fc) ** 4)
    if high:
        h = 1 - h
    return np.fft.irfft(np.fft.rfft(x) * h, len(x))


def band(x, lo, hi):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    h = (1 / np.sqrt(1 + (f / hi) ** 6)) * (1 - 1 / np.sqrt(1 + (f / lo) ** 6))
    return np.fft.irfft(np.fft.rfft(x) * h, len(x))


def smooth(x, k):
    """Gleitender Mittelwert (schnell, über kumulative Summe)."""
    k = max(1, int(k))
    c = np.concatenate([[0.0], np.cumsum(np.pad(x, (k // 2, k - k // 2 - 1), mode="edge"))])
    return (c[k:] - c[:-k]) / k


def norm(x, peak):
    return x / (np.abs(x).max() + 1e-9) * peak


# ---------------------------------------------------------------- Effekte
def impact(d=2.2):
    t = t_axis(d)
    boom = np.sin(2 * np.pi * (32 + 70 * np.exp(-7 * t)) * t) * np.exp(-2.2 * t)
    hit = onepole(noise(d), 900) * np.exp(-18 * t)
    sub = np.sin(2 * np.pi * 28 * t) * np.exp(-1.5 * t) * 0.5
    return norm(boom + 0.6 * hit + sub, 0.9)


def power_down(d=1.6):
    t = t_axis(d)
    f = 120 * np.exp(-2.5 * t) + 20
    hum = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    zap = band(noise(d), 2000, 7000) * np.exp(-30 * t)
    return norm(hum * np.exp(-1.8 * t) + 0.5 * zap, 0.7)


def click(d=0.06, f=3000):
    t = t_axis(d)
    return norm(band(noise(d), f * 0.5, f * 2) * np.exp(-120 * t) + 0.5 * np.sin(2 * np.pi * f * 0.4 * t) * np.exp(-90 * t), 0.6)


def switch_double():
    out = np.zeros(int(0.7 * SR))
    for st in (0.05, 0.38):
        c = click(0.06, 2500)
        i = int(st * SR)
        out[i:i + len(c)] += c
    return out


def static(d, level=1.0):
    n = band(noise(d), 600, 4500) * 0.5
    t = t_axis(d)
    crack = np.zeros_like(n)
    for _ in range(int(d * 14)):
        i = _rng.integers(0, len(n) - 400)
        crack[i:i + 400] += _rng.uniform(-1, 1) * np.exp(-np.arange(400) / 60)
    mod = 0.75 + 0.25 * np.sin(2 * np.pi * 0.7 * t + 1.3) * np.sin(2 * np.pi * 3.1 * t)
    e = np.minimum(1, t / 0.08) * np.minimum(1, (d - t) / 0.12)
    return norm((n * mod + 0.6 * crack) * e, 0.35 * level)


def squelch():
    d = 0.35
    t = t_axis(d)
    burst = band(noise(d), 800, 5000) * np.exp(-14 * t)
    beep = np.sin(2 * np.pi * 1400 * t) * (t < 0.09) * 0.5
    return norm(burst + beep, 0.5)


def ptt_click():
    a = click(0.05, 1800)
    b = squelch() * 0.6
    out = np.zeros(len(b) + 2400)
    out[:len(a)] += a
    out[2400:] += b
    return out


def knock(times=(0.1, 0.42, 0.74), d=1.3):
    out = np.zeros(int(d * SR))
    for st in times:
        k = int(0.25 * SR)
        t = t_axis(0.25)
        body = np.sin(2 * np.pi * 140 * t) * np.exp(-28 * t) + 0.6 * np.sin(2 * np.pi * 230 * t) * np.exp(-40 * t)
        thump = onepole(noise(0.25), 1200) * np.exp(-60 * t)
        i = int(st * SR)
        out[i:i + k] += body + 0.8 * thump
    return norm(out, 0.85)


def handle(d=1.2):
    t = t_axis(d)
    cl = np.zeros(int(d * SR))
    c = click(0.05, 4000)
    cl[int(0.2 * SR):int(0.2 * SR) + len(c)] += c
    cr = np.sin(2 * np.pi * np.cumsum(180 + 60 * np.sin(2 * np.pi * 7 * t)) / SR)
    cr = band(np.sign(cr) * (np.abs(cr) ** 0.3), 300, 3000) * np.clip((t - 0.25) * 4, 0, 1) * np.exp(-2 * np.maximum(t - 0.25, 0))
    return norm(cl + 0.35 * cr, 0.6)


def creak(d=1.4):
    t = t_axis(d)
    f = 90 + 50 * np.sin(2 * np.pi * 0.6 * t)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    s = band(np.sign(s) * (np.abs(s) ** 0.2), 200, 2500)
    e = np.sin(np.pi * t / d) ** 2
    return norm(s * e, 0.35)


def footsteps(n=4, gap=0.45, d=2.2):
    out = np.zeros(int(d * SR))
    for k in range(n):
        st = 0.1 + k * gap
        t = t_axis(0.2)
        s = onepole(noise(0.2), 500) * np.exp(-30 * t) + 0.5 * np.sin(2 * np.pi * 70 * t) * np.exp(-25 * t)
        i = int(st * SR)
        if i + len(s) < len(out):
            out[i:i + len(s)] += s * (0.7 + 0.3 * (k % 2))
    return norm(out, 0.5)


def wind(d):
    t = t_axis(d)
    w = onepole(noise(d, "pink"), 700)
    m = 0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * t) * np.sin(2 * np.pi * 0.07 * t + 1)
    e = np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 0.5)
    return norm(w * m * e, 0.25)


def heartbeat(d=1.2, bpm=80):
    out = np.zeros(int(d * SR))
    per = 60 / bpm
    st = 0.0
    while st < d - 0.3:
        for off, amp in ((0, 1.0), (0.26, 0.75)):
            t = t_axis(0.25)
            b = np.sin(2 * np.pi * 48 * t) * np.exp(-14 * t) * amp
            i = int((st + off) * SR)
            if i + len(b) <= len(out):
                out[i:i + len(b)] += b
        st += per
    return norm(out, 0.8)


def battery_warn(n=2):
    d = 0.22 * n * 2
    out = np.zeros(int(d * SR))
    for k in range(n):
        for j, f in enumerate((1320, 880)):
            t = t_axis(0.16)
            b = np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.005) * np.minimum(1, (0.16 - t) / 0.02)
            i = int((k * 0.44 + j * 0.19) * SR)
            out[i:i + len(b)] += b
    return norm(out, 0.3)


def error_beep():
    t = t_axis(0.35)
    b = np.sin(2 * np.pi * 440 * t) * (np.sin(2 * np.pi * 8 * t) > -0.2) * np.exp(-3 * t)
    return norm(b, 0.25)


def drips(d=1.2):
    out = np.zeros(int(d * SR))
    for st in (0.05, 0.42, 0.75):
        t = t_axis(0.15)
        b = np.sin(2 * np.pi * (1400 - 3000 * t) * t) * np.exp(-40 * t)
        i = int(st * SR)
        out[i:i + len(b)] += b
    return norm(out, 0.35)


def match_strike():
    d = 1.0
    t = t_axis(d)
    scratch = band(noise(d), 1500, 8000) * np.exp(-12 * t) * (t < 0.25)
    flare = onepole(noise(d), 1800) * np.exp(-3 * np.maximum(t - 0.15, 0)) * (t > 0.15) * 0.5
    return norm(scratch + flare, 0.45)


def candle_out():
    d = 0.8
    t = t_axis(d)
    puff = band(noise(d), 200, 2500) * np.sin(np.pi * np.clip(t / 0.35, 0, 1)) * (t < 0.35)
    hiss = band(noise(d), 3000, 9000) * np.exp(-6 * t) * 0.2
    return norm(puff + hiss, 0.45)


def crank(d=1.4):
    out = np.zeros(int(d * SR))
    st = 0.05
    while st < d - 0.05:
        c = click(0.03, 3500) * 0.6
        i = int(st * SR)
        out[i:i + len(c)] += c
        st += 0.055
    return norm(out, 0.35)


def radio_tune(d=1.2):
    t = t_axis(d)
    wh = np.sin(2 * np.pi * np.cumsum(900 + 700 * np.sin(2 * np.pi * 0.9 * t)) / SR) * 0.3
    return norm(static(d) + wh * np.exp(-2 * t), 0.35)


def fridge(d=1.0):
    t = t_axis(d)
    pop = onepole(noise(d), 400) * np.exp(-25 * t)
    hum = np.sin(2 * np.pi * 50 * t) * 0.15 * (t < 0.4) * np.exp(-6 * t)
    return norm(pop + hum, 0.4)


def crowd(d):
    t = t_axis(d)
    out = np.zeros(int(d * SR))
    for k in range(24):
        f = _rng.uniform(110, 240)
        ph = _rng.uniform(0, 6.28)
        syl = (np.sin(2 * np.pi * _rng.uniform(2.5, 5) * t + ph) > 0.2).astype(float)
        syl = smooth(syl, 0.02 * SR)
        v = band(noise(d), f * 2, f * 12) * syl
        out += v * _rng.uniform(0.3, 1)
    out = onepole(out, 2500)
    e = np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.4)
    return norm(out * e, 0.3) + footsteps(int(d / 0.3), 0.3, d) * 0.25


def game_blips(d=1.2):
    out = np.zeros(int(d * SR))
    notes = [523, 659, 784, 1046, 784, 659]
    for k, f in enumerate(notes):
        t = t_axis(0.12)
        b = np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-12 * t) * 0.3
        i = int(k * 0.15 * SR)
        if i + len(b) < len(out):
            out[i:i + len(b)] += b
    return norm(onepole(out, 4000), 0.18)


def whoosh(d=0.6):
    t = t_axis(d)
    w = band(noise(d), 300, 3000) * np.sin(np.pi * t / d) ** 2
    return norm(w, 0.3)


def riser(d=2.0):
    t = t_axis(d)
    f = 80 * (1 + 6 * (t / d) ** 2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    n = band(noise(d), 500, 6000) * (t / d) ** 2
    return norm((tone * 0.5 + n) * (t / d) ** 1.5, 0.55)


def tick(d=1.5, per=0.5):
    out = np.zeros(int(d * SR))
    st = 0.0
    k = 0
    while st < d - 0.05:
        c = click(0.04, 2600 if k % 2 else 2000)
        i = int(st * SR)
        out[i:i + len(c)] += c
        st += per
        k += 1
    return norm(out, 0.45)


SFX = {
    "impact": impact, "power_down": power_down, "switch": switch_double, "static": static, "squelch": squelch,
    "ptt": ptt_click, "knock": knock, "handle": handle, "creak": creak, "footsteps": lambda d: footsteps(max(2, int(d / 0.45)), 0.45, d), "wind": wind,
    "heartbeat": heartbeat, "battery": battery_warn, "error": error_beep, "drips": drips, "match": match_strike,
    "candle_out": candle_out, "crank": crank, "radio_tune": radio_tune, "fridge": fridge, "crowd": crowd,
    "game": game_blips, "whoosh": whoosh, "riser": riser, "tick": tick,
}
NEEDS_DUR = {"static", "wind", "crowd", "heartbeat", "riser", "tick", "radio_tune", "creak", "footsteps", "crank"}


def make_sfx(name, d):
    fn = SFX[name]
    return fn(d) if name in NEEDS_DUR else fn()


# ---------------------------------------------------------------- Musik
def _saw(f, t, harm=8):
    return sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, harm + 1))


def music(states, total):
    """states: Liste (start, ende, zustand). Zustände: calm, dread, tension, peak, silence, outro."""
    t = t_axis(total)
    n = len(t)
    layers = {k: np.zeros(n) for k in ("drone", "pad", "pulse", "strings", "hits", "arp")}
    D = 36.71
    layers["drone"] = onepole(_saw(D, t, 6) + _saw(D * 1.003, t, 6) + 0.5 * np.sin(2 * np.pi * D / 2 * t), 180)
    layers["drone"] *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.11 * t)
    chord = [D * 4, D * 4 * 1.189, D * 4 * 1.498, D * 8 * 1.122]
    layers["pad"] = onepole(sum(_saw(f, t, 5) * (0.6 + 0.4 * np.sin(2 * np.pi * (0.07 + i * 0.03) * t + i))
                                for i, f in enumerate(chord)), 900)
    beat = 60 / 96 / 2
    ph = (t % beat) / beat
    layers["pulse"] = np.sin(2 * np.pi * D * 2 * t) * np.exp(-ph * beat * 18) + 0.3 * onepole(noise(total), 300) * np.exp(-ph * beat * 30)
    layers["strings"] = band(_saw(D * 16 * 1.498, t, 10) + _saw(D * 16 * 1.5 * 1.004, t, 10), 400, 4000) * \
        (0.6 + 0.4 * np.sin(2 * np.pi * 6.5 * t))
    hb = 60 / 96
    ph2 = (t % hb) / hb
    layers["hits"] = np.sin(2 * np.pi * (50 + 60 * np.exp(-ph2 * hb * 20)) * t) * np.exp(-ph2 * hb * 7)
    arp_notes = [D * 8, D * 8 * 1.189, D * 8 * 1.498, D * 16]
    step = 0.2
    idx = (t // step).astype(int) % 4
    ph3 = (t % step) / step
    layers["arp"] = np.sin(2 * np.pi * np.array(arp_notes)[idx] * t) * np.exp(-ph3 * step * 14)
    mix = {
        "calm": dict(drone=0.15, pad=0.35, arp=0.25),
        "dread": dict(drone=0.6, pad=0.35),
        "tension": dict(drone=0.55, pad=0.25, pulse=0.55, strings=0.12),
        "peak": dict(drone=0.6, pad=0.3, pulse=0.6, strings=0.2, hits=0.5),
        "silence": dict(),
        "outro": dict(drone=0.5, pad=0.45, strings=0.1),
    }
    gains = {k: np.zeros(n) for k in layers}
    for st, en, state in states:
        a, b = int(st * SR), int(en * SR)
        for k in layers:
            gains[k][a:b] = mix[state].get(k, 0)
    out = np.zeros(n)
    for k in layers:
        g = smooth(gains[k], 0.35 * SR)
        out += norm(layers[k], 1) * g
    out *= np.minimum(1, t / 1.0) * np.minimum(1, (total - t) / 1.5)
    return out
