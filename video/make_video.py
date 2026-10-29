#!/usr/bin/env python3
"""Blackout Hamburg – TikTok-Video (9:16) komplett per Code.

Aufruf:  python3 make_video.py            -> alles rendern
         python3 make_video.py 3 17 25    -> nur diese Szenen neu rendern, dann neu zusammenfügen
"""
import math
import os
import random
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, S, FPS = 1080, 1920, 2, 30
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "output")
BUILD = os.path.join(ROOT, "build")

ANTON = os.path.join(ROOT, "fonts", "Anton-Regular.ttf")
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
if not os.path.exists(ANTON):
    ANTON = SANS

NAVY0, NAVY1 = "#0f1424", "#1c2236"
RED, YEL, TUR = "#e8423f", "#ffc83d", "#3fd6e8"
OL = "#070a14"
SKIN, HAIR, HOOD, HOOD_D = "#f2c29b", "#6b4226", "#d6a21e", "#b08214"
JEANS, SHOE = "#26396b", "#f5f5f5"
WALL, FLOOR = "#232a46", "#161b2e"

_fonts = {}


def font(path, size):
    key = (path, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(path, int(size * S))
    return _fonts[key]


def rgb(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------- canvas
class Cv:
    def __init__(self, top=NAVY1, bot=NAVY0, transparent=False):
        if transparent:
            self.img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
            self.d = ImageDraw.Draw(self.img)
            return
        g = Image.new("RGB", (1, 256))
        t, b = rgb(top), rgb(bot)
        for i in range(256):
            g.putpixel((0, i), tuple(int(t[k] + (b[k] - t[k]) * i / 255) for k in range(3)))
        self.img = g.resize((W * S, H * S), Image.BILINEAR).convert("RGBA")
        self.d = ImageDraw.Draw(self.img)

    @staticmethod
    def _p(pts):
        return [(x * S, y * S) for x, y in pts]

    def ell(self, cx, cy, rx, ry=None, fill=None, ol=OL, w=7):
        ry = rx if ry is None else ry
        self.d.ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S],
                       fill=fill, outline=ol if w else None, width=max(1, int(w * S)))

    def rect(self, x0, y0, x1, y1, fill=None, ol=OL, w=7, r=0):
        self.d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=r * S, fill=fill,
                                 outline=ol if w else None, width=max(1, int(w * S)))

    def poly(self, pts, fill=None, ol=OL, w=7):
        self.d.polygon(self._p(pts), fill=fill, outline=ol if w else None, width=max(1, int(w * S)))

    def line(self, pts, fill=OL, w=7, caps=False):
        self.d.line(self._p(pts), fill=fill, width=max(1, int(w * S)), joint="curve")
        if caps:
            for x, y in (pts[0], pts[-1]):
                self.ell(x, y, w / 2, fill=fill, w=0)

    def arc(self, cx, cy, r, a0, a1, fill, w):
        self.d.arc([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], a0, a1,
                   fill=fill, width=int(w * S))

    def text(self, x, y, txt, f, fill, anchor="mm", stroke=0, sc=OL):
        self.d.text((x * S, y * S), txt, font=f, fill=fill, anchor=anchor,
                    stroke_width=int(stroke * S), stroke_fill=sc)

    def _layer(self, small):
        self.img.alpha_composite(small.resize(self.img.size, Image.BILINEAR))
        self.d = ImageDraw.Draw(self.img)

    def glow(self, x, y, r, color, a=170):
        L = 4
        lay = Image.new("RGBA", (W // L, H // L), rgb(color) + (0,))
        m = Image.new("L", lay.size, 0)
        ImageDraw.Draw(m).ellipse([(x - r) / L, (y - r) / L, (x + r) / L, (y + r) / L], fill=a)
        lay.putalpha(m.filter(ImageFilter.GaussianBlur(r / L / 2.2)))
        self._layer(lay)

    def dark(self, a, holes=(), color=(3, 5, 12)):
        """Dunkelheit über die Szene legen; holes = (x, y, r, rest-alpha)."""
        L = 4
        m = Image.new("L", (W // L, H // L), a)
        md = ImageDraw.Draw(m)
        blur = 10
        for x, y, r, v in holes:
            md.ellipse([(x - r) / L, (y - r) / L, (x + r) / L, (y + r) / L], fill=v)
            blur = max(blur, r / L / 2.5)
        lay = Image.new("RGBA", m.size, color + (0,))
        lay.putalpha(m.filter(ImageFilter.GaussianBlur(blur)))
        self._layer(lay)

    def tint(self, color, a):
        self.img.alpha_composite(Image.new("RGBA", self.img.size, rgb(color) + (a,)))
        self.d = ImageDraw.Draw(self.img)

    def apoly(self, pts, color, a, blur=0):
        L = 4
        lay = Image.new("RGBA", (W // L, H // L), rgb(color) + (0,))
        m = Image.new("L", lay.size, 0)
        ImageDraw.Draw(m).polygon([(x / L, y / L) for x, y in pts], fill=a)
        if blur:
            m = m.filter(ImageFilter.GaussianBlur(blur / L))
        lay.putalpha(m)
        self._layer(lay)


_vig = None


def vignette(c):
    global _vig
    if _vig is None:
        L = 8
        m = Image.new("L", (W // L, H // L), 0)
        ImageDraw.Draw(m).ellipse([-W * 0.15 / L, -H * 0.08 / L, W * 1.15 / L, H * 1.08 / L], fill=255)
        m = m.filter(ImageFilter.GaussianBlur(40)).point(lambda v: int((255 - v) * 0.75))
        _vig = Image.new("RGBA", m.size, (0, 0, 0, 0))
        _vig.putalpha(m)
        _vig = _vig.resize((W * S, H * S), Image.BILINEAR)
    c.img.alpha_composite(_vig)
    c.d = ImageDraw.Draw(c.img)


# ---------------------------------------------------------------- HUD + Text
def hud(c, clock, on):
    c.text(58, 98, clock, font(MONO, 74), "white", "lm", stroke=3)
    c.text(62, 162, "UHR · HAMBURG", font(SANS, 27), "#c9d1e8", "lm", stroke=2)
    c.text(1022, 92, "BLACKOUT", font(SANS, 30), "white", "rm", stroke=2)
    f = font(SANS, 32)
    c.text(1022, 140, "ALARM", f, RED, "rm", stroke=2)
    dx = 1022 - f.getlength("ALARM") / S - 24
    c.ell(dx, 140, 11, fill=RED if on else "#4a1c20", w=3)


def caption(c, txt, y=1382, size=100, maxw=930):
    f = font(ANTON, size)
    words = [[]]
    for i, part in enumerate(txt.split("**")):
        col = YEL if i % 2 else "#ffffff"
        for j, chunk in enumerate(part.split(" ")):
            if j > 0:
                words.append([])
            if chunk:
                words[-1].append((chunk, col))
    words = [w for w in words if w]
    sp = f.getlength(" ")
    wl = lambda w: sum(f.getlength(t) for t, _ in w)
    lines, cur, cw = [], [], 0
    for w in words:
        ww = wl(w)
        if cur and cw + sp + ww > maxw * S:
            lines.append((cur, cw))
            cur, cw = [], 0
        cw = ww if not cur else cw + sp + ww
        cur.append(w)
    lines.append((cur, cw))
    lh = size * 1.12
    y0 = y - lh * (len(lines) - 1) / 2
    # weicher Schatten
    sh = Image.new("L", (W * S // 2, H * S // 2), 0)
    sd = ImageDraw.Draw(sh)
    fs = font(ANTON, size / 2)
    for li, (ws, lw) in enumerate(lines):
        x = (W * S - lw) / 2 / 2
        for w in ws:
            for t, _ in w:
                sd.text((x, (y0 + li * lh + 10) * S / 2), t, font=fs, fill=230, anchor="lm")
                x += fs.getlength(t)
            x += fs.getlength(" ")
    lay = Image.new("RGBA", sh.size, (0, 0, 0, 0))
    lay.putalpha(sh.filter(ImageFilter.GaussianBlur(9)))
    c.img.alpha_composite(lay.resize(c.img.size, Image.BILINEAR))
    c.d = ImageDraw.Draw(c.img)
    for li, (ws, lw) in enumerate(lines):
        x = (W * S - lw) / 2
        for w in ws:
            for t, col in w:
                c.d.text((x, (y0 + li * lh) * S), t, font=f, fill=col, anchor="lm",
                         stroke_width=5 * S, stroke_fill=OL)
                x += f.getlength(t)
            x += sp


# ---------------------------------------------------------------- Figuren
POSES = {
    "stand": ((-135, -340, -140, -230), (135, -340, 140, -230)),
    "phone": ((-135, -340, -140, -230), (120, -330, 38, -452)),
    "radio": ((-135, -340, -140, -230), (175, -330, 165, -480)),
    "hold": ((-150, -320, -48, -385), (150, -320, 48, -385)),
    "reach": ((-135, -340, -140, -230), (185, -490, 255, -560)),
    "tap": ((-135, -340, -140, -230), (165, -330, 215, -420)),
    "think": ((-135, -340, -140, -230), (125, -330, 42, -468)),
    "candle": ((-150, -330, -60, -365), (160, -330, 200, -390)),
    "back": ((-195, -470, -255, -575), (195, -470, 255, -575)),
    "stiff": ((-150, -340, -168, -222), (150, -340, 168, -222)),
}


def draw_hair(c, hx, hy, r):
    pts = []
    n = 14
    for i in range(n + 1):
        a = math.radians(192 + 156 * i / n)
        rr = r * (1.14 if i % 2 == 0 else 0.99)
        pts.append((hx + rr * math.cos(a), hy + rr * math.sin(a)))
    fy, m = hy - r * 0.36, 8
    for j in range(m + 1):
        t = 1 - j / m
        pts.append((hx - r * 0.97 + 1.94 * r * t, fy + (r * 0.16 if j % 2 else 0)))
    c.poly(pts, fill=HAIR, w=max(5, 7 * r / 125))


def draw_face(c, hx, hy, r, expr="neutral", look=(0, 0)):
    k = r / 125
    w = max(4, 6 * k)
    ex, ey = 44 * k, hy + 14 * k
    lx, ly = look[0] * k, look[1] * k
    if expr in ("scared", "surprised", "shock"):
        er = {"scared": 24, "surprised": 27, "shock": 33}[expr] * k
        pr = {"scared": 10, "surprised": 11, "shock": 8}[expr] * k
        for sx in (-1, 1):
            c.ell(hx + sx * ex, ey, er, fill="white", w=w)
            c.ell(hx + sx * ex + lx, ey + ly, pr, fill=OL, w=0)
    else:
        for sx in (-1, 1):
            c.ell(hx + sx * ex + lx, ey + ly, 13 * k, fill=OL, w=0)
    for sx in (-1, 1):
        if expr == "scared":
            c.line([(hx + sx * (ex + 24 * k), ey - 36 * k), (hx + sx * (ex - 16 * k), ey - 54 * k)], OL, w, True)
        elif expr in ("shock", "surprised"):
            c.line([(hx + sx * (ex + 22 * k), ey - 58 * k), (hx + sx * (ex - 18 * k), ey - 66 * k)], OL, w, True)
        elif expr == "focus":
            c.line([(hx + sx * (ex + 22 * k), ey - 44 * k), (hx + sx * (ex - 14 * k), ey - 32 * k)], OL, w, True)
        elif expr == "think":
            c.line([(hx + sx * (ex + 20 * k), ey - 40 * k - (8 * k if sx > 0 else 0)),
                    (hx + sx * (ex - 16 * k), ey - 42 * k)], OL, w, True)
    my = hy + 66 * k
    if expr in ("neutral", "calm"):
        c.arc(hx, my - 24 * k, 26 * k, 30, 150, OL, w)
    elif expr in ("focus", "think"):
        c.line([(hx - 18 * k, my), (hx + 20 * k, my - 4 * k)], OL, w, True)
    elif expr == "scared":
        pts = [(hx - 26 * k + i * 13 * k, my + (5 * k if i % 2 else -5 * k)) for i in range(5)]
        c.line(pts, OL, w, True)
    elif expr == "surprised":
        c.ell(hx, my + 4 * k, 14 * k, 18 * k, fill="#5a1e1e", w=w)
    elif expr == "shock":
        c.ell(hx, my + 10 * k, 30 * k, 38 * k, fill="#5a1e1e", w=w)
        c.ell(hx, my + 28 * k, 16 * k, 10 * k, fill="#e0686a", w=0)


def draw_head(c, hx, hy, r, expr="neutral", look=(0, 0), ears=True):
    k = r / 125
    if ears:
        for sx in (-1, 1):
            c.ell(hx + sx * (r - 6 * k), hy + 12 * k, 26 * k, fill=SKIN, w=max(5, 7 * k))
    c.ell(hx, hy, r, fill=SKIN, w=max(5, 7 * k))
    draw_hair(c, hx, hy, r)
    draw_face(c, hx, hy, r, expr, look)


def draw_jonas(c, x, y, s=1.0, pose="stand", expr="neutral", look=(0, 0), arms=True):
    P = lambda dx, dy: (x + dx * s, y + dy * s)
    c.ell(*P(0, -478), 118 * s, 44 * s, fill=HOOD_D)
    for sx in (-1, 1):
        c.poly([P(sx * 6, -240), P(sx * 76, -240), P(sx * 70, -28), P(sx * 12, -28)], fill=JEANS)
        c.ell(*P(sx * 50, -20), 54 * s, 23 * s, fill=SHOE)
        c.line([P(sx * 50 - 40, -10), P(sx * 50 + 40, -10)], "#c9ccd6", 5 * s)
    c.rect(*P(-114, -490), *P(114, -205), fill=HOOD, r=55 * s)
    c.rect(*P(-66, -312), *P(66, -246), fill=HOOD_D, w=5, r=18 * s)
    for sx in (-1, 1):
        c.line([P(sx * 22, -472), P(sx * 26, -400)], "#f3f0e6", 5 * s)
        c.ell(*P(sx * 26, -396), 6 * s, fill="#f3f0e6", w=3)
    hx, hy = P(0, -605)
    draw_head(c, hx, hy, 125 * s, expr, look)
    L, R = POSES[pose]
    hands = {}
    if arms:
        for sx, (ex, ey, ax, ay), nm in ((-1, L, "L"), (1, R, "R")):
            pts = [P(sx * 92, -452), P(ex, ey), P(ax, ay)]
            c.line(pts, OL, 58 * s)
            c.line(pts, HOOD, 44 * s)
            c.ell(*pts[0], 22 * s, fill=HOOD, w=0)
            c.ell(*pts[2], 27 * s, fill=SKIN)
            hands[nm] = pts[2]
    return {"head": (hx, hy, 125 * s), **hands, "s": s}


def draw_funk(c, x, y, s=1.0, led=True, glow=True):
    bw, bh = 150 * s, 320 * s
    x0, y0, x1, y1 = x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2
    ax = x0 + 36 * s
    c.line([(ax, y0), (ax, y0 - 290 * s)], OL, 24 * s)
    c.line([(ax, y0), (ax, y0 - 290 * s)], "#34363f", 12 * s)
    c.ell(ax, y0 - 296 * s, 15 * s, fill="#34363f", w=max(3, 6 * s))
    c.rect(ax - 22 * s, y0 - 46 * s, ax + 22 * s, y0 + 10, fill="#24262d", w=max(3, 6 * s), r=6 * s)
    c.rect(x1 - 58 * s, y0 - 32 * s, x1 - 26 * s, y0 + 10, fill="#24262d", w=max(3, 6 * s), r=6 * s)
    c.rect(x0 - 18 * s, y0 + 115 * s, x0 + 4, y0 + 205 * s, fill="#2e3038", w=max(3, 6 * s), r=7 * s)
    c.rect(x0, y0, x1, y1, fill="#1b1c21", w=max(4, 8 * s), r=28 * s)
    c.line([(x0 + 15 * s, y0 + 42 * s), (x0 + 15 * s, y1 - 42 * s)], "#3d404c", 6 * s)
    c.rect(x0 + 30 * s, y0 + 70 * s, x1 - 30 * s, y0 + 128 * s, fill="#26342b", w=max(3, 5 * s), r=8 * s)
    for i in range(7):
        yy = y0 + 162 * s + i * 20 * s
        c.line([(x0 + 34 * s, yy), (x1 - 34 * s, yy)], "#08080b", 8 * s)
    c.poly([(x1 - 16 * s, y0 + 150 * s), (x1 + 11 * s, y0 + 138 * s),
            (x1 + 11 * s, y0 + 222 * s), (x1 - 16 * s, y0 + 232 * s)], fill="#ff8a2a", w=max(3, 5 * s))
    lx, ly = x1 - 36 * s, y0 + 36 * s
    if led and glow:
        c.glow(lx, ly, 90 * s, RED, 210)
    c.ell(lx, ly, 12 * s, fill="#ff3b30" if led else "#4a1515", w=max(3, 5 * s))
    if led:
        c.ell(lx - 4 * s, ly - 4 * s, 4 * s, fill="#ffd0c8", w=0)
    return {"led": (lx, ly), "ptt": (x0 - 10 * s, y0 + 160 * s), "box": (x0, y0, x1, y1)}


def draw_phone(c, x, y, w, h, screen="#cfefff"):
    c.rect(x - w / 2, y - h / 2, x + w / 2, y + h / 2, fill="#15161b", r=w * 0.16, w=max(4, w * 0.06))
    m = w * 0.08
    c.rect(x - w / 2 + m, y - h / 2 + m * 1.6, x + w / 2 - m, y + h / 2 - m * 1.6, fill=screen, w=0, r=w * 0.06)


def draw_radio(c, x, y, s=1.0, glow_speaker=False):
    c.line([(x + 200 * s, y - 140 * s), (x + 330 * s, y - 420 * s)], OL, 20 * s)
    c.line([(x + 200 * s, y - 140 * s), (x + 330 * s, y - 420 * s)], "#b9bcc6", 9 * s)
    hp = [(x - 150 * s, y - 145 * s), (x - 150 * s, y - 215 * s), (x + 150 * s, y - 215 * s), (x + 150 * s, y - 145 * s)]
    c.line(hp, OL, 34 * s)
    c.line(hp, "#2e3038", 20 * s)
    c.rect(x - 262 * s, y - 152 * s, x + 262 * s, y + 162 * s, fill=RED, r=42 * s, w=max(4, 8 * s))
    c.rect(x - 240 * s, y + 120 * s, x + 240 * s, y + 140 * s, fill="#b8302d", w=0, r=8 * s)
    sx, sy, sr = x - 112 * s, y + 8 * s, 112 * s
    if glow_speaker:
        c.glow(sx, sy, sr * 2.6, TUR, 200)
    c.ell(sx, sy, sr, fill="#1d7d8a" if glow_speaker else "#1b1c21", w=max(4, 8 * s))
    dot = "#bff7ff" if glow_speaker else "#3d404c"
    for i in range(-4, 5):
        for j in range(-4, 5):
            if i * i + j * j <= 17:
                c.ell(sx + i * 22 * s, sy + j * 22 * s, 6 * s, fill=dot, w=0)
    c.rect(x + 20 * s, y - 100 * s, x + 225 * s, y - 25 * s, fill="#f5e6b0", r=10 * s, w=max(3, 6 * s))
    for i in range(9):
        xx = x + 38 * s + i * 21 * s
        c.line([(xx, y - 88 * s), (xx, y - (68 if i % 2 else 58) * s)], "#6b5a3a", 3 * s)
    c.line([(x + 130 * s, y - 95 * s), (x + 130 * s, y - 30 * s)], RED, 5 * s)
    for kx in (x + 70 * s, x + 175 * s):
        c.ell(kx, y + 62 * s, 38 * s, fill="#2e3038", w=max(4, 7 * s))
        c.line([(kx, y + 62 * s), (kx, y + 34 * s)], "#8a8d99", 5 * s)
    px, py = x + 262 * s, y + 20 * s
    knob = (x + 345 * s, y - 70 * s)
    c.line([(px, py), knob], OL, 26 * s)
    c.line([(px, py), knob], "#8a8d99", 14 * s)
    c.ell(px, py, 18 * s, fill="#8a8d99", w=max(3, 6 * s))
    c.ell(*knob, 24 * s, fill=YEL, w=max(3, 6 * s))
    return {"knob": knob, "speaker": (sx, sy, sr)}


def draw_battery(c, x, y, pct, col, on=True):
    bw, bh = 560, 270
    x0, y0 = x - bw / 2, y - bh / 2
    c.rect(x + bw / 2 - 4, y - 55, x + bw / 2 + 42, y + 55, fill="#dfe4f2" if on or pct > 5 else "#5a2a2c", r=14, w=7)
    c.rect(x0, y0, x0 + bw, y0 + bh, fill="#0b0f1c", r=40, w=0)
    c.rect(x0, y0, x0 + bw, y0 + bh, ol=OL, r=40, w=36)
    c.rect(x0 + 6, y0 + 6, x0 + bw - 6, y0 + bh - 6, ol="#dfe4f2" if pct > 5 else (RED if on else "#5a2a2c"), r=36, w=16)
    if on:
        fw = max(24, (bw - 64) * pct / 100)
        c.rect(x0 + 32, y0 + 32, x0 + 32 + fw, y0 + bh - 32, fill=col, r=14, w=0)


def draw_candle(c, x, y, s=1.0):
    """y = Unterkante der Kerze. Gibt Flammenposition zurück."""
    c.rect(x - 22 * s, y - 110 * s, x + 22 * s, y, fill="#f3e3c3", r=6 * s, w=6)
    c.line([(x, y - 110 * s), (x, y - 126 * s)], OL, 4)
    fx, fy = x, y - 150 * s
    c.glow(fx, fy, 160 * s, "#ffb347", 200)
    c.poly([(fx, fy - 40 * s), (fx + 17 * s, fy + 2 * s), (fx, fy + 22 * s), (fx - 17 * s, fy + 2 * s)], fill=YEL, w=4)
    c.poly([(fx, fy - 14 * s), (fx + 7 * s, fy + 6 * s), (fx, fy + 15 * s), (fx - 7 * s, fy + 6 * s)], fill="#ff8a2a", w=0)
    return fx, fy


def draw_box(c, x, y, s=1.0, red_on=True, label=True):
    bw, bh = 620 * s, 400 * s
    x0, y0 = x - bw / 2, y - bh / 2
    if red_on:
        c.apoly([(x0 + 70 * s, y0), (x0 + bw - 70 * s, y0), (x0 + bw + 120 * s, y0 - 520 * s), (x0 - 120 * s, y0 - 520 * s)],
                RED, 95, blur=40)
    c.poly([(x0 + 10 * s, y0 + 4), (x0 + bw - 10 * s, y0 + 4), (x0 + bw - 40 * s, y0 - 70 * s), (x0 + 40 * s, y0 - 70 * s)],
           fill="#8e663a")
    c.line([(x0 + 60 * s, y0 - 4 * s), (x0 + bw - 60 * s, y0 - 4 * s)], "#ff6b5e" if red_on else "#3a1612", 12 * s)
    if red_on:
        c.glow(x, y0 - 6 * s, 260 * s, RED, 220)
    c.poly([(x0 - 10 * s, y0 + 10 * s), (x0 + bw + 10 * s, y0 + 10 * s), (x0 + bw + 30 * s, y0 + 70 * s), (x0 - 30 * s, y0 + 70 * s)],
           fill="#c99a5e")
    c.rect(x0, y0 + 60 * s, x0 + bw, y0 + bh, fill="#b4864f", w=8)
    c.rect(x - 50 * s, y0 + 60 * s, x + 50 * s, y0 + 190 * s, fill="#d9c08a", w=5)
    if label:
        c.text(x, y0 + 270 * s, "OPA", font(ANTON, 150 * s), "#2a1a0e")


def room(c, fy=1150, wall=WALL, floor=FLOOR, window=True):
    c.rect(0, 0, W, fy, fill=wall, w=0)
    c.rect(0, fy, W, H, fill=floor, w=0)
    c.line([(0, fy), (W, fy)], OL, 8)
    c.rect(0, fy - 28, W, fy, fill="#1b2139", w=0)
    if window:
        c.rect(70, 300, 330, 700, fill="#0d1222", w=10)
        c.line([(200, 300), (200, 700)], OL, 10)
        c.line([(70, 500), (330, 500)], OL, 10)
        random.seed(3)
        for _ in range(10):
            c.ell(random.uniform(90, 310), random.uniform(320, 680), 2.5, fill="#9aa6c8", w=0)


def window_view(c, crowd=False):
    c.rect(0, 0, W, H, fill=WALL, w=0)
    x0, y0, x1, y1 = 110, 300, 970, 1240
    inner = Cv("#151b30", "#0b0f1c")
    c.img.paste(inner.img.crop((x0 * S, y0 * S, x1 * S, y1 * S)), (x0 * S, y0 * S))
    c.d = ImageDraw.Draw(c.img)
    random.seed(5)
    for _ in range(26):
        c.ell(random.uniform(x0 + 10, x1 - 10), random.uniform(y0 + 10, 640), 2.5, fill="#8f9bbf", w=0)
    houses = [(110, 680, 300), (300, 600, 470), (470, 720, 640), (640, 560, 820), (820, 660, 970)]
    for hx0, hy0, hx1 in houses:
        c.rect(hx0, hy0, hx1, 1000, fill="#121829", w=6)
        for wy in range(hy0 + 40, 960, 90):
            for wx in range(hx0 + 25, hx1 - 40, 60):
                c.rect(wx, wy, wx + 32, wy + 46, fill="#0a0e1a", w=3, ol="#1f2742")
    c.rect(x0, 1000, x1, y1, fill="#0e1220", w=0)
    c.line([(x0, 1000), (x1, 1000)], "#1f2742", 6)
    for i in range(6):
        c.rect(150 + i * 150, 1110, 220 + i * 150, 1122, fill="#2a3150", w=0)
    for lx in (230, 560, 880):
        c.line([(lx, 1060), (lx, 820), (lx + 40, 805)], OL, 14)
        c.line([(lx, 1060), (lx, 820), (lx + 40, 805)], "#3a4160", 7)
        c.poly([(lx + 25, 800), (lx + 75, 800), (lx + 65, 822), (lx + 35, 822)], fill="#3a4160", w=5)
    if crowd:
        random.seed(11)
        people = sorted([(random.uniform(150, 900), random.uniform(1030, 1200)) for _ in range(28)], key=lambda p: p[1])
        for px, py in people:
            k = 0.6 + (py - 1030) / 300
            c.apoly([(px + 18 * k, py - 42 * k), (px + 180 * k, py - 80 * k), (px + 180 * k, py - 10 * k)], YEL, 120)
        for px, py in people:
            k = 0.6 + (py - 1030) / 300
            c.rect(px - 13 * k, py - 55 * k, px + 13 * k, py, fill="#05070d", w=3 * k, ol="#2a3150", r=8 * k)
            c.ell(px, py - 68 * k, 12 * k, fill="#05070d", w=3 * k, ol="#2a3150")
            c.ell(px + 18 * k, py - 42 * k, 5 * k, fill=YEL, w=0)
        c.glow(1000, 1100, 140, TUR, 120)
    c.rect(x0, y0, x1, y1, ol="#3a3150", w=26)
    c.rect(x0 - 12, y0 - 12, x1 + 12, y1 + 12, ol=OL, w=8)
    c.line([(540, y0), (540, y1)], "#3a3150", 22)
    c.line([(540, y0), (540, y1)], OL, 4)
    c.rect(x0 - 40, y1 + 6, x1 + 40, y1 + 50, fill="#3a3150", w=8)
    for cx, sgn in ((x0 - 20, 1), (x1 + 20, -1)):
        c.poly([(cx - 70 * sgn, y0 - 60), (cx + 90 * sgn, y0 - 60), (cx + 40 * sgn, y1 + 80), (cx - 70 * sgn, y1 + 100)],
               fill="#4a2f45")


# ---------------------------------------------------------------- Szenen
def desk_scene(c, on):
    room(c)
    if on:
        c.glow(800, 790, 470, TUR, 150)
    c.rect(560, 960, 1060, 1000, fill="#4b3a2e")
    c.rect(590, 1000, 620, 1160, fill="#3a2d24", w=6)
    c.rect(1000, 1000, 1030, 1160, fill="#3a2d24", w=6)
    c.rect(770, 920, 830, 962, fill="#22242b", w=6)
    c.rect(700, 948, 900, 966, fill="#22242b", w=6, r=6)
    c.rect(600, 630, 1000, 925, fill="#15161b", w=9, r=14)
    if on:
        c.rect(622, 652, 978, 903, fill="#4a2a7a", w=0)
        c.rect(622, 652, 978, 760, fill="#2c5e9e", w=0)
        c.poly([(622, 903), (700, 800), (780, 870), (860, 770), (978, 880), (978, 903)], fill="#1f8a7a", w=0)
        c.ell(890, 700, 26, fill=YEL, w=0)
        c.rect(700, 820, 740, 870, fill=RED, w=4)
        c.ell(720, 806, 16, fill=SKIN, w=4)
        c.rect(640, 668, 790, 686, fill="#0b0d14", w=0)
        c.rect(640, 668, 760, 686, fill="#5be37a", w=0)
    else:
        c.rect(622, 652, 978, 903, fill="#07080d", w=0)
        c.line([(640, 680), (700, 660)], "#1d2133", 6)
    j = draw_jonas(c, 330, 1250, 1.05, "hold", "focus" if on else "surprised", look=(8, 0))
    hx, hy = (j["L"][0] + j["R"][0]) / 2, j["L"][1]
    c.rect(hx - 75, hy - 30, hx + 75, hy + 25, fill="#2e3038", r=22, w=6)
    for sx in (-1, 1):
        c.ell(hx + sx * 50, hy, 26, fill=SKIN)
    c.ell(hx + 22, hy - 10, 6, fill=RED, w=0)
    if on:
        c.dark(115, [(800, 780, 420, 0), (330, 650, 260, 30)])
    else:
        c.dark(205, [(330, 700, 330, 120)])


def s1(c, on):
    room(c)
    j = draw_jonas(c, 540, 1250, 1.12, "phone", "scared", look=(0, 4))
    px, py = j["R"]
    draw_phone(c, px - 4, py - 46, 66, 118)
    c.ell(px, py, 27 * 1.12, fill=SKIN)
    hx, hy, r = j["head"]
    c.dark(222, [(hx, hy + 40, 260, 25), (px, py - 40, 120, 0)])
    c.glow(px, py - 50, 230, "#bfe9ff", 120)


def s4(c, on):
    room(c)
    c.line([(540, 0), (540, 230)], OL, 8)
    c.poly([(470, 300), (610, 300), (580, 230), (500, 230)], fill="#3a4160")
    c.ell(540, 312, 26, fill="#4a4f66")
    c.rect(745, 615, 815, 725, fill="#d8dceb", r=10)
    c.rect(767, 640, 793, 700, fill="#aab0c4", r=6, w=5)
    draw_jonas(c, 500, 1250, 1.05, "reach", "surprised", look=(8, -4))
    c.dark(165, [(560, 700, 420, 70)])
    c.text(870, 560, "?", font(ANTON, 120), YEL, stroke=4)


def s6(c, on):
    c.glow(830, 420, 120, "#dfe6ff", 90)
    c.ell(830, 420, 60, fill="#c9d1e8", w=6)
    c.ell(810, 405, 52, fill="#141a2d", w=0)
    random.seed(8)
    for _ in range(40):
        c.ell(random.uniform(20, 1060), random.uniform(220, 760), 2.5, fill="#7f8bb0", w=0)
    sil, ol2 = "#0d1222", "#2a3352"
    c.rect(0, 1030, W, H, fill="#090d19", w=0)
    for i in range(14):
        y = 1060 + i * 26
        c.line([(60 + (i * 97) % 500, y), (260 + (i * 97) % 500 + i * 10, y)], "#1a2240", 5)
    bl = [(0, 820, 120), (120, 880, 230), (900, 860, 1080), (230, 930, 300)]
    for x0, y0, x1 in bl:
        c.rect(x0, y0, x1, 1035, fill=sil, ol=ol2, w=6)
        for wy in range(y0 + 30, 1010, 45):
            for wx in range(x0 + 18, x1 - 25, 34):
                c.rect(wx, wy, wx + 14, wy + 20, fill="#070a14", w=0)
    c.poly([(150, 880), (180, 640), (210, 880)], fill=sil, ol=ol2, w=6)
    c.rect(165, 760, 195, 880, fill=sil, ol=ol2, w=6)
    c.rect(330, 900, 640, 1035, fill="#1a1414", ol=ol2, w=6)
    wave = [(330, 900)]
    for i in range(0, 31):
        xx = 330 + i * 10
        wave.append((xx, 760 - 60 * math.sin(i / 30 * math.pi * 2.2) - 25 * math.sin(i / 30 * math.pi)))
    wave.append((640, 900))
    c.poly(wave, fill="#151d33", ol=ol2, w=6)
    for k in range(4):
        c.line([(345, 820 + k * 22), (625, 820 + k * 22)], "#0b1020", 4)
    for cx, ch in ((700, 600), (830, 640), (960, 580)):
        for lx in (cx - 40, cx + 40):
            c.line([(lx, 1035), (lx, ch + 90)], ol2, 16)
            c.line([(lx, 1035), (lx, ch + 90)], sil, 8)
        c.line([(cx - 40, 960), (cx + 40, ch + 140)], ol2, 6)
        c.line([(cx - 160, ch + 90), (cx + 140, ch + 90)], ol2, 20)
        c.line([(cx - 160, ch + 90), (cx + 140, ch + 90)], sil, 12)
        c.poly([(cx - 30, ch + 90), (cx, ch), (cx + 30, ch + 90)], fill=sil, ol=ol2, w=5)
        c.line([(cx, ch), (cx - 150, ch + 90)], ol2, 4)
        c.line([(cx, ch), (cx + 130, ch + 90)], ol2, 4)
    c.line([(0, 1035), (W, 1035)], ol2, 6)


def s7(c, on):
    c.glow(540, 790, 520, "#7fb8ff", 90)
    draw_phone(c, 540, 790, 500, 920, screen="#13233f")
    c.text(345, 395, "21:47", font(SANS, 30), "white", "lm")
    for i in range(4):
        c.rect(640 + i * 22, 410 - i * 10, 655 + i * 22, 410, fill="#4a5578", w=0)
    c.line([(700, 370), (736, 406)], RED, 7)
    c.line([(736, 370), (700, 406)], RED, 7)
    c.ell(540, 700, 150, fill="#1d3156", ol="#4a5578", w=8)
    c.line([(540, 640), (540, 770)], "white", 14, True)
    c.line([(500, 770), (540, 640), (580, 770)], "white", 10, True)
    c.arc(540, 640, 50, 200, 340, "white", 9)
    c.arc(540, 640, 85, 205, 335, "white", 9)
    c.line([(430, 810), (650, 590)], RED, 18, True)
    c.text(540, 950, "Kein Netz", font(SANS, 54), "white")
    c.text(540, 1020, "Nur Notrufe", font(SANS, 30), "#8f9bbf")


def s8(c, on):
    c.glow(540, 820, 420, YEL, 60)
    draw_battery(c, 540, 820, 23, YEL)


def s9(c, on):
    room(c, window=False)
    c.rect(540, 400, 900, 1200, fill="#aeb6c6", r=26)
    c.rect(565, 425, 875, 1175, fill="#141926", r=14, w=6)
    for y in (620, 800, 980):
        c.line([(575, y), (865, y)], "#3a4160", 8)
    c.rect(600, 520, 650, 618, fill="#3a6b5a", w=5, r=8)
    c.rect(700, 700, 790, 798, fill="#c9c2b0", w=5)
    c.poly([(610, 978), (700, 978), (690, 930), (620, 930)], fill="#c9a23f", w=5)
    c.ell(820, 450, 14, fill="#3a4160", w=4)
    c.poly([(900, 400), (1050, 340), (1050, 1260), (900, 1200)], fill="#c4cbd9")
    for y in (560, 780, 1000):
        c.line([(915, y), (1035, y - 25)], "#7d8599", 8)
    c.line([(925, 700), (925, 800)], "#7d8599", 10, True)
    draw_jonas(c, 300, 1250, 1.0, "stand", "surprised", look=(9, 0))
    c.dark(150, [(600, 750, 400, 80)])


def s10(c, on):
    room(c, fy=1240, window=False)
    for x in range(0, W, 90):
        c.line([(x, 700), (x, 980)], "#1d2440", 4)
    for y in range(700, 980, 90):
        c.line([(0, y), (W, y)], "#1d2440", 4)
    draw_jonas(c, 380, 1360, 1.05, "tap", "surprised", look=(8, 4))
    c.line([(650, 985), (650, 770), (720, 770), (720, 805)], OL, 30)
    c.line([(650, 985), (650, 770), (720, 770), (720, 805)], "#b9bcc6", 18)
    c.rect(590, 935, 650, 955, fill="#b9bcc6", r=8, w=6)
    for dy, r in ((850, 14), (925, 11), (980, 8)):
        c.poly([(720, dy - r * 2.2), (720 + r, dy), (720, dy + r), (720 - r, dy)], fill=TUR, w=4)
    c.rect(-10, 980, 1090, 1030, fill="#5a6070")
    c.rect(-10, 1030, 1090, 1300, fill="#2b2f45")
    c.ell(700, 1005, 150, 16, fill="#1a1d2a", w=5)
    for x in (270, 540, 810):
        c.line([(x, 1040), (x, 1290)], OL, 6)
        c.line([(x - 40, 1150), (x - 15, 1150)], "#8a8d99", 8, True)
    c.dark(140, [(620, 850, 380, 60)])


def s11(c, on):
    room(c)
    c.rect(620, 1000, 980, 1030, fill="#4b3a2e")
    c.rect(650, 1030, 675, 1170, fill="#3a2d24", w=6)
    c.rect(925, 1030, 950, 1170, fill="#3a2d24", w=6)
    j = draw_jonas(c, 400, 1250, 1.05, "candle", "calm", look=(8, 4))
    fx, fy = draw_candle(c, 780, 1000)
    hx, hy = j["R"]
    c.line([(hx, hy), (fx - 50, fy + 5)], "#d8b98a", 8)
    c.ell(fx - 52, fy + 2, 8, fill=RED, w=3)
    c.dark(205, [(fx, fy, 470, 0), (500, 650, 260, 70)])
    c.glow(fx, fy, 430, "#ffa340", 85)


def s12(c, on, bubble="radio"):
    room(c)
    draw_jonas(c, 360, 1250, 1.05, "think", "think", look=(6, -7))
    c.ell(560, 560, 20, fill="#e9eefc")
    c.ell(625, 480, 30, fill="#e9eefc")
    for dx, dy, r in ((0, 0, 150), (-120, 30, 95), (120, 30, 95), (-60, -80, 100), (70, -80, 100), (0, 90, 110)):
        c.ell(780 + dx, 390 + dy, r, fill="#e9eefc", ol=OL, w=8)
    for dx, dy, r in ((0, 0, 150), (-120, 30, 95), (120, 30, 95), (-60, -80, 100), (70, -80, 100), (0, 90, 110)):
        c.ell(780 + dx, 390 + dy, r - 8, fill="#e9eefc", w=0)
    if bubble == "radio":
        draw_radio(c, 765, 415, 0.36)
    else:
        c.text(780, 395, bubble, font(ANTON, 200), RED, stroke=7)
    c.dark(120, [(540, 600, 500, 40)])


def s13(c, on):
    rd = draw_radio(c, 450, 840, 1.38)
    kx, ky = rd["knob"]
    for r in (120, 160):
        c.arc(kx - 40, ky + 60, r, 200, 300, YEL, 10)
    c.line([(1160, 1180), (kx + 40, ky + 40)], OL, 130)
    c.line([(1160, 1180), (kx + 40, ky + 40)], HOOD, 112)
    c.ell(kx + 12, ky + 4, 72, 62, fill=SKIN, w=8)
    for i in range(3):
        c.arc(kx - 20 + i * 26, ky - 30, 20, 180, 360, OL, 6)
    c.dark(90, [(450, 840, 600, 0)])


def s14(c, on):
    c.glow(540, 800, 520, TUR, 70)
    draw_radio(c, 520, 840, 1.2)
    for i, r in enumerate((90, 160, 230)):
        c.arc(140, 860, r, 120, 240, TUR, 14)
        c.arc(900, 860, r, -60, 60, TUR, 14)
    c.ell(880, 470, 70, fill=TUR, w=8)
    c.line([(845, 472), (872, 500), (920, 440)], "white", 16, True)


def s15(c, on):
    rd = draw_radio(c, 650, 840, 1.85, glow_speaker=True)
    sx, sy, sr = rd["speaker"]
    for r in (sr + 50, sr + 110):
        c.arc(sx, sy, r, 150, 210, TUR, 14)
        c.arc(sx, sy, r, -40, 20, TUR, 10)


def s16(c, on):
    room(c)
    c.rect(130, 820, 880, 1080, fill="#3a3350", r=40)
    c.rect(100, 1000, 910, 1160, fill="#463d60", r=30)
    c.rect(80, 930, 190, 1160, fill="#3a3350", r=30)
    c.rect(820, 930, 930, 1160, fill="#3a3350", r=30)
    j = draw_jonas(c, 480, 1180, 0.95, "stand", "scared", look=(10, 2), arms=False)
    bl = [(330, 760), (420, 735), (540, 735), (630, 760), (720, 1150), (260, 1150)]
    c.poly(bl, fill="#c9573f")
    for k in range(3):
        y = 860 + k * 95
        c.line([(310 - k * 18, y), (650 + k * 18, y)], YEL, 12)
    c.rect(950, 1000, 1080, 1022, fill="#4b3a2e")
    c.rect(985, 1022, 1005, 1160, fill="#3a2d24", w=6)
    fx, fy = draw_candle(c, 1010, 1000, 0.85)
    c.dark(200, [(fx, fy, 560, 0)])
    c.glow(fx, fy, 380, "#ffa340", 80)


def s17(c, on, handle=False):
    c.rect(0, 0, W, 1250, fill=WALL, w=0)
    c.rect(0, 1250, W, H, fill=FLOOR, w=0)
    c.line([(0, 1250), (W, 1250)], OL, 8)
    c.rect(280, 320, 800, 1255, fill="#3e2f40", w=10)
    c.rect(310, 350, 770, 1250, fill="#5a3d2b", w=8)
    c.rect(360, 420, 720, 760, fill="#4d3424", w=6, r=8)
    c.rect(360, 830, 720, 1180, fill="#4d3424", w=6, r=8)
    c.ell(540, 600, 16, fill="#c9b27a", w=5)
    c.rect(680, 780, 760, 810, fill="#c9b27a", r=12, w=6)
    if handle:
        c.rect(690, 790, 712, 850, fill="#c9b27a", r=8, w=5)
        c.poly([(680, 800), (760, 830), (752, 856), (672, 826)], fill="#c9b27a", w=6)
        for r in (70, 105):
            c.arc(700, 800, r, 20, 80, YEL, 9)
        bursts = ()
    else:
        c.rect(690, 790, 712, 850, fill="#c9b27a", r=8, w=5)
        bursts = ((880, 620, 1), (880, 880, 1), (200, 760, -1))
    for cx, cy, sgn in bursts:
        for a in (-35, 0, 35):
            rad = math.radians(a)
            x0 = cx + sgn * 20 * math.cos(rad)
            y0 = cy + 20 * math.sin(rad)
            c.line([(x0, y0), (x0 + sgn * 90 * math.cos(rad), y0 + 90 * math.sin(rad))], YEL, 14, True)
    c.dark(120, [(540, 760, 500, 40)])


def s18(c, on):
    room(c)
    c.glow(-40, 900, 520, "#ffa340", 110)
    j = draw_jonas(c, 540, 1250, 1.12, "stiff", "shock", look=(-10, 0))
    hx, hy, r = j["head"]
    c.poly([(hx + r + 10, hy - 70), (hx + r + 30, hy - 25), (hx + r + 10, hy - 10), (hx + r - 10, hy - 25)], fill=TUR, w=5)
    for sx in (-1, 1):
        for i in range(3):
            xx = hx + sx * (r + 70 + i * 22)
            c.line([(xx, hy + 120 - i * 10), (xx + sx * 10, hy + 160 - i * 10)], "#c9d1e8", 7, True)
    c.dark(185, [(540, 750, 450, 40)])


def s19(c, on):
    c.rect(0, 0, W, H, fill="#04050a", w=0)
    cx, cy, R = 540, 760, 430
    vx, vy = 540, 720
    c.poly([(cx - R, cy - R), (cx + R, cy - R), (vx + 70, vy - 90), (vx - 70, vy - 90)], fill="#141a2b", w=4)
    c.poly([(cx - R, cy + R), (cx + R, cy + R), (vx + 70, vy + 90), (vx - 70, vy + 90)], fill="#0b0f1a", w=4)
    c.poly([(cx - R, cy - R), (vx - 70, vy - 90), (vx - 70, vy + 90), (cx - R, cy + R)], fill="#10152a", w=4)
    c.poly([(cx + R, cy - R), (vx + 70, vy - 90), (vx + 70, vy + 90), (cx + R, cy + R)], fill="#0e1324", w=4)
    c.rect(vx - 70, vy - 90, vx + 70, vy + 90, fill="#06080f", w=4, ol="#1c2236")
    c.poly([(cx - R + 120, cy - 260), (vx - 160, vy - 70), (vx - 160, vy + 80), (cx - R + 120, cy + 300)], fill="#151b31", ol="#1c2236", w=5)
    c.poly([(cx + R - 120, cy - 260), (vx + 160, vy - 70), (vx + 160, vy + 80), (cx + R - 120, cy + 300)], fill="#141a2f", ol="#1c2236", w=5)
    c.ell(vx, vy - 150, 22, 10, fill="#1c2236", w=3)
    L = 4
    m = Image.new("L", (W // L, H // L), 255)
    ImageDraw.Draw(m).ellipse([(cx - R) / L, (cy - R) / L, (cx + R) / L, (cy + R) / L], fill=0)
    m = m.filter(ImageFilter.GaussianBlur(3))
    lay = Image.new("RGBA", m.size, (4, 5, 10, 0))
    lay.putalpha(m)
    c._layer(lay)
    c.dark(0, [(cx, cy, R * 0.9, 0)])
    lay = Image.new("RGBA", (W // L, H // L), (0, 0, 0, 0))
    mm = Image.new("L", lay.size, 0)
    ImageDraw.Draw(mm).ellipse([(cx - R) / L, (cy - R) / L, (cx + R) / L, (cy + R) / L], fill=170)
    ImageDraw.Draw(mm).ellipse([(cx - R * 0.8) / L, (cy - R * 0.8) / L, (cx + R * 0.8) / L, (cy + R * 0.8) / L], fill=0)
    lay.putalpha(mm.filter(ImageFilter.GaussianBlur(14)))
    c._layer(lay)
    c.ell(cx, cy, R, ol="#2a3150", w=26)
    c.ell(cx, cy, R + 14, ol=OL, w=8)
    c.arc(cx, cy, R - 40, 200, 250, "#5a6488", 10)


def s20(c, on):
    room(c, fy=1180)
    draw_box(c, 540, 980, 1.0, red_on=on)
    c.dark(175, [(540, 820, 420, 60 if on else 120)])
    if on:
        c.glow(540, 760, 300, RED, 130)


def s21(c, on):
    c.rect(0, 0, W, H, fill="#121629", w=0)
    c.poly([(240, 560), (840, 560), (1010, 400), (70, 400)], fill="#c99a5e")
    c.poly([(240, 1150), (840, 1150), (1000, 1290), (80, 1290)], fill="#b4864f")
    c.poly([(240, 560), (240, 1150), (70, 1300), (40, 450)], fill="#a77a45")
    c.poly([(840, 560), (840, 1150), (1010, 1300), (1040, 450)], fill="#a77a45")
    c.rect(240, 560, 840, 1150, fill="#3a2716", w=8)
    c.poly([(260, 1150), (360, 980), (480, 1150)], fill="#d8cdb2", w=5)
    c.poly([(640, 1150), (760, 1010), (830, 1150)], fill="#d8cdb2", w=5)
    c.rect(640, 640, 800, 760, fill="#e9e4d6", w=6)
    c.rect(655, 655, 785, 725, fill="#6b7a8f", w=0)
    if on:
        c.glow(540, 860, 360, RED, 90)
    draw_funk(c, 500, 900, 1.05, led=on)
    c.dark(120, [(520, 820, 400, 30)])


def s22(c, on):
    room(c)
    j = draw_jonas(c, 540, 1260, 1.12, "hold", "surprised", look=(0, 8))
    hx, hy = (j["L"][0] + j["R"][0]) / 2, j["L"][1]
    draw_funk(c, hx, hy + 70, 0.6, led=on)
    for sx in (-1, 1):
        c.ell(hx + sx * 50, hy + 90, 27 * 1.12, fill=SKIN)
    c.dark(170, [(540, 650, 380, 50)])
    if on:
        c.glow(hx + 23, hy + 70 - 96 + 22, 140, RED, 130)


def s23(c, on):
    c.line([(320, 380), (320, 120)], OL, 40)
    c.line([(320, 380), (320, 120)], "#34363f", 22)
    c.rect(220, 360, 860, 1250, fill="#1b1c21", r=60, w=10)
    c.poly([(860, 640), (900, 625), (900, 800), (860, 815)], fill="#ff8a2a", w=6)
    c.rect(310, 480, 770, 1140, fill="#08080b", r=20, w=8, ol="#3d404c")
    for x0 in (350, 560):
        c.rect(x0, 520, x0 + 170, 1100, fill="#0f1016", r=14, w=4, ol="#2a2c33")
        for y in range(560, 1080, 50):
            c.line([(x0 + 85, y), (x0 + 85, y + 24)], "#4a4f66", 6)
        zz = [(x0 + 50 + (i % 2) * 70, 1050 + i * 9) for i in range(5)]
        c.line(zz, "#c9ccd6", 7)
        c.rect(x0 + 55, 535, x0 + 115, 552, fill="#c9ccd6", r=4, w=3)
    c.poly([(870, 1100), (1060, 1040), (1100, 1320), (920, 1380)], fill="#1b1c21", w=8)
    c.text(540, 810, "LEER", font(ANTON, 110), RED, stroke=6)


def s24(c, on):
    funk_waves(c, True, (YEL, RED, YEL))


def funk_waves(c, led, cols):
    f = draw_funk(c, 540, 870, 1.45, led=led)
    for sgn in (-1, 1):
        for i, col in enumerate(cols):
            bx = 540 + sgn * (190 + i * 85)
            pts = [(bx + sgn * (18 if k % 2 else -18) + sgn * abs(k - 3) * -8, 640 + k * 75) for k in range(7)]
            c.line(pts, OL, 22)
            c.line(pts, col, 12)


def s25(c, on):
    c.rect(0, 0, W, H, fill="#2a0f18", w=0)
    for i in range(36):
        a = math.radians(i * 10)
        r0, r1 = 520, 1300
        col = YEL if i % 2 else "#5a1f2a"
        c.poly([(540 + r0 * math.cos(a), 820 + r0 * math.sin(a)),
                (540 + r1 * math.cos(a - 0.04), 820 + r1 * math.sin(a - 0.04)),
                (540 + r1 * math.cos(a + 0.04), 820 + r1 * math.sin(a + 0.04))], fill=col, w=0)
    c.rect(100, 1230, 980, 1950, fill=HOOD, r=200, w=12)
    draw_head(c, 540, 800, 410, "shock", ears=True)
    for dx, dy in ((-470, -120), (480, -60), (440, 160)):
        x, y = 540 + dx, 800 + dy
        c.poly([(x, y - 60), (x + 28, y), (x, y + 26), (x - 28, y)], fill=TUR, w=7)
    c.apoly([(0, 1260), (W, 1260), (W, 1510), (0, 1510)], "#05060c", 200, blur=40)


def s26(c, on):
    c.rect(60, 260, 1020, 1240, fill="#202945", r=30, w=10)
    random.seed(4)
    for _ in range(26):
        x, y = random.uniform(90, 990), random.uniform(290, 1210)
        c.line([(x, y), (x + random.uniform(-160, 160), y + random.uniform(-90, 90))], "#2c3658", 6)
    c.rect(80, 990, 1000, 1225, fill="#1a2238", w=0)
    for i in range(5):
        c.rect(150 + i * 160, 1060, 230 + i * 160, 1110, fill="#2a3352", w=4)
    river = [(60, 720), (250, 770), (420, 830), (600, 815), (780, 870), (1020, 940)]
    c.line(river, OL, 130)
    c.line(river, "#2b7891", 112)
    c.line(river, "#3fa7c0", 30)
    c.text(830, 800, "ELBE", font(SANS, 38), "white", stroke=3)
    c.text(330, 450, "HAMBURG", font(ANTON, 90), "#c9d1e8", stroke=4)
    c.text(380, 650, "ST. PAULI", font(SANS, 30), "#8f9bbf", stroke=3)
    c.text(400, 1000, "HAFEN", font(SANS, 30), "#8f9bbf", stroke=3)
    for i in range(6):
        c.line([(455 + i * 2, 720 + i * 40), (457 + i * 2, 742 + i * 40)], YEL, 8)
    tx, ty = 470, 830
    if on:
        c.glow(tx, ty, 180, RED, 160)
    col = RED if on else "#6a2a2c"
    for a, b in (((tx - 70, ty - 70), (tx + 70, ty + 70)), ((tx + 70, ty - 70), (tx - 70, ty + 70))):
        c.line([a, b], OL, 46, True)
        c.line([a, b], col, 30, True)
    c.rect(560, 905, 820, 960, fill="#0f1424", r=12, w=5, ol=col)
    c.text(690, 933, "ELBTUNNEL", font(SANS, 30), "white")


def s27(c, on):
    window_view(c, crowd=True)
    c.dark(60, [(540, 1100, 400, 0)])


def s28(c, on):
    c.rect(0, 0, W, 900, fill="#151b30", w=0)
    c.rect(0, 900, W, H, fill="#0a0d18", w=0)
    c.glow(540, 880, 300, TUR, 120)
    c.line([(200, 880), (880, 880)], TUR, 8)
    c.line([(320, 900), (760, 900)], "#2b7891", 6)
    random.seed(21)
    rows = [(930, 0.35, 14), (1010, 0.55, 10), (1120, 0.8, 7), (1270, 1.15, 5)]
    for y, k, n in rows:
        for i in range(n):
            x = (i + 0.5) * W / n + random.uniform(-25, 25)
            c.apoly([(x + 40 * k, y - 60 * k), (540 - 60 + (x - 540) * 0.15, 880), (540 + 60 + (x - 540) * 0.15, 880)], YEL, 55)
    for y, k, n in rows:
        random.seed(int(y))
        for i in range(n):
            x = (i + 0.5) * W / n + random.uniform(-25, 25)
            c.rect(x - 70 * k, y - 80 * k, x + 70 * k, y + 120 * k, fill="#04060c", ol="#1f2742", w=5 * k + 2, r=50 * k)
            c.ell(x, y - 120 * k, 46 * k, fill="#04060c", ol="#1f2742", w=5 * k + 2)
            c.ell(x + 40 * k, y - 60 * k, 9 * k, fill=YEL, w=0)


def s29(c, on):
    c.rect(0, 0, W, H, fill="#2c0b10", w=0)
    c.glow(540, 820, 700, "#5a0f18", 180)
    for r in (420, 520, 620):
        c.ell(540, 820, r, ol="#4a141c", w=10)
    draw_funk(c, 540, 880, 1.6, led=on)
    if on:
        c.glow(540 + 45, 880 - 256 + 58, 260, RED, 150)


def s30(c, on):
    room(c, window=False)
    c.rect(0, 0, 160, 1150, fill="#1b2139", w=0)
    c.line([(160, 0), (160, 1150)], OL, 8)
    draw_funk(c, 860, 1110, 0.42, led=True)
    draw_jonas(c, 420, 1250, 1.1, "back", "shock", look=(12, 0))
    for i in range(5):
        y = 640 + i * 80
        c.line([(700, y), (820 - i * 10, y)], "#c9d1e8", 9, True)
    c.dark(175, [(460, 700, 420, 50), (860, 1060, 150, 0)])


def s31(c, on, pct=4):
    c.glow(540, 820, 420, RED, 70 if on else 20)
    draw_battery(c, 540, 820, pct, RED, on)
    if on:
        c.text(540, 1080, "AKKU FAST LEER", font(SANS, 40), RED, stroke=3)


def s32(c, on, pressed=False):
    f = draw_funk(c, 600, 880, 1.5, led=True)
    px, py = f["ptt"]
    tip = px - 24 if pressed else px - 60
    c.line([(-80, 1200), (230, 990)], OL, 140)
    c.line([(-80, 1200), (230, 990)], HOOD, 122)
    c.ell(250, 965, 80, 70, fill=SKIN, w=8)
    c.line([(290, 920), (tip, py)], OL, 58, True)
    c.line([(290, 920), (tip, py)], SKIN, 42, True)
    c.ell(tip, py, 21, fill="#f7d6b8", w=0)
    if pressed:
        for a in range(200, 340, 35):
            rad = math.radians(a)
            c.line([(px + 70 * math.cos(rad), py + 70 * math.sin(rad)),
                    (px + 125 * math.cos(rad), py + 125 * math.sin(rad))], YEL, 11, True)
    else:
        c.line([(px - 95, py - 70), (px - 115, py - 105)], YEL, 9, True)
        c.line([(px - 30, py - 70), (px - 10, py - 105)], YEL, 9, True)
        c.line([(px - 62, py - 75), (px - 62, py - 115)], YEL, 9, True)


def s33(c, on):
    c.rect(0, 0, 540, H, fill="#0f2a33", w=0)
    c.rect(540, 0, W, H, fill="#33121a", w=0)
    for side, cx, col, led in ((0, 270, TUR, True), (1, 810, RED, False)):
        if led:
            for r in (60, 100):
                c.arc(cx + 5, 770, r, -70, 10, TUR, 9)
        j = draw_jonas(c, cx, 1250, 0.72, "hold", "focus" if led else "scared", look=(0, 8))
        hx, hy = (j["L"][0] + j["R"][0]) / 2, j["L"][1]
        hy += 55
        f = draw_funk(c, hx, hy - 20, 0.42, led=led)
        for sx in (-1, 1):
            c.ell(hx + sx * 36, hy + 10, 20, fill=SKIN)
        if led:
            c.ell(hx - 40, hy - 10, 12, fill=YEL, w=4)
        else:
            c.ell(hx + 105, hy - 110, 38, fill="#1b1c21", ol=RED, w=7)
            c.arc(hx + 105, hy - 110, 20, 300, 240, RED, 6)
            c.line([(hx + 105, hy - 138), (hx + 105, hy - 110)], RED, 6)
        c.text(cx, 440, "AB"[side], font(ANTON, 300), col, stroke=8)
        c.text(cx, 610, "ANTWORTEN" if led else "AUSSCHALTEN", font(SANS, 34), "white", stroke=3)
    c.line([(540, 0), (540, H)], OL, 20)
    c.line([(540, 0), (540, H)], YEL, 10)


def s34_factory(count, clock="23:13"):
    def s34(c, on):
        if on:
            c.glow(540, 600, 400, RED, 110)
        c.text(540, 600, clock, font(MONO, 230), RED if on else "#7a2326", stroke=8)
        c.ell(540, 990, 170, fill="#141a2d", ol=YEL, w=14)
        c.text(540, 990, str(count), font(ANTON, 240), YEL, stroke=6)
    return s34


def s35(c, on, title="TEIL 2 FOLGT…"):
    c.glow(540, 900, 480, TUR, 60)
    c.rect(100, 720, 980, 1120, fill="#0f1a2a", ol=OL, r=36, w=22)
    c.rect(100, 720, 980, 1120, ol=TUR, r=36, w=10)
    c.text(540, 870, title, font(ANTON, 128), TUR, stroke=5)
    c.text(540, 1030, "Schreib A oder B", font(SANS, 50), "white", stroke=3)


# ---------------------------------------------------------------- Teil 2: neue Bilder
def t2_chose_a(c, on):
    s33(c, on)
    c.apoly([(545, 0), (W, 0), (W, H), (545, H)], "#000000", 175)
    c.ell(410, 330, 62, fill=TUR, w=8)
    c.line([(378, 332), (402, 358), (445, 302)], "white", 15, True)


def t2_talk(c, on):
    room(c)
    j = draw_jonas(c, 540, 1250, 1.12, "radio", "focus", look=(8, 2))
    px, py = j["R"]
    draw_funk(c, px + 8, py - 70, 0.55, led=on, glow=False)
    c.ell(px, py, 27 * 1.12, fill=SKIN)
    hx, hy, r = j["head"]
    for rr in (40, 70):
        c.arc(hx + 60, hy + 66, rr, -40, 40, YEL, 9)
    c.dark(150, [(600, 660, 400, 20)])
    if on:
        c.glow(px + 30, py - 138, 130, RED, 150)


def t2_endlich(c, on):
    c.glow(540, 860, 560, TUR, 80)
    draw_funk(c, 540, 870, 1.45, led=on)
    for r in (300, 380, 460):
        c.arc(540, 820, r, 150, 210, TUR, 14)
        c.arc(540, 820, r, -30, 30, TUR, 14)


def t2_water(c, on, check=False):
    c.glow(540, 860, 480, TUR, 55)
    for i in range(5):
        x = 200 + i * 170
        c.rect(x - 22, 650, x + 22, 690, fill=RED, r=8, w=6)
        c.rect(x - 34, 680, x + 34, 720, fill="#2b7891", r=10, w=6)
        c.rect(x - 62, 715, x + 62, 1080, fill="#1f5f73", r=34, w=8)
        c.rect(x - 52, 790, x + 52, 1070, fill="#3fa7c0", r=26, w=0)
        c.rect(x - 62, 880, x + 62, 950, fill="#e9eefc", w=6)
        c.text(x, 916, "2 L", font(ANTON, 50), "#1f5f73")
        c.line([(x - 35, 760), (x - 35, 860)], "#bff7ff", 8, True)
    c.text(540, 500, "2 L × 10 TAGE", font(ANTON, 120), YEL, stroke=7)
    c.text(540, 1160, "pro Person · Empfehlung BBK", font(SANS, 36), "#c9d1e8", stroke=3)
    if check:
        c.ell(900, 330, 75, fill=TUR, w=9)
        c.line([(860, 333), (890, 365), (945, 295)], "white", 18, True)


def draw_opa(c, x, y, r):
    k = r / 125
    for sx in (-1, 1):
        c.ell(x + sx * (r - 6 * k), y + 12 * k, 26 * k, fill=SKIN)
    c.ell(x, y, r, fill=SKIN)
    for sx in (-1, 1):
        c.ell(x + sx * 95 * k, y - 35 * k, 40 * k, 55 * k, fill="#d5d8e0", w=6 * k)
        c.line([(x + sx * 70 * k, y - 30 * k), (x + sx * 20 * k, y - 38 * k)], "#d5d8e0", 14 * k, True)
        c.ell(x + sx * 45 * k, y + 5 * k, 30 * k, ol=OL, w=6 * k)
        c.ell(x + sx * 45 * k, y + 5 * k, 9 * k, fill=OL, w=0)
    c.line([(x - 15 * k, y + 5 * k), (x + 15 * k, y + 5 * k)], OL, 6 * k)
    c.poly([(x - 55 * k, y + 60 * k), (x, y + 42 * k), (x + 55 * k, y + 60 * k), (x, y + 75 * k)], fill="#d5d8e0", w=5 * k)
    c.arc(x, y + 70 * k, 22 * k, 30, 150, OL, 5 * k)
    for i in range(3):
        c.line([(x - 70 * k + i * 10 * k, y - 85 * k - i * 6 * k), (x + 60 * k - i * 10 * k, y - 85 * k - i * 6 * k)], "#e8c4a4", 4 * k)


def t2_photo(c, on):
    room(c, window=False)
    c.rect(120, 1000, 1000, 1040, fill="#4b3a2e")
    c.rect(140, 1040, 980, 1160, fill="#3a2d24", w=6)
    c.rect(290, 420, 790, 1000, fill="#6b4a2e", w=10)
    c.rect(330, 460, 750, 960, fill="#d9cfb8", w=5)
    c.rect(365, 495, 715, 925, fill="#5d6b7a", w=5)
    c.rect(415, 800, 665, 925, fill="#6b5240", r=60, w=7)
    c.poly([(510, 800), (540, 860), (570, 800)], fill="#e9eefc", w=5)
    draw_opa(c, 540, 690, 115)
    c.poly([(650, 420), (790, 420), (790, 560)], fill="#05060a", ol=OL, w=6)
    c.poly([(700, 420), (790, 420), (790, 510)], fill="#1b1c21", w=0)
    fx, fy = draw_candle(c, 900, 1000, 0.9)
    c.dark(200, [(640, 720, 460, 30), (fx, fy, 300, 0)])
    c.glow(fx, fy, 360, "#ffa340", 80)


def t2_candle_out(c, on):
    room(c)
    c.rect(620, 1000, 980, 1030, fill="#4b3a2e")
    c.rect(650, 1030, 675, 1170, fill="#3a2d24", w=6)
    c.rect(925, 1030, 950, 1170, fill="#3a2d24", w=6)
    draw_jonas(c, 400, 1250, 1.05, "stand", "scared", look=(8, 2))
    c.rect(758, 890, 802, 1000, fill="#f3e3c3", r=6, w=6)
    c.line([(780, 890), (780, 872)], OL, 5)
    smoke = [(780 + 18 * math.sin(i * 0.9), 865 - i * 32) for i in range(10)]
    c.line(smoke, "#8a8d99", 9)
    c.dark(222, [(780, 760, 260, 110), (400, 650, 260, 150)])


def t2_eyes(c, on):
    c.rect(0, 0, W, H, fill="#020306", w=0)
    for x in (430, 650):
        c.ell(x, 800, 52, fill="#e9eefc", w=6)
        c.ell(x + 18, 805, 16, fill=OL, w=0)
    c.poly([(760, 690), (782, 735), (760, 752), (738, 735)], fill=TUR, w=5)


def t2_doorgap(c, on):
    c.rect(0, 0, W, 1150, fill="#2e2018", w=0)
    for x in (140, 540, 940):
        c.rect(x - 160, 120, x + 160, 1080, fill="#281b14", ol="#1a110c", w=8, r=10)
    c.rect(0, 1150, W, H, fill="#0d0f18", w=0)
    c.apoly([(0, 1172), (W, 1172), (W + 300, 1600), (-300, 1600)], YEL, 70, blur=50)
    for x0 in (360, 600):
        c.apoly([(x0, 1172), (x0 + 110, 1172), (x0 + 170, 1600), (x0 - 60, 1600)], "#000000", 200, blur=20)
    c.glow(540, 1162, 380, YEL, 150)
    c.rect(0, 1150, W, 1174, fill="#fff1b8", w=0)
    for x0 in (360, 600):
        c.rect(x0, 1150, x0 + 110, 1174, fill="#05060a", w=0)
    c.line([(0, 1148), (W, 1148)], OL, 8)
    c.ell(820, 620, 22, fill="#c9b27a", w=6)
    c.dark(60)


def t2_choice(c, on):
    c.rect(0, 0, 540, H, fill="#0f2a33", w=0)
    c.rect(540, 0, W, H, fill="#33121a", w=0)
    c.rect(300, 690, 520, 1240, fill="#5a3d2b", w=8)
    c.rect(330, 730, 490, 960, fill="#4d3424", w=5, r=6)
    c.rect(318, 980, 360, 1000, fill="#c9b27a", r=8, w=5)
    draw_jonas(c, 185, 1250, 0.62, "tap", "scared", look=(8, 0))
    c.rect(640, 600, 1030, 1010, fill="#0d1222", w=10)
    c.ell(930, 700, 32, fill="#c9d1e8", w=5)
    random.seed(9)
    for _ in range(12):
        c.ell(random.uniform(660, 1010), random.uniform(620, 990), 2.5, fill="#9aa6c8", w=0)
    c.line([(835, 600), (835, 1010)], OL, 10)
    c.line([(640, 805), (1030, 805)], OL, 10)
    draw_jonas(c, 780, 1250, 0.62, "reach", "focus", look=(8, -6))
    for cx, lab, sub, col in ((270, "A", "TÜR AUF", TUR), (810, "B", "FENSTER", RED)):
        c.text(cx, 400, lab, font(ANTON, 260), col, stroke=8)
        c.text(cx, 560, sub, font(SANS, 38), "white", stroke=3)
    c.line([(540, 0), (540, H)], OL, 20)
    c.line([(540, 0), (540, H)], YEL, 10)


# ---------------------------------------------------------------- Skripte
# Nr, Dauer, Zeichenfunktion (None = Countdown), Text, Effekt, Bewegungs-Prompt für Bild-zu-Video-KI
# "*" am Anfang des Prompts = lohnt sich besonders für KI-Bewegung.
SCENES1 = [
    (1, 1.5, s1, "**BLACKOUT** HAMBURG", "", "*The boy slowly raises his eyes from the phone, frightened, phone light flickers softly on his face"),
    (2, 1.0, lambda c, on: desk_scene(c, True), "21:47 UHR", "", "*The boy presses buttons on the gamepad, game on the monitor moves, screen glow pulses"),
    (3, 1.0, lambda c, on: desk_scene(c, False), "**ZACK.**", "SHAKE", "Camera shakes once, the boy flinches"),
    (4, 1.0, s4, "NICHTS.", "", "*The boy flips the light switch twice, nothing happens, he tilts his head"),
    (5, 1.0, lambda c, on: window_view(c), "DIE **STRASSE**…", "", "Slow push-in through the window, curtains sway slightly, stars twinkle"),
    (6, 1.5, s6, "GANZ **HAMBURG**.", "", "*Slow pan across the dark skyline, water ripples gently, moon glows"),
    (7, 1.0, s7, "KEIN **NETZ**.", "", "Phone screen flickers, red X pulses"),
    (8, 1.0, s8, "**23 %**", "", "Battery icon pulses softly"),
    (9, 1.0, s9, "KÜHLSCHRANK **AUS**.", "", "Fridge door swings open a little more, the boy leans forward"),
    (10, 1.0, s10, "**TROPFEN.**", "", "*Single water drops fall from the tap, the boy turns the handle"),
    (11, 1.0, s11, "RUHIG **BLEIBEN**.", "", "*Candle flame flickers and lights up, warm light spreads, the boy breathes out"),
    (12, 1.0, s12, "DIE **REGEL**:", "", "Thought bubble pops up and wobbles, the boy looks up"),
    (13, 1.5, s13, "**RADIO** AN.", "", "*The hand cranks the radio handle in circles"),
    (14, 1.0, s14, "ECHTE **REGEL**!", "", "Turquoise sound waves pulse outward from the radio"),
    (15, 1.0, s15, "BLEIBT **ZUHAUSE**.", "", "Speaker glows and vibrates with turquoise light"),
    (16, 1.0, s16, "**23:12**", "", "*Candle flickers, the boy pulls the blanket tighter"),
    (17, 1.0, s17, "**KLOPF.**", "SHAKE", "*The door shakes slightly from knocking"),
    (18, 1.0, s18, "WER… **DA**?", "", "*The boy freezes and trembles, eyes widen"),
    (19, 1.0, s19, "**NIEMAND.**", "", "Fisheye view drifts slowly down the empty dark hallway"),
    (20, 1.0, s20, "OPAS **KISTE**.", "BLINK", "*Red light pulses through the gap of the cardboard box"),
    (21, 1.0, s21, "DAS **FUNKGERÄT**.", "BLINK", "Red LED on the walkie-talkie blinks, slow push-in"),
    (22, 1.0, s22, "ES IST **AN**.", "BLINK", "*The boy lifts the walkie-talkie closer, red LED blinks"),
    (23, 1.5, s23, "**KEINE** BATTERIEN.", "", "Slow push-in into the empty battery compartment"),
    (24, 1.0, s24, "HÖRT MICH **JEMAND**?", "SHAKE", "*Walkie-talkie vibrates, zigzag sound waves pulse"),
    (25, 1.0, s25, "**WAS?!**", "SHAKE", "*The face reacts in shock, sweat drops fly, rays pulse"),
    (26, 1.5, s26, "NICHT ZUM **ELBTUNNEL**!", "BLINK", "Red X on the map pulses, river shimmers"),
    (27, 1.0, s27, "ALLE **GEHEN**…", "", "*Tiny people with flashlights walk to the right through the street"),
    (28, 1.0, s28, "…ZUM **TUNNEL**.", "", "*Crowd walks away from camera toward the river, flashlight beams sway"),
    (29, 1.5, s29, "SIE **WISSEN** ES.", "BLINKFAST", "Red LED blinks fast, red light pulses"),
    (30, 1.0, s30, "**WOHER?!**", "SHAKE", "*The boy presses himself against the wall and slides back"),
    (31, 1.0, s31, "**4 %**", "BLINK", "Battery outline blinks red"),
    (32, 1.0, s32, "**ANTWORTEN**?", "", "*Finger hovers and trembles above the side button"),
    (33, 2.0, s33, "A ODER **B**?", "", "Both sides: subtle movement, letters A and B pulse"),
    (34, 1.5, None, "**DU** ENTSCHEIDEST.", "BLINK", "Red clock pulses (use original, countdown is rendered)"),
    (35, 2.5, lambda c, on: s35(c, on, "TEIL 2 FOLGT…"), None, "", "Box glows softly (use original)"),
]

SCENES2 = [
    (1, 1.5, s29, "**TEIL 2**", "BLINK", "Red LED blinks, red light pulses"),
    (2, 1.0, t2_chose_a, "**A**: DU ANTWORTEST.", "", "Left side glows, checkmark pops"),
    (3, 1.0, lambda c, on: s32(c, on, pressed=True), "**KLICK.**", "SHAKE", "*Finger presses the side button firmly"),
    (4, 1.5, t2_talk, "HALLO? **WER** DA?", "", "*The boy speaks into the walkie-talkie, mouth moves, sound arcs pulse"),
    (5, 1.0, lambda c, on: funk_waves(c, True, ("#8a8d99", "#5a6070", "#8a8d99")), "**RAUSCHEN…**", "", "Grey static waves flicker around the device"),
    (6, 1.0, t2_endlich, "**ENDLICH.**", "", "*Turquoise sound waves pulse out of the walkie-talkie"),
    (7, 1.0, s22, "DU **HÖRST** MICH?!", "", "*The boy pulls the walkie-talkie closer, surprised"),
    (8, 1.5, s26, "DER TUNNEL IST EINE **FALLE**.", "BLINK", "Red X pulses, river shimmers"),
    (9, 1.0, s27, "ABER **ALLE** GEHEN HIN…", "", "*Tiny people with flashlights walk to the right"),
    (10, 1.0, lambda c, on: funk_waves(c, on, (RED, YEL, RED)), "BLEIB **DRIN**.", "BLINK", "Walkie-talkie vibrates, waves pulse"),
    (11, 1.5, t2_water, "**2 LITER** PRO TAG.", "", "Water in the bottles sloshes gently"),
    (12, 1.0, lambda c, on: t2_water(c, on, check=True), "ECHTE **REGEL**!", "", "Checkmark pops in"),
    (13, 1.0, lambda c, on: s31(c, on, 2), "**2 %**", "BLINK", "Battery outline blinks red"),
    (14, 1.0, lambda c, on: s12(c, on, "?"), "WER **BIST** DU?", "", "Thought bubble wobbles, the boy looks up"),
    (15, 1.5, s29, "ICH BIN'S. **OPA.**", "BLINK", "*Red LED blinks slowly, light breathes, slow push-in"),
    (16, 1.0, s25, "**OPA?!**", "SHAKE", "*The face reacts in shock, sweat drops fly"),
    (17, 1.5, t2_photo, "OPA IST SEIT **3 JAHREN** TOT.", "", "*Candle flickers, slow push-in to the old photo"),
    (18, 1.0, s17, "**KLOPF. KLOPF.**", "SHAKE", "*The door shakes from knocking"),
    (19, 1.0, lambda c, on: s17(c, on, handle=True), "DIE **KLINKE**…", "SHAKE", "*The door handle slowly moves down"),
    (20, 1.0, lambda c, on: funk_waves(c, on, (RED, RED, RED)), "NICHT **AUFMACHEN**!", "BLINK", "Walkie-talkie vibrates hard"),
    (21, 1.0, lambda c, on: s31(c, on, 1), "**1 %**", "BLINK", "Battery outline blinks red"),
    (22, 1.0, t2_candle_out, "KERZE **AUS**.", "", "*Thin smoke rises from the candle wick"),
    (23, 1.0, t2_eyes, "**STILLE.**", "", "*Eyes in the dark blink and look sideways"),
    (24, 1.0, t2_doorgap, "LICHT UNTER DER **TÜR**.", "", "*Light under the door moves, shadows of two feet shift"),
    (25, 1.5, t2_endlich, "DAS **FENSTER**. JETZT.", "BLINK", "Turquoise waves pulse"),
    (26, 2.0, t2_choice, "A ODER **B**?", "", "Both sides: subtle movement, letters pulse"),
    (27, 1.5, None, "**DU** ENTSCHEIDEST.", "BLINK", "Red clock pulses (use original)"),
    (28, 2.5, lambda c, on: s35(c, on, "TEIL 3 FOLGT…"), None, "", "Box glows softly (use original)"),
]

VOICE1 = {
    1: "Blackout in Hamburg. Was würdest du tun?", 2: "Du zockst gerade.", 3: "Zack.", 4: "Licht? Nichts.",
    5: "Die ganze Straße…", 6: "…ganz Hamburg ist dunkel.", 7: "Dein Handy: kein Netz.", 8: "Noch 23 Prozent.",
    9: "Der Kühlschrank ist aus.", 10: "Das Wasser wird weniger.", 11: "Okay. Ruhig bleiben.",
    12: "Erste Regel bei Stromausfall:", 13: "Batterie- oder Kurbelradio an.",
    14: "Das empfiehlt sogar der Katastrophenschutz.", 15: "(Radiostimme) Bleiben Sie zu Hause.",
    16: "Eine Stunde später.", 18: "Wer klopft um diese Zeit?", 19: "Niemand.", 20: "Dann – aus Opas alter Kiste…",
    21: "…das alte Funkgerät.", 22: "Es ist an.", 23: "Aber da sind keine Batterien drin.",
    24: "(Funkstimme) Hört mich jemand?", 26: "(Funkstimme) Geht nicht zum Elbtunnel!", 27: "Aber draußen gehen alle…",
    28: "…genau dahin.", 29: "(Funkstimme, flüsternd) Sie wissen, dass du zuhörst.", 30: "Woher?!",
    31: "Noch 4 Prozent.", 32: "Antwortest du?", 33: "A: Du antwortest. B: Du schaltest es aus.",
    34: "Du entscheidest.", 35: "Schreib A oder B in die Kommentare.",
}

VOICE2 = {
    1: "Teil 2.", 2: "Du drückst die Taste.", 3: "Klick.", 4: "Hallo? Wer ist da?",
    6: "(Funkstimme) Endlich.", 7: "Du hörst mich?!", 8: "(Funkstimme) Der Tunnel ist eine Falle.",
    9: "Aber alle gehen hin…", 10: "(Funkstimme) Bleib drin.",
    11: "(Funkstimme) Hast du Wasser? Zwei Liter pro Person und Tag.",
    12: "Das ist wirklich die offizielle Empfehlung – Vorrat für zehn Tage.", 13: "Noch 2 Prozent.",
    14: "Wer bist du?", 15: "(Funkstimme, leise) Ich bin's. Opa.", 16: "Opa?!",
    17: "Opa ist seit drei Jahren tot.", 19: "Die Klinke bewegt sich…", 20: "(Funkstimme) Nicht aufmachen!",
    21: "Ein Prozent.", 22: "Die Kerze geht aus.", 24: "Da steht jemand vor der Tür.",
    25: "(Funkstimme) Das Fenster. Jetzt.", 26: "A: Du machst die Tür auf. B: Du kletterst aus dem Fenster.",
    27: "Du entscheidest.", 28: "Schreib A oder B in die Kommentare.",
}

PARTS = {
    1: dict(scenes=SCENES1, voice=VOICE1, clocks=((15, "21:47"), (30, "23:12"), (99, "23:13")),
            audio=dict(hit=(1, 3, 25, 35), heart=(8, 18, 30), beep=(7, 31, 32), knock=(17,), noise=((14, 15), (21, 29))),
            cover=(s1, "TEIL 1 · DU ENTSCHEIDEST"),
            desc="Ganz Hamburg ist dunkel – und Opas Funkgerät funkt ohne Batterien 😨 Antwortest du? "
                 "Schreib A oder B! Die Regel stimmt wirklich (Quelle: BBK-Ratgeber Notfallvorsorge).\n"
                 "#blackout #hamburg #duentscheidest #survival #wasmachstdu\n"),
    2: dict(scenes=SCENES2, voice=VOICE2, clocks=((12, "23:13"), (21, "23:14"), (99, "23:15")),
            audio=dict(hit=(1, 16, 28), heart=(15, 23), beep=(3, 13, 21), knock=(18,), noise=((5, 10), (15, 15), (20, 20), (25, 25))),
            cover=(t2_talk, "TEIL 2 · DU ENTSCHEIDEST"),
            desc="Opas Funkgerät antwortet – aber Opa ist seit 3 Jahren tot 😨 Tür oder Fenster? Schreib A oder B! "
                 "Die Wasser-Regel stimmt wirklich: 2 Liter pro Person und Tag, Vorrat für 10 Tage "
                 "(Quelle: BBK-Ratgeber Notfallvorsorge).\n"
                 "#blackout #hamburg #duentscheidest #survival #wasmachstdu #teil2\n"),
}

PART = PARTS[1]


def clock_for(n):
    for last, clk in PART["clocks"]:
        if n <= last:
            return clk


def render_frame(n, fn, txt, on, with_hud=True):
    c = Cv()
    fn(c, on)
    vignette(c)
    if with_hud:
        hud(c, clock_for(n), on)
    if txt:
        caption(c, txt)
    return c


def overlay_frame(n, txt, on):
    """Nur Vignette + HUD + Text auf transparentem Grund (für KI-Clips)."""
    c = Cv(transparent=True)
    vignette(c)
    hud(c, clock_for(n), on)
    if txt:
        caption(c, txt)
    return c.img.resize((W, H), Image.LANCZOS)


def blink_expr(fx, on):
    period = 0.2 if fx == "BLINKFAST" else (0.4 if fx.startswith("BLINK") else 0.8)
    off = period / 2 if fx.startswith("BLINK") else 0.5
    return f"lt(mod(t,{period}),{off})" if on else f"gte(mod(t,{period}),{off})"


def variants_for(n, fn, txt, fx, dur, build):
    """Liste von (Bild, enable-Ausdruck). Erstes Bild = Basis."""
    out = []
    if fn is None:
        seg = dur / 3
        clock = clock_for(n)
        for k, cnt in enumerate((3, 2, 1)):
            f = s34_factory(cnt, clock)
            for on in (True, False):
                p = os.path.join(build, f"s{n:02d}_{cnt}{'a' if on else 'b'}.png")
                render_frame(n, f, txt, on).img.convert("RGB").save(p, compress_level=1)
                out.append((p, f"gte(t,{k * seg:.3f})*lt(t,{(k + 1) * seg:.3f})*{blink_expr(fx, on)}"))
        return out
    for on in (True, False):
        p = os.path.join(build, f"s{n:02d}{'a' if on else 'b'}.png")
        render_frame(n, fn, txt, on).img.convert("RGB").save(p, compress_level=1)
        out.append((p, blink_expr(fx, on)))
    return out


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(" ".join(cmd))
        print(r.stderr[-3000:])
        sys.exit(1)


ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS)]


def render_segment(n, variants, dur, shake, out):
    frames = round(dur * FPS)
    cmd = ["ffmpeg", "-y", "-v", "error"]
    for p, _ in variants:
        cmd += ["-loop", "1", "-framerate", str(FPS), "-t", str(dur), "-i", p]
    fc, last = [], "[0:v]"
    for i, (_, expr) in enumerate(variants[1:], 1):
        fc.append(f"{last}[{i}:v]overlay=enable='{expr}'[o{i}]")
        last = f"[o{i}]"
    z0, z1 = (1.05, 1.10) if shake else (1.0, 1.06)
    z = f"{z0}+{z1 - z0:.3f}*in/{frames - 1}"
    sx = "+if(lt(in,16),60*sin(in*2.3)*(1-in/16),0)" if shake else ""
    sy = "+if(lt(in,16),45*cos(in*1.7)*(1-in/16),0)" if shake else ""
    fc.append(f"{last}zoompan=z='{z}':x='iw/2-iw/zoom/2{sx}':y='ih/2-ih/zoom/2{sy}':d=1:s={W}x{H}:fps={FPS},"
              f"format=yuv420p[v]")
    cmd += ["-filter_complex", ";".join(fc), "-map", "[v]", "-frames:v", str(frames)] + ENC + [out]
    run(cmd)


def render_ki_segment(n, clip, txt, fx, dur, build, out):
    """KI-Clip als Bild, darüber HUD + Text (blinkender Alarmpunkt)."""
    frames = round(dur * FPS)
    ovs = []
    for on in (True, False):
        p = os.path.join(build, f"ov{n:02d}{'a' if on else 'b'}.png")
        overlay_frame(n, txt, on).save(p, compress_level=1)
        ovs.append(p)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", clip]
    for p in ovs:
        cmd += ["-loop", "1", "-framerate", str(FPS), "-t", str(dur), "-i", p]
    fc = (f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1,"
          f"tpad=stop_mode=clone:stop_duration={dur},trim=duration={dur},setpts=PTS-STARTPTS[b];"
          f"[b][1:v]overlay=enable='{blink_expr(fx, True)}'[o1];"
          f"[o1][2:v]overlay=enable='{blink_expr(fx, False)}',format=yuv420p[v]")
    cmd += ["-filter_complex", fc, "-map", "[v]", "-an", "-frames:v", str(frames)] + ENC + [out]
    run(cmd)


# ---------------------------------------------------------------- Sound
def build_audio(starts, total, build):
    srcs, events = [], []
    dur_of = {s[0]: s[1] for s in PART["scenes"]}
    ev = PART["audio"]

    def add(src, t, post=""):
        srcs.append(src)
        events.append((t, post))

    add(f"aevalsrc='0.045*sin(2*PI*55*t)*(0.75+0.25*sin(2*PI*0.15*t))+0.022*sin(2*PI*82.4*t)"
        f"+0.012*sin(2*PI*110.3*t)':s=44100:d={total}", 0,
        f"afade=t=in:d=1,afade=t=out:st={total - 2}:d=2,")
    hit = "aevalsrc='0.42*sin(2*PI*(38+80*exp(-9*t))*t)*exp(-3.2*t)':s=44100:d=1.6"
    heart = ("aevalsrc='0.38*sin(2*PI*50*t)*(exp(-16*t)+if(gte(t,0.27),0.8*exp(-16*(t-0.27)),0))'"
             ":s=44100:d=0.9")
    beep = "aevalsrc='0.09*sin(2*PI*1150*t)':s=44100:d=0.16"
    knock = ("aevalsrc='0.4*sin(2*PI*95*t)*(exp(-45*t)+if(gte(t,0.2),exp(-45*(t-0.2)),0)"
             "+if(gte(t,0.4),exp(-45*(t-0.4)),0))':s=44100:d=0.9")
    for n in ev["hit"]:
        add(hit, starts[n])
    for n in ev["heart"]:
        add(heart, starts[n])
    for n in ev["beep"]:
        add(beep, starts[n] + 0.05, "afade=t=out:st=0.12:d=0.04,")
    for n in ev["knock"]:
        add(knock, starts[n], "lowpass=f=600,")
    for a, b in ev["noise"]:
        t0 = starts[a]
        d = starts[b] + dur_of[b] - t0
        add(f"anoisesrc=d={d:.2f}:c=pink:a=0.12:r=44100", t0,
            f"highpass=f=500,lowpass=f=3500,afade=t=in:d=0.2,afade=t=out:st={d - 0.25:.2f}:d=0.25,")
    cmd = ["ffmpeg", "-y", "-v", "error"]
    for s in srcs:
        cmd += ["-f", "lavfi", "-i", s]
    fc = [f"[{i}:a]{post}adelay={int(t * 1000)}:all=1[a{i}]" for i, (t, post) in enumerate(events)]
    fc.append("".join(f"[a{i}]" for i in range(len(events))) +
              f"amix=inputs={len(events)}:normalize=0:duration=longest,"
              f"alimiter=limit=0.5:level=false,atrim=end={total},aformat=sample_rates=44100:channel_layouts=stereo[a]")
    wav = os.path.join(build, "audio.wav")
    cmd += ["-filter_complex", ";".join(fc), "-map", "[a]", wav]
    run(cmd)
    fx_list = [(starts[n], f"Hit (tiefer Schlag) – Szene {n}") for n in ev["hit"]]
    fx_list += [(starts[n], f"Herzschlag (Doppel-Puls) – Szene {n}") for n in ev["heart"]]
    fx_list += [(starts[n] + 0.05, f"Piep (Handy/Funk) – Szene {n}") for n in ev["beep"]]
    fx_list += [(starts[n], f"Klopfen an der Tür (3x) – Szene {n}") for n in ev["knock"]]
    fx_list += [(starts[a], f"Funk-/Radio-Rauschen bis {ts(starts[b] + dur_of[b])} – Szene {a}–{b}") for a, b in ev["noise"]]
    fx_list += [(0.0, f"Grundspur: tiefer Drone, leise, durchgehend bis {ts(total)}")]
    return wav, sorted(fx_list)


def ts(t):
    return f"{int(t // 60):02d}:{t % 60:05.2f}"


# ---------------------------------------------------------------- main
def main():
    global PART
    args = sys.argv[1:]
    teil = 1
    if "--teil" in args:
        i = args.index("--teil")
        teil = int(args[i + 1])
        del args[i:i + 2]
    PART = PARTS[teil]
    scenes = PART["scenes"]
    only = {int(a) for a in args}
    build = os.path.join(BUILD, f"teil{teil}")
    clean_dir = os.path.join(OUT, f"teil{teil}_bilder_fuer_ki")
    ki_dir = os.path.join(ROOT, "ki_clips", f"teil{teil}")
    for d in (OUT, build, clean_dir, ki_dir):
        os.makedirs(d, exist_ok=True)
    starts, t = {}, 0.0
    for n, dur, *_ in scenes:
        starts[n] = t
        t += dur
    total = t

    for n, dur, fn, txt, fx, motion in scenes:
        seg = os.path.join(build, f"seg{n:02d}.mp4")
        clip = os.path.join(ki_dir, f"szene_{n:02d}.mp4")
        if only and n not in only and os.path.exists(seg):
            continue
        print(f"Teil {teil} · Szene {n}" + (" (KI-Clip)" if os.path.exists(clip) else ""), flush=True)
        clean_fn = fn or s34_factory(3, clock_for(n))
        render_frame(n, clean_fn, None, True, with_hud=False).img.convert("RGB").resize((W, H), Image.LANCZOS) \
            .save(os.path.join(clean_dir, f"szene_{n:02d}.png"))
        if os.path.exists(clip):
            render_ki_segment(n, clip, txt, fx, dur, build, seg)
        else:
            render_segment(n, variants_for(n, fn, txt, fx, dur, build), dur, fx == "SHAKE", seg)

    lst = os.path.join(build, "list.txt")
    with open(lst, "w") as f:
        for n, *_ in scenes:
            f.write(f"file 'seg{n:02d}.mp4'\n")
    name = f"blackout_teil{teil}"
    silent = os.path.join(OUT, f"{name}_ohne_ton.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy",
         "-movflags", "+faststart", silent])
    wav, fx_list = build_audio(starts, total, build)
    run(["ffmpeg", "-y", "-v", "error", "-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
         "-c:a", "aac", "-b:a", "192k", "-t", f"{total}", "-movflags", "+faststart", os.path.join(OUT, f"{name}.mp4")])

    cover_fn, label = PART["cover"]
    c = Cv()
    cover_fn(c, True)
    vignette(c)
    lw = font(SANS, 38).getlength(label) / S
    c.rect(540 - lw / 2 - 40, 1095, 540 + lw / 2 + 40, 1175, fill=RED, r=40, w=6)
    c.text(540, 1136, label, font(SANS, 38), "white")
    c.text(540, 1330, "BLACKOUT", font(ANTON, 250), YEL, stroke=9)
    c.text(540, 1550, "IN HAMBURG", font(ANTON, 160), "white", stroke=8)
    c.img.convert("RGB").resize((W, H), Image.LANCZOS).save(os.path.join(OUT, f"cover_teil{teil}.png"))

    cols = 7
    rows = math.ceil(len(scenes) / cols)
    sheet = Image.new("RGB", (216 * cols, 384 * rows), "black")
    sd = ImageDraw.Draw(sheet)
    for i, (n, _, fn, *_) in enumerate(scenes):
        p = os.path.join(build, f"s{n:02d}_3a.png" if fn is None else f"s{n:02d}a.png")
        if not os.path.exists(p):
            continue
        x, y = (i % cols) * 216, (i // cols) * 384
        sheet.paste(Image.open(p).resize((216, 384), Image.LANCZOS), (x, y))
        sd.text((x + 6, y + 350), str(n), fill="yellow", font=ImageFont.truetype(SANS, 24))
    sheet.save(os.path.join(build, "kontaktblatt.png"))

    with open(os.path.join(OUT, f"sprecher_teil{teil}.txt"), "w") as f:
        f.write(f"SPRECHERTEXTE – Blackout Hamburg Teil {teil} (Startzeit mm:ss.hh | Szene | Text)\n\n")
        for n, txt in PART["voice"].items():
            f.write(f"{ts(starts[n])} | Szene {n:2d} | {txt}\n")
        f.write(f"\nGesamtlänge: {ts(total)}\n")
    with open(os.path.join(OUT, f"beschreibung_teil{teil}.txt"), "w") as f:
        f.write(PART["desc"])
    with open(os.path.join(OUT, f"sounds_zum_ersetzen_teil{teil}.txt"), "w") as f:
        f.write(f"SOUNDS ZUM ERSETZEN – Teil {teil} (Startzeit mm:ss.hh | Effekt)\n\n")
        for t0, nm in fx_list:
            f.write(f"{ts(t0)} | {nm}\n")
    style = ("Flat 2D cartoon animation, keep the exact art style, colors, characters and framing of the image. "
             "Subtle, smooth motion only. No new objects, no text, no camera cuts.")
    with open(os.path.join(OUT, f"ki_prompts_teil{teil}.txt"), "w") as f:
        f.write(f"BILD-ZU-VIDEO-PROMPTS – Teil {teil}\n")
        f.write("Bild: teil{0}_bilder_fuer_ki/szene_XX.png  ·  Format 9:16  ·  Länge: kürzeste Option (5 s)\n".format(teil))
        f.write("★ = lohnt sich für KI-Bewegung. Ohne ★ reicht der Zoom aus dem fertigen Video.\n")
        f.write(f"Vor jeden Prompt setzen (Stil-Satz):\n{style}\n\n")
        for n, dur, fn, txt, fx, motion in scenes:
            star = motion.startswith("*")
            f.write(f"{'★' if star else ' '} Szene {n:02d} ({dur:g} s) | {motion.lstrip('*')}\n")
    print("fertig", ts(total))


if __name__ == "__main__":
    main()
