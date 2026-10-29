#!/usr/bin/env python3
"""BLACKOUT HAMBURG – komplette Produktion (Stimmen, Sound, Musik, Animation, Untertitel, Export).

Aufruf (aus BLACKOUT_PRODUCTION/SCRIPTS):
    python3 produce.py 1            -> Teil 1 komplett
    python3 produce.py 2            -> Teil 2 komplett
    python3 produce.py 2 --scenes 4 17   -> nur diese Szenen neu animieren, Audio/Export neu
    python3 produce.py 1 --audio-only    -> nur Ton neu mischen und exportieren
"""
import json
import math
import os
import re
import subprocess
import sys
import time
import wave
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw

import audio_synth as A
import blackout_draw as b
import voices
from drehbuch_data import TEILE

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
W, H, S, FPS = b.W, b.H, b.S, 30
SR = A.SR
ROLE_COLORS = {"ERZ": "#ffffff", "JON": "#ffe08a", "FUNK": b.TUR, "RADIO": "#bfe9ff"}
ROLE_TAG = {"FUNK": "[Funk] ", "RADIO": "[Radio] "}


def d(*p):
    path = os.path.join(ROOT, *p)
    os.makedirs(os.path.dirname(path) if os.path.splitext(path)[1] else path, exist_ok=True)
    return path


def log(teil, msg):
    line = f"[{time.strftime('%H:%M:%S')}] Teil {teil}: {msg}"
    print(line, flush=True)
    with open(d("LOGS", f"TEIL_{teil}", "produktion.log"), "a") as f:
        f.write(line + "\n")


def scene_defs(teil):
    """Verbindet Drehbuch-Daten mit den Zeichenfunktionen."""
    src = {s[0]: s for s in (b.SCENES1 if teil == 1 else b.SCENES2)}
    out = []
    for sc in TEILE[teil]:
        n, _, fn, cap, fx, motion = src[sc["n"]]
        out.append(dict(sc, fn_idx=n, caption=cap, fx=fx))
    return out


# ---------------------------------------------------------------- Timeline
def build_timeline(teil, scenes):
    t = 0.0
    for sc in scenes:
        lead = 0.25 if sc["trans"] == "fade" else 0.08
        cur = lead
        sc["voice"] = []
        for role, text in sc["lines"]:
            x = voices.synth(text, role)
            dur = len(x) / SR
            sc["voice"].append(dict(role=role, text=text, rel=cur, dur=dur, audio=x))
            cur += dur + 0.15
        end = cur - 0.15 if sc["voice"] else 0
        dur = max(sc["min"] * 0.9, end + 0.22)
        sc["dur"] = round(dur * FPS) / FPS
        sc["start"] = t
        t += sc["dur"]
    return t


def write_timeline(teil, scenes, total):
    data = [dict(szene=sc["n"], start=round(sc["start"], 3), dauer=sc["dur"], text_im_bild=sc["caption"],
                 effekt=sc["fx"], musik=sc["music"], uebergang=sc["trans"], animation=sc["anim"],
                 sfx=[s[0] for s in sc["sfx"]],
                 sprache=[dict(rolle=v["role"], text=v["text"], start=round(sc["start"] + v["rel"], 3),
                               dauer=round(v["dur"], 3)) for v in sc["voice"]]) for sc in scenes]
    with open(d("PROJECT_FILES", f"TEIL_{teil}", "timeline.json"), "w") as f:
        json.dump(dict(teil=teil, gesamtdauer=round(total, 3), fps=FPS, szenen=data), f, ensure_ascii=False, indent=1)
    with open(d("PROJECT_FILES", f"TEIL_{teil}", "timeline.csv"), "w") as f:
        f.write("Szene;Start;Dauer;Text im Bild;Sprecher;Gesprochener Text;Musik;Geräusche\n")
        for sc in scenes:
            sp = " | ".join(f"{v['role']}" for v in sc["voice"])
            tx = " | ".join(v["text"] for v in sc["voice"])
            f.write(f"{sc['n']};{sc['start']:.2f};{sc['dur']:.2f};{(sc['caption'] or '').replace('**', '')};{sp};{tx};"
                    f"{sc['music']};{', '.join(s[0] for s in sc['sfx'])}\n")


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(teil, scenes):
    path = d("EXPORT", f"BLACKOUT_TEIL_{teil}_UNTERTITEL.srt")
    k = 0
    with open(path, "w") as f:
        for sc in scenes:
            for i, v in enumerate(sc["voice"]):
                k += 1
                st = sc["start"] + v["rel"]
                nxt = sc["start"] + sc["voice"][i + 1]["rel"] if i + 1 < len(sc["voice"]) else sc["start"] + sc["dur"]
                en = min(nxt - 0.02, st + v["dur"] + 0.6)
                f.write(f"{k}\n{srt_time(st)} --> {srt_time(en)}\n{ROLE_TAG.get(v['role'], '')}{v['text']}\n\n")
    return path


# ---------------------------------------------------------------- Audio
def place(track, x, t):
    i = int(t * SR)
    if i >= len(track):
        return
    x = x[:len(track) - i]
    track[i:i + len(x)] += x


def build_audio(teil, scenes, total):
    n = int(total * SR) + SR
    voice = np.zeros(n)
    sfx = np.zeros(n)
    for sc in scenes:
        for v in sc["voice"]:
            place(voice, v["audio"], sc["start"] + v["rel"])
            if v["role"] == "FUNK":
                place(sfx, A.static(v["dur"] + 0.3) * 0.35, sc["start"] + v["rel"] - 0.1)
            if v["role"] == "RADIO":
                place(sfx, A.static(v["dur"] + 0.2) * 0.2, sc["start"] + v["rel"] - 0.1)
        for name, off, dur, vol in sc["sfx"]:
            dd = dur if dur else sc["dur"] - off
            place(sfx, A.make_sfx(name, dd) * vol, sc["start"] + off)
    states = [(sc["start"], sc["start"] + sc["dur"], sc["music"]) for sc in scenes]
    mus = A.music(states, n / SR)
    mus = mus / (np.abs(mus).max() + 1e-9) * 0.35
    # Ducking: Musik geht unter der Stimme runter
    e = np.abs(voice)
    k = int(0.05 * SR)
    e = A.smooth(A.smooth(e, k), 0.4 * SR)
    duck = 1 - 0.6 * np.clip(e / 0.03, 0, 1)
    mus *= duck
    sfx_d = sfx * (1 - 0.3 * np.clip(e / 0.03, 0, 1))
    mix = voice + sfx_d + mus
    mix = np.tanh(mix * 1.1) / 1.1
    mix = mix[:int(total * SR)]

    def save(path, x):
        x = np.clip(x, -1, 1)
        with wave.open(path, "w") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((x * 32767).astype(np.int16).tobytes())

    save(d("VOICE", f"TEIL_{teil}", "stimmen_spur.wav"), voice[:len(mix)])
    save(d("SOUND_EFFECTS", f"TEIL_{teil}", "geraeusche_spur.wav"), sfx[:len(mix)])
    save(d("MUSIC", f"TEIL_{teil}", "musik_spur.wav"), mus[:len(mix)])
    raw = d("PROJECT_FILES", f"TEIL_{teil}", "mix_roh.wav")
    save(raw, mix)
    final = d("PROJECT_FILES", f"TEIL_{teil}", "mix_final.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af",
                    "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000", "-ac", "2", final], check=True)
    vr = np.sqrt(np.mean(voice[voice != 0] ** 2)) if voice.any() else 0
    mr = np.sqrt(np.mean(mus ** 2))
    log(teil, f"Audio: Stimme RMS {20 * np.log10(vr + 1e-9):.1f} dB, Musik RMS {20 * np.log10(mr + 1e-9):.1f} dB "
              f"(Abstand {20 * np.log10((vr + 1e-9) / (mr + 1e-9)):.1f} dB)")
    for i, sc in enumerate(scenes):
        for j, v in enumerate(sc["voice"]):
            save(d("VOICE", f"TEIL_{teil}", f"szene_{sc['n']:02d}_{j + 1}_{v['role']}.wav"), v["audio"])
    return final


# ---------------------------------------------------------------- Video
def blink_on(fx, t):
    if fx == "BLINKFAST":
        return t % 0.2 < 0.1
    if fx.startswith("BLINK"):
        return t % 0.4 < 0.2
    return t % 0.8 < 0.5


def norm_txt(s):
    return re.sub(r"[^a-zäöüß0-9]", "", (s or "").replace("**", "").lower())


def subtitle(c, role, text):
    f = b.font(b.SANS, 42)
    txt = ROLE_TAG.get(role, "") + text
    words, lines, cur = txt.split(), [], ""
    for w_ in words:
        cand = (cur + " " + w_).strip()
        if f.getlength(cand) / S > 820 and cur:
            lines.append(cur)
            cur = w_
        else:
            cur = cand
    lines.append(cur)
    lh = 56
    y0 = 1540 - lh * (len(lines) - 1) / 2
    wmax = max(f.getlength(l_) for l_ in lines) / S
    c.rect(540 - wmax / 2 - 26, y0 - lh / 2 - 14, 540 + wmax / 2 + 26, y0 + lh * (len(lines) - 0.5) + 14,
           fill=(5, 7, 14, 165), w=0, r=22)
    for i, l_ in enumerate(lines):
        c.text(540, y0 + i * lh, l_, f, ROLE_COLORS[role], stroke=3)


def make_overlay(teil, sc, on, sub):
    c = b.Cv(transparent=True)
    b.hud(c, b.clock_for(sc["n"]), on)
    if sc["caption"]:
        b.caption(c, sc["caption"])
    if sub is not None:
        v = sc["voice"][sub]
        if norm_txt(v["text"]) != norm_txt(sc["caption"]):
            subtitle(c, v["role"], v["text"])
    return c.img.resize((W, H), Image.LANCZOS)


def camera(img, t, dur, shake, n):
    p = t / max(dur, 1e-3)
    ease = 0.5 - 0.5 * math.cos(math.pi * p)
    z0 = 1.05 if shake else 1.0
    z = z0 + 0.07 * ease
    direction = -1 if n % 2 else 1
    cx = W * S / 2 + direction * 18 * S * ease
    cy = H * S / 2 - 10 * S * ease
    if shake and t < 0.6:
        amp = 26 * S * math.exp(-t * 6)
        cx += amp * math.sin(t * 61)
        cy += amp * 0.7 * math.cos(t * 47)
    w, h = W * S / z, H * S / z
    x0 = min(max(cx - w / 2, 0), W * S - w)
    y0 = min(max(cy - h / 2, 0), H * S - h)
    return img.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + w, y0 + h))


def render_scene(job):
    teil, idx, out, last = job
    b.PART = b.PARTS[teil]
    scenes = SCENES_CACHE[teil]
    sc = scenes[idx]
    src = {s[0]: s for s in (b.SCENES1 if teil == 1 else b.SCENES2)}
    fn = src[sc["n"]][2]
    dur = sc["dur"]
    frames = round(dur * FPS)
    ov_cache = {}
    clip = ki_clip(teil, sc["n"])
    dec, last_frame, vig = None, None, None
    if clip:
        dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", clip, "-vf",
                                f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS}",
                                "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
        vc = b.Cv(transparent=True)
        b.vignette(vc)
        vig = vc.img.resize((W, H), Image.LANCZOS)
    proc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                             "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                             "-pix_fmt", "yuv420p", "-threads", "2", out], stdin=subprocess.PIPE)
    for f in range(frames):
        t = f / FPS
        b.T, b.FRAME = t, f
        on = blink_on(sc["fx"], t)
        if fn is None:
            cnt = 3 - min(2, int(t / (dur / 3)))
            draw = b.s34_factory(cnt, b.clock_for(sc["n"]))
        else:
            draw = fn
        if dec:
            buf = dec.stdout.read(W * H * 3)
            if len(buf) == W * H * 3:
                last_frame = Image.frombytes("RGB", (W, H), buf).convert("RGBA")
            img = last_frame.copy()
            img.alpha_composite(vig)
        else:
            c = b.Cv()
            draw(c, on)
            b.vignette(c)
            img = camera(c.img, t, dur, sc["fx"] == "SHAKE", sc["n"])
        sub = None
        for i, v in enumerate(sc["voice"]):
            if t >= v["rel"] - 0.05:
                sub = i
        key = (on, sub)
        if key not in ov_cache:
            ov_cache[key] = make_overlay(teil, sc, on, sub)
        img.alpha_composite(ov_cache[key])
        fade = 0.0
        if sc["trans"] == "fade" and t < 0.3:
            fade = 1 - t / 0.3
        if last and dur - t < 0.6:
            fade = max(fade, 1 - (dur - t) / 0.6)
        if fade > 0:
            img = Image.blend(img, Image.new("RGBA", img.size, (0, 0, 0, 255)), fade)
        if sc["trans"] == "flash" and f < 4:
            img = Image.blend(img, Image.new("RGBA", img.size, (255, 255, 255, 255)), (0.7, 0.45, 0.2, 0.08)[f])
        proc.stdin.write(img.convert("RGB").tobytes())
    proc.stdin.close()
    proc.wait()
    if dec:
        dec.kill()
    return sc["n"]


def ki_clip(teil, n):
    """Optionaler KI-Clip (Bild-zu-Video) ersetzt die gezeichnete Szene: KI_CLIPS/TEIL_X/szene_XX.mp4"""
    p = os.path.join(ROOT, "KI_CLIPS", f"TEIL_{teil}", f"szene_{n:02d}.mp4")
    return p if os.path.exists(p) else None


SCENES_CACHE = {}


def main():
    teil = int(sys.argv[1])
    only = set()
    if "--scenes" in sys.argv:
        only = {int(x) for x in sys.argv[sys.argv.index("--scenes") + 1:] if x.isdigit()}
    audio_only = "--audio-only" in sys.argv
    b.PART = b.PARTS[teil]
    t0 = time.time()
    scenes = scene_defs(teil)
    log(teil, f"Stimmen erzeugen ({sum(len(s['lines']) for s in scenes)} Zeilen) …")
    total = build_timeline(teil, scenes)
    log(teil, f"Timeline: {len(scenes)} Szenen, {total:.2f} s")
    write_timeline(teil, scenes, total)
    write_srt(teil, scenes)
    mix = build_audio(teil, scenes, total)
    SCENES_CACHE[teil] = scenes
    segdir = d("PROJECT_FILES", f"TEIL_{teil}", "segmente")
    jobs = []
    for i, sc in enumerate(scenes):
        out = os.path.join(segdir, f"seg{sc['n']:02d}.mp4")
        meta = out + ".json"
        sig = json.dumps(dict(dur=sc["dur"], voice=[(v["role"], v["text"], round(v["rel"], 3)) for v in sc["voice"]],
                              cap=sc["caption"], trans=sc["trans"], last=i == len(scenes) - 1,
                              clip=os.path.getmtime(ki_clip(teil, sc["n"])) if ki_clip(teil, sc["n"]) else None))
        fresh = os.path.exists(out) and os.path.exists(meta) and open(meta).read() == sig
        if audio_only and fresh:
            continue
        if only and sc["n"] not in only and fresh:
            continue
        if not only and fresh and "--force" not in sys.argv:
            continue
        jobs.append((teil, i, out, i == len(scenes) - 1))
        with open(meta, "w") as f:
            f.write(sig)
    log(teil, f"Animation rendern: {len(jobs)} Szenen …")
    jobs.sort(key=lambda j: -scenes[j[1]]["dur"])
    with Pool(4) as pool:
        for n in pool.imap_unordered(render_scene, jobs):
            log(teil, f"  Szene {n} fertig")
    lst = os.path.join(segdir, "liste.txt")
    with open(lst, "w") as f:
        for sc in scenes:
            f.write(f"file 'seg{sc['n']:02d}.mp4'\n")
    silent = d("PROJECT_FILES", f"TEIL_{teil}", "video_ohne_ton.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent], check=True)
    final = d("EXPORT", f"BLACKOUT_TEIL_{teil}_FINAL.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", silent, "-i", mix, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{total:.3f}",
                    "-movflags", "+faststart", final], check=True)
    log(teil, f"Export fertig: {final} ({total:.1f} s) in {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
