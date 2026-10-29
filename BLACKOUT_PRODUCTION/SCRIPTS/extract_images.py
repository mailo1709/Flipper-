#!/usr/bin/env python3
"""Phase 1: Einzelbilder aus den Kontaktbögen schneiden, Nummern entfernen, Reihenfolge prüfen.

Die Kontaktbögen enthalten nur Vorschaubilder (216 x 384 px). Für das Video werden deshalb die
Originalillustrationen in voller Auflösung (1080 x 1920) direkt aus dem Zeichencode erzeugt –
pixelgleich zum Kontaktbogen, aber in Endqualität. Dieses Skript prüft, dass beides übereinstimmt.
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import blackout_draw as b

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
CW, CH, COLS = 216, 384, 7


def extract(teil):
    sheet = Image.open(os.path.join(ROOT, "INPUT", f"TEIL_{teil}", f"kontaktbogen_teil{teil}.png")).convert("RGB")
    rows = sheet.height // CH
    outdir = os.path.join(ROOT, "EXTRACTED_IMAGES", f"TEIL_{teil}")
    os.makedirs(os.path.join(outdir, "aus_kontaktbogen"), exist_ok=True)
    cells = []
    for r in range(rows):
        for c in range(COLS):
            cell = sheet.crop((c * CW, r * CH, (c + 1) * CW, (r + 1) * CH))
            if np.asarray(cell).mean() < 3:      # leere Zelle am Ende
                continue
            a = np.asarray(cell).copy()
            a[340:384, 0:46] = a[296:340, 0:46]  # gelbe Nummer unten links durch Bildinhalt darüber ersetzen
            cell = Image.fromarray(a)
            cells.append(cell)
            cell.save(os.path.join(outdir, "aus_kontaktbogen", f"bild_{len(cells):02d}.png"))
    return cells


def originals(teil):
    """Originalillustrationen in voller Auflösung (mit und ohne Text) erzeugen."""
    b.PART = b.PARTS[teil]
    scenes = b.SCENES1 if teil == 1 else b.SCENES2
    outdir = os.path.join(ROOT, "EXTRACTED_IMAGES", f"TEIL_{teil}", "original_1080x1920")
    os.makedirs(outdir, exist_ok=True)
    with_text = []
    for n, dur, fn, txt, fx, motion in scenes:
        b.T, b.FRAME = 0.5, 15
        f = fn or b.s34_factory(3, b.clock_for(n))
        clean = b.render_frame(n, f, None, True, with_hud=False).img.convert("RGB").resize((b.W, b.H), Image.LANCZOS)
        clean.save(os.path.join(outdir, f"szene_{n:02d}.png"))
        with_text.append(b.render_frame(n, f, txt, True).img.convert("RGB").resize((CW, CH), Image.LANCZOS))
    return with_text


def check(teil, cells, refs):
    A = np.stack([np.asarray(c, float) for c in cells])
    B = np.stack([np.asarray(r, float) for r in refs])
    lines = [f"Teil {teil}: {len(cells)} Bilder im Kontaktbogen, {len(refs)} Szenen im Drehbuch"]
    ok = len(cells) == len(refs)
    for i in range(len(cells)):
        err = ((B - A[i]) ** 2).mean(axis=(1, 2, 3))
        j = int(err.argmin())
        good = j == i
        ok &= good
        lines.append(f"  Bild {i + 1:2d} -> passt am besten zu Szene {j + 1:2d} (Abweichung {err[j]:.0f})"
                     f"{'' if good else '  !! FALSCHE REIHENFOLGE'}")
    lines.append("  ERGEBNIS: Reihenfolge korrekt" if ok else "  ERGEBNIS: PRÜFEN!")
    return ok, "\n".join(lines)


def overview(teil):
    outdir = os.path.join(ROOT, "EXTRACTED_IMAGES", f"TEIL_{teil}")
    files = sorted(os.listdir(os.path.join(outdir, "original_1080x1920")))
    rows = (len(files) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * CW, rows * (CH + 30)), "#05060a")
    dr = ImageDraw.Draw(sheet)
    fnt = ImageFont.truetype(b.SANS, 20)
    for i, fn in enumerate(files):
        im = Image.open(os.path.join(outdir, "original_1080x1920", fn)).resize((CW, CH), Image.LANCZOS)
        x, y = (i % COLS) * CW, (i // COLS) * (CH + 30)
        sheet.paste(im, (x, y))
        dr.text((x + CW / 2, y + CH + 15), fn.replace(".png", "").replace("_", " "), fill="#ffc83d", font=fnt, anchor="mm")
    sheet.save(os.path.join(outdir, f"UEBERSICHT_TEIL_{teil}.png"))


if __name__ == "__main__":
    report = []
    for teil in (1, 2):
        cells = extract(teil)
        refs = originals(teil)
        ok, txt = check(teil, cells, refs)
        overview(teil)
        report.append(txt)
    text = "\n\n".join(report)
    print(text)
    with open(os.path.join(ROOT, "LOGS", "phase1_extraktion.txt"), "w") as f:
        f.write(text + "\n")
