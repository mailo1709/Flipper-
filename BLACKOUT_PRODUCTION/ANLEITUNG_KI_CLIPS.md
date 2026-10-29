# Optional: Szenen mit einer Bild-zu-Video-KI noch lebendiger machen

Die fertigen Videos in `EXPORT/` sind bereits komplett: Animation, drei Stimmen, Geräusche, Musik und Untertitel.
Wer einzelne Szenen zusätzlich mit einer Video-KI (z. B. Kling AI) bewegen will, macht das so:

| # | Schritt | Wer | Tool | Kosten |
|---|---|---|---|---|
| 1 | Bild holen: `EXTRACTED_IMAGES/TEIL_X/original_1080x1920/szene_XX.png` (ohne Text, volle Auflösung) | du | GitHub im Browser | 0 € |
| 2 | In Kling AI: **Bild zu Video** → Bild hochladen → Stil-Satz + Szenen-Prompt aus `PROJECT_FILES/TEIL_X/ki_bild_zu_video_prompts.txt` → 5 s → Generieren | du klickst, die KI animiert | Kling AI (Ausweichen: Hailuo oder Vidu) | tägliche Gratis-Credits (Wasserzeichen möglich) |
| 3 | Clip als `szene_XX.mp4` speichern und in `BLACKOUT_PRODUCTION/KI_CLIPS/TEIL_X/` hochladen (github.com → „Add file → Upload files“) | du | GitHub | 0 € |
| 4 | Schreib mir „KI-Clips sind drin“. Ich rendere neu: Der Clip ersetzt die gezeichnete Szene, Uhr, Text, Untertitel, Stimmen und Sound bleiben. | Claude | `produce.py` | 0 € |

Tipps:
- **Immer den Stil-Satz** mitschicken, sonst macht die KI 3D oder Realismus.
- **Wenig Bewegung** verlangen, sonst verformen sich die Gesichter. Wenn Jonas sich verändert: Clip verwerfen. Die gezeichnete Animation reicht.
- Szenen dauern 1–4 s, und vom Clip wird nur der Anfang genutzt. Die Bewegung muss also gleich am Anfang passieren.
- Nur Szenen mit ★ lohnen sich.

Neu rendern (in `BLACKOUT_PRODUCTION/SCRIPTS`):

```
python3 produce.py 2                  # Teil 2 komplett
python3 produce.py 2 --scenes 4 17    # nur Szene 4 und 17 neu
```
