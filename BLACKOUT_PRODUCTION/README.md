# BLACKOUT HAMBURG – Produktion

Zwei fertige TikTok-Videos (9:16, 1080 × 1920, 30 fps, H.264 + AAC) mit Animation, drei deutschen Stimmen, Geräuschen, Musik und Untertiteln. Alles läuft lokal, ist kostenlos und braucht kein Konto.

## Ordner

| Ordner | Inhalt |
|---|---|
| `INPUT/` | Kontaktbögen beider Teile |
| `EXTRACTED_IMAGES/` | Einzelbilder aus den Kontaktbögen, Originale in 1080 × 1920, Übersicht |
| `SCRIPTS/` | Komplette Pipeline (siehe unten) |
| `VOICE/` | Stimmen-Spur und einzelne Sprecherzeilen (WAV, werden beim Rendern erzeugt) |
| `SOUND_EFFECTS/`, `MUSIC/` | Geräusch- und Musikspur (WAV, werden beim Rendern erzeugt) |
| `PROJECT_FILES/` | Timeline (JSON/CSV), finale Mischung, Video-Segmente, KI-Prompts |
| `EXPORT/` | Fertige Videos, Untertitel (SRT), Drehbücher (PDF/TXT), Cover, Beschreibung, Produktionsbericht |
| `LOGS/` | Produktionslog, Qualitätskontrolle, Kontaktblätter aus dem fertigen Video |
| `KI_CLIPS/` | Optionale Bild-zu-Video-Clips, siehe `ANLEITUNG_KI_CLIPS.md` |

## Neu rendern

```
cd BLACKOUT_PRODUCTION/SCRIPTS
./setup.sh                      # einmalig: Python-Pakete + Piper-Stimmen
python3 extract_images.py       # Phase 1: Bilder extrahieren und prüfen
python3 produce.py 1            # Teil 1 (Stimmen, Sound, Musik, Animation, Untertitel, Export)
python3 produce.py 2            # Teil 2
python3 drehbuch_export.py      # Drehbücher TXT + PDF
python3 extras.py               # Cover, Beschreibung, KI-Prompts
python3 qc.py                   # Qualitätskontrolle
```

Texte ändern: `SCRIPTS/drehbuch_data.py` (Sprecher, Text, Geräusche, Musik, Dauer).
Bilder ändern: `SCRIPTS/blackout_draw.py`.
Nur einzelne Szenen neu animieren: `python3 produce.py 1 --scenes 3 17`.

## Skripte

- `blackout_draw.py`: alle Illustrationen als Vektorgrafik, inklusive Animation (Blinzeln, Atmen, Kerzenflackern, laufende Menge …)
- `drehbuch_data.py`: Drehbuch beider Teile
- `voices.py`: Stimmen mit Piper (lokal); ElevenLabs optional über die Umgebungsvariable `ELEVENLABS_API_KEY`
- `audio_synth.py`: alle Geräusche und die Musik, selbst synthetisiert und damit rechtefrei
- `produce.py`: Timeline, Mischung mit Ducking, Lautheit −14 LUFS, Frame-Rendering, SRT, Export
- `extract_images.py`, `drehbuch_export.py`, `extras.py`, `qc.py`: Hilfsskripte
