#!/usr/bin/env python3
"""Qualitätskontrolle der fertigen Videos: Format, Ton, Ränder, Kontaktblatt aus dem echten Export."""
import json
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def qc(teil):
    vid = os.path.join(ROOT, "EXPORT", f"BLACKOUT_TEIL_{teil}_FINAL.mp4")
    tl = json.load(open(os.path.join(ROOT, "PROJECT_FILES", f"TEIL_{teil}", "timeline.json")))
    rep = [f"QUALITÄTSKONTROLLE TEIL {teil}: {os.path.basename(vid)}"]
    pr = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", vid]).stdout)
    v = [s for s in pr["streams"] if s["codec_type"] == "video"][0]
    a = [s for s in pr["streams"] if s["codec_type"] == "audio"][0]
    dur = float(pr["format"]["duration"])
    checks = [
        ("Auflösung 1080x1920 (9:16)", v["width"] == 1080 and v["height"] == 1920, f"{v['width']}x{v['height']}"),
        ("30 fps", v["r_frame_rate"] == "30/1", v["r_frame_rate"]),
        ("H.264 / yuv420p", v["codec_name"] == "h264" and v["pix_fmt"] == "yuv420p", f"{v['codec_name']} {v['pix_fmt']}"),
        ("AAC-Ton", a["codec_name"] == "aac", f"{a['codec_name']} {a['sample_rate']} Hz {a['channels']} ch"),
        ("Länge passt zur Timeline", abs(dur - tl["gesamtdauer"]) < 0.2, f"{dur:.2f} s (Timeline {tl['gesamtdauer']:.2f} s)"),
    ]
    lo = run(["ffmpeg", "-hide_banner", "-i", vid, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", lo)[-1])
    tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", lo)[-1])
    checks.append(("Lautheit ca. -14 LUFS", -16.5 < I < -12, f"{I:.1f} LUFS"))
    checks.append(("Keine Übersteuerung (True Peak < -0.5 dBFS)", tp < -0.5, f"{tp:.1f} dBFS"))
    cd = run(["ffmpeg", "-hide_banner", "-i", vid, "-vf", "cropdetect=limit=8:round=2:reset=0", "-f", "null", "-"]).stderr
    crops = re.findall(r"crop=(\d+):(\d+):(\d+):(\d+)", cd)
    w_, h_ = (int(crops[-1][0]), int(crops[-1][1])) if crops else (1080, 1920)
    checks.append(("Keine schwarzen Ränder", w_ >= 1076 and h_ >= 1900, f"Bildinhalt {w_}x{h_}"))
    for name, ok, val in checks:
        rep.append(f"  [{'OK' if ok else '!!'}] {name}: {val}")

    # Kontaktblatt aus dem echten Export (Mitte jeder Szene)
    tmp = os.path.join(ROOT, "PROJECT_FILES", f"TEIL_{teil}", "qc_frames")
    os.makedirs(tmp, exist_ok=True)
    cols, cw, ch = 7, 216, 384
    rows = (len(tl["szenen"]) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, rows * (ch + 26)), "black")
    dr = ImageDraw.Draw(sheet)
    fnt = ImageFont.truetype(SANS, 18)
    for i, sc in enumerate(tl["szenen"]):
        t = sc["start"] + sc["dauer"] * 0.7
        p = os.path.join(tmp, f"s{sc['szene']:02d}.png")
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", vid, "-frames:v", "1", "-vf", f"scale={cw}:{ch}", p])
        x, y = (i % cols) * cw, (i // cols) * (ch + 26)
        sheet.paste(Image.open(p), (x, y))
        dr.text((x + 4, y + ch + 3), f"{sc['szene']}  {t:.1f}s", fill="#ffc83d", font=fnt)
    out = os.path.join(ROOT, "LOGS", f"TEIL_{teil}", "qc_kontaktblatt.png")
    sheet.save(out)
    rep.append(f"  Kontaktblatt: {os.path.relpath(out, ROOT)}")
    text = "\n".join(rep)
    open(os.path.join(ROOT, "LOGS", f"TEIL_{teil}", "qc.txt"), "w").write(text + "\n")
    print(text)


if __name__ == "__main__":
    for t in [int(x) for x in sys.argv[1:]] or (1, 2):
        qc(t)
