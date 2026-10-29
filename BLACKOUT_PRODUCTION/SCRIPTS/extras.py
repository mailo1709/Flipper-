#!/usr/bin/env python3
"""Zusatzdateien: Cover, Posting-Beschreibung und Bild-zu-Video-Prompts (für optionale KI-Clips)."""
import os

from PIL import Image

import blackout_draw as b

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
STYLE = ("Flat 2D cartoon animation, keep the exact art style, colors, characters and framing of the image. "
         "Subtle, smooth motion only. No new objects, no text, no camera cuts, no 3D, no realism.")


def cover(teil):
    b.PART = b.PARTS[teil]
    b.T = 0.5
    fn, label = b.PART["cover"]
    c = b.Cv()
    fn(c, True)
    b.vignette(c)
    lw = b.font(b.SANS, 38).getlength(label) / b.S
    c.rect(540 - lw / 2 - 40, 1095, 540 + lw / 2 + 40, 1175, fill=b.RED, r=40, w=6)
    c.text(540, 1136, label, b.font(b.SANS, 38), "white")
    c.text(540, 1330, "BLACKOUT", b.font(b.ANTON, 250), b.YEL, stroke=9)
    c.text(540, 1550, "IN HAMBURG", b.font(b.ANTON, 160), "white", stroke=8)
    path = os.path.join(ROOT, "EXPORT", f"BLACKOUT_TEIL_{teil}_COVER.png")
    c.img.convert("RGB").resize((b.W, b.H), Image.LANCZOS).save(path)
    return path


def texts(teil):
    part = b.PARTS[teil]
    with open(os.path.join(ROOT, "EXPORT", f"BLACKOUT_TEIL_{teil}_BESCHREIBUNG.txt"), "w") as f:
        f.write(part["desc"])
    scenes = b.SCENES1 if teil == 1 else b.SCENES2
    with open(os.path.join(ROOT, "PROJECT_FILES", f"TEIL_{teil}", "ki_bild_zu_video_prompts.txt"), "w") as f:
        f.write(f"BILD-ZU-VIDEO-PROMPTS – Teil {teil} (optional, z. B. Kling AI)\n")
        f.write(f"Bild: EXTRACTED_IMAGES/TEIL_{teil}/original_1080x1920/szene_XX.png · 9:16 · 5 s\n")
        f.write(f"Fertigen Clip speichern als KI_CLIPS/TEIL_{teil}/szene_XX.mp4 und produce.py {teil} neu starten.\n")
        f.write("★ = lohnt sich für KI-Bewegung.\n\nStil-Satz (immer davor setzen):\n" + STYLE + "\n\n")
        for n, dur, fn, txt, fx, motion in scenes:
            f.write(f"{'★' if motion.startswith('*') else ' '} Szene {n:02d} | {motion.lstrip('*')}\n")


if __name__ == "__main__":
    for t in (1, 2):
        print(cover(t))
        texts(t)
