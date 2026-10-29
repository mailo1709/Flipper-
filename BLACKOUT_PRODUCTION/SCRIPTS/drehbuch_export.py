#!/usr/bin/env python3
"""Drehbuch als TXT und PDF aus der fertigen Timeline erzeugen (nach produce.py ausführen)."""
import json
import os
import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image as RLImage, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from drehbuch_data import ROLES

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
SFX_NAMES = {
    "impact": "tiefer Impact", "power_down": "Stromausfall (Abschalten)", "switch": "Lichtschalter-Klicks",
    "static": "Funkrauschen", "squelch": "Funk-Verbindungston", "ptt": "Funkgerät-Klick (Sprechtaste)",
    "knock": "Klopfen an der Tür", "handle": "Türklinke", "creak": "leises Knarren", "footsteps": "Schritte",
    "wind": "Wind", "heartbeat": "Herzschlag", "battery": "Akku-Warnton", "error": "Fehlerton Handy",
    "drips": "Wassertropfen", "match": "Streichholz", "candle_out": "Kerze geht aus", "crank": "Kurbel-Ratschen",
    "radio_tune": "Radio-Sendersuche", "fridge": "Kühlschranktür", "crowd": "Menschenmenge + Schritte",
    "game": "Game-Sounds", "whoosh": "Whoosh", "riser": "Spannungs-Riser", "tick": "Uhr-Ticken",
}
MUSIC_NAMES = {
    "calm": "ruhig (weicher Pad, leises Arpeggio)", "dread": "düster (tiefer Drone)",
    "tension": "Spannung (Puls, Streicher-Tremolo)", "peak": "Höhepunkt (Puls + Schläge)",
    "silence": "Stille (Musik aus)", "outro": "Abspann (Drone + Pad)",
}
TITLES = {1: "Teil 1 – Der Stromausfall", 2: "Teil 2 – Die Stimme im Funkgerät"}


def ts(t):
    return f"{int(t // 60):02d}:{t % 60:05.2f}"


def build(teil):
    tl = json.load(open(os.path.join(ROOT, "PROJECT_FILES", f"TEIL_{teil}", "timeline.json")))
    out_txt = os.path.join(ROOT, "EXPORT", f"BLACKOUT_TEIL_{teil}_DREHBUCH.txt")
    out_pdf = os.path.join(ROOT, "EXPORT", f"BLACKOUT_TEIL_{teil}_DREHBUCH.pdf")
    from drehbuch_data import TEILE
    sfx_of = {s["n"]: s["sfx"] for s in TEILE[teil]}

    lines = [f"BLACKOUT HAMBURG – DREHBUCH {TITLES[teil].upper()}",
             f"Länge: {tl['gesamtdauer']:.1f} s · Format 1080 x 1920 (9:16) · 30 fps", "",
             "SPRECHERROLLEN:"] + [f"  {k}: {v}" for k, v in ROLES.items()] + [""]
    for sc in tl["szenen"]:
        lines.append(f"SZENE {sc['szene']:02d}  [{ts(sc['start'])} – {ts(sc['start'] + sc['dauer'])}, {sc['dauer']:.2f} s]")
        lines.append(f"  Bild:        EXTRACTED_IMAGES/TEIL_{teil}/original_1080x1920/szene_{sc['szene']:02d}.png")
        lines.append(f"  Text im Bild: {(sc['text_im_bild'] or '–').replace('**', '')}")
        if sc["sprache"]:
            for v in sc["sprache"]:
                lines.append(f"  {v['rolle']:<5} ({v['dauer']:.1f} s ab {ts(v['start'])}): {v['text']}")
        else:
            lines.append("  (kein Text – nur Geräusch)")
        lines.append(f"  Geräusche:   {', '.join(SFX_NAMES[s[0]] for s in sfx_of[sc['szene']]) or '–'}")
        lines.append(f"  Musik:       {MUSIC_NAMES[sc['musik']]}")
        lines.append(f"  Animation:   {sc['animation']}  (Übergang: {sc['uebergang']}, Effekt: {sc['effekt'] or '–'})")
        lines.append("")
    open(out_txt, "w").write("\n".join(lines))

    pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    pdfmetrics.registerFont(TTFont("DVB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
    st = ParagraphStyle("n", fontName="DV", fontSize=8.5, leading=11)
    stb = ParagraphStyle("b", fontName="DVB", fontSize=9.5, leading=12)
    h1 = ParagraphStyle("h", fontName="DVB", fontSize=18, leading=22, spaceAfter=4)
    doc = SimpleDocTemplate(out_pdf, pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm,
                            topMargin=12 * mm, bottomMargin=12 * mm, title=f"Blackout Hamburg {TITLES[teil]}")
    story = [Paragraph(f"BLACKOUT HAMBURG – {TITLES[teil]}", h1),
             Paragraph(f"Drehbuch · Länge {tl['gesamtdauer']:.1f} s · 1080 × 1920 · 30 fps", st), Spacer(1, 4),
             Paragraph("<br/>".join(f"<b>{k}</b>: {v}" for k, v in ROLES.items()), st), Spacer(1, 8)]
    rows = []
    for sc in tl["szenen"]:
        img = os.path.join(ROOT, "EXTRACTED_IMAGES", f"TEIL_{teil}", "original_1080x1920", f"szene_{sc['szene']:02d}.png")
        speech = "<br/>".join(f"<b>{v['rolle']}</b> ({v['dauer']:.1f} s): {v['text']}" for v in sc["sprache"]) \
            or "<i>kein Text – nur Geräusch</i>"
        info = (f"<b>Szene {sc['szene']}</b> · {ts(sc['start'])} · {sc['dauer']:.2f} s<br/>"
                f"<b>Text im Bild:</b> {(sc['text_im_bild'] or '–').replace('**', '')}<br/>{speech}<br/>"
                f"<b>Geräusche:</b> {', '.join(SFX_NAMES[s[0]] for s in sfx_of[sc['szene']]) or '–'}<br/>"
                f"<b>Musik:</b> {MUSIC_NAMES[sc['musik']]}<br/>"
                f"<b>Animation:</b> {sc['animation']} (Übergang: {sc['uebergang']})")
        rows.append([RLImage(img, width=27 * mm, height=48 * mm), Paragraph(info, st)])
    t = Table(rows, colWidths=[31 * mm, None])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.grey),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 5)]))
    story.append(t)
    doc.build(story)
    return out_txt, out_pdf


if __name__ == "__main__":
    for teil in [int(a) for a in sys.argv[1:]] or (1, 2):
        print(build(teil))
