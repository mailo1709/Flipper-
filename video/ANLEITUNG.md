# Blackout Hamburg – Bilder mit KI bewegt machen

Ziel: Die flachen Cartoon-Bilder bekommen echte, leichte Bewegungen (Jonas blinzelt, Kerze flackert, Leute laufen …). Das Video wird danach automatisch fertig zusammengebaut, mit Uhr, Text, Alarm-Punkt und Sound.

## Was du schon hast (alles in `video/output/`)

| Datei | Wofür |
|---|---|
| `blackout_teil1.mp4` / `blackout_teil2.mp4` | Fertige Videos (nur Zoom und Wackeln). Kannst du sofort posten. |
| `teilX_bilder_fuer_ki/szene_XX.png` | Saubere Bilder **ohne Text und Uhr**. Die lädst du in die Video-KI hoch. |
| `ki_prompts_teilX.txt` | Bewegungs-Prompt pro Szene. ★ = lohnt sich. |
| `sprecher_teilX.txt` | Sprechertext mit Startzeit |
| `sounds_zum_ersetzen_teilX.txt` | Zeitstempel für bessere Sounds in CapCut |
| `cover_teilX.png`, `beschreibung_teilX.txt` | Titelbild und Posting-Text |

## Welche KI macht was

| Aufgabe | Empfehlung | Kostenlos? | Hast du? |
|---|---|---|---|
| Bilder zeichnen, Story, Prompts, Video zusammenbauen | **Claude** (hier) | in Claude Pro enthalten | ✅ |
| Bild → bewegtes Video (5-s-Clips) | **Kling AI** (App oder klingai.com) | Ja, tägliche Gratis-Credits. Gratis-Clips haben teils ein Wasserzeichen. | neu holen |
| Ausweich-Tool, wenn die Credits alle sind | **Hailuo AI** (MiniMax) oder **Vidu** | Ja, Gratis-Credits (Menge wechselt) | neu holen |
| Sprecherstimme | **CapCut Text-zu-Sprache** oder deine eigene Stimme | Ja | – |
| Sprecherstimme (schöner) | ElevenLabs Free: 10.000 Credits/Monat, aber **nur privat, nicht für monetarisierte Kanäle**. Für TikTok-Geld: Starter ca. 5–6 $/Monat. | teilweise | ❌ nicht nötig |
| „Funkstimme“-Effekt | CapCut → Audio → Stimmeffekte (z. B. „Megafon“ / „Radio“) | Ja | – |
| Bessere Soundeffekte | CapCut-Soundbibliothek oder pixabay.com/sound-effects | Ja | – |
| Schnitt, Stimme drüberlegen, Export | **CapCut** (App) | Ja, Pro nicht nötig | ✅ |
| Neue Bilder generieren (Midjourney, ChatGPT-Bild …) | **Nicht nötig.** Bilder kommen von Claude. Fremde Bild-KIs zeichnen Jonas jedes Mal anders. | – | – |

> Preise und Gratis-Kontingente ändern sich ständig. Prüf kurz die aktuelle Seite des Tools, bevor du loslegst.

## Ablauf (Reihenfolge)

| # | Schritt | Wer | Tool | Kosten | Zeit |
|---|---|---|---|---|---|
| 1 | Story, Bilder, Prompts und Rohvideo erstellen | Claude | – | 0 € | erledigt ✅ |
| 2 | Kling AI installieren und mit Google/Apple anmelden | **du** | Kling AI | 0 € | 2 min |
| 3 | `teilX_bilder_fuer_ki/` auf dein Handy laden (GitHub → Ordner → Bild → Download) | **du** | Browser | 0 € | 5 min |
| 4 | In Kling: **Bild zu Video** → Bild hochladen → Prompt aus `ki_prompts_teilX.txt` einfügen (Stil-Satz + Szenen-Satz) → **5 s**, günstigster Modus → Generieren | **du**, die KI animiert | Kling AI | Gratis-Credits | ca. 1–3 min pro Clip |
| 5 | Nur die ★-Szenen machen (ca. 12–15 pro Teil). Wenn die Credits leer sind: am nächsten Tag weiter oder Hailuo/Vidu nehmen. | **du** | Kling / Hailuo | 0 € | 2–4 Tage mit Gratis-Credits |
| 6 | Clips **genau so** benennen: `szene_04.mp4` (Nummer = Szene) | **du** | – | 0 € | 5 min |
| 7 | Clips hochladen: auf github.com in deinem Repo `Flipper-` → Ordner `video/ki_clips/teil2/` → „Add file → Upload files“. Alternativ hier in den Chat schicken. | **du** | GitHub | 0 € | 5 min |
| 8 | Sag mir „Clips sind drin, Teil 2 bauen“. Ich schneide jeden Clip auf seine Szenenlänge und lege Uhr, Text, blinkenden Alarm-Punkt und Sound drüber. Szenen ohne Clip behalten den Zoom. | Claude | Skript `make_video.py` | 0 € | ein paar Minuten |
| 9 | Fertiges `blackout_teilX.mp4` in CapCut öffnen | **du** | CapCut | 0 € | 1 min |
| 10 | Stimme: Text aus `sprecher_teilX.txt` als Text-zu-Sprache einfügen oder selbst einsprechen und an die Startzeiten schieben. Funkstimme-Zeilen mit Stimmeffekt „Radio/Megafon“. | **du** | CapCut | 0 € | 20–30 min |
| 11 | Optional: bessere Sounds an die Zeitstempel aus `sounds_zum_ersetzen_teilX.txt` legen und die Originalspur leiser machen | **du** | CapCut | 0 € | 10 min |
| 12 | Export 1080p / 30 fps, Cover `cover_teilX.png`, Text aus `beschreibung_teilX.txt` | **du** | CapCut / TikTok | 0 € | 5 min |

## Tipps für gute KI-Clips

- **Immer den Stil-Satz** aus der Prompt-Datei mitschicken. Sonst macht die KI daraus 3D oder Realismus.
- Lieber **wenig Bewegung** verlangen. Viel Bewegung verformt Gesichter.
- Wenn Jonas sich verformt: neu generieren oder die Szene einfach ohne KI lassen (der Zoom reicht).
- Gratis-Clips können ein Wasserzeichen in der Ecke haben. Wenn es stört: das Tool einen Monat bezahlen oder die Szene ohne KI lassen.
- Nur Szenen mit ★ animieren. Text-, Akku- und Countdown-Szenen funktionieren ohne KI besser.
- Szenen sind 1–2,5 s lang. Aus jedem 5-s-Clip wird automatisch nur der Anfang genommen. Die wichtige Bewegung muss also **gleich am Anfang** passieren.

## Teil 2 – Inhalt

Weiter mit Antwort **A** (Jonas antwortet). Wichtigste Wendungen: Die Stimme warnt, dass der Tunnel eine Falle ist. Danach kommt eine echte Vorsorge-Regel: **2 Liter Wasser pro Person und Tag, Vorrat für 10 Tage (BBK)**. Dann sagt die Stimme: „Ich bin's. Opa.“ Aber Opa ist seit 3 Jahren tot. Jemand drückt die Türklinke. Neue Wahl: **A Tür auf / B Fenster**.
Haben die meisten bei Teil 1 **B** gewählt? Dann sag Bescheid, und ich baue eine B-Version von Teil 2.

## Technik (für Claude / Nachbau)

```
python3 video/make_video.py --teil 2          # alles rendern
python3 video/make_video.py --teil 2 4 17     # nur Szene 4 und 17 neu
```

KI-Clips unter `video/ki_clips/teilX/szene_XX.mp4` werden automatisch statt des Standbilds benutzt.
