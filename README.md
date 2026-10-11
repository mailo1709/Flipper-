# 🕹️ NOVA ARCADE

Eine kleine **Mini-Arcade** fürs Handy — ein Startmenü mit mehreren Spielen,
Schwierigkeitsstufen, Skins und einer Bestenliste. Läuft komplett im Browser,
lässt sich als **App installieren** (PWA) und funktioniert **offline**.
Nur HTML, CSS und reines JavaScript mit eigener Physik. Kein Framework, kein Build.

## 🎮 Die Spiele

| Spiel | Beschreibung |
| --- | --- |
| **🔴 NOVA PRISMA** | Flipper mit **40 Leveln** und eigener Physik. Startet wie ein echter alter Flipper aus der Spielbude (Retro-Look, Scanlines) und wird mit jedem Abschnitt **moderner** — über 16-Bit und Neon bis zum futuristischen Hyper-Holo. Bumper, Slingshots, Targets, Pegs, umlaufende Asteroiden, rotierende Windräder, Wurmlöcher, Schwarze Löcher und das PRISMA-Multiball. |
| **🧱 BLOCK NOVA** | Breakout/Arkanoid — Blöcke zerlegen, Wellen überstehen, Paddle per Wischen oder Tasten. |
| **🟢 GRID SNAKE** | Der Klassiker. Wisch-Steuerung aufs Handy, D-Pad oder Pfeiltasten. |

### Die 4 Epochen von NOVA PRISMA (wird immer moderner)
1. **Level 1–8 · „Spielbude '74"** – Retro: warmes Bernstein/Holz, flache Bumper, CRT-Scanlines, nur die klassischen Elemente.
2. **Level 9–18 · „16-Bit Arcade"** – knalligere Farben, erste Pegs & Asteroiden.
3. **Level 19–30 · „Neon Modern"** – voller Neon-Glow, Wurmlöcher, Windräder, Schwarze Löcher.
4. **Level 31–40 · „Hyper Holo"** – holografisches Cyan/Magenta/Lime, alles schneller und dichter.

## ⚙️ Features

- **3 Schwierigkeitsstufen** (Chill / Normal / Hardcore) – ändern Schwerkraft, Anzahl Kugeln/Leben, Tempo der Hindernisse und die Levelziele.
- **5 Kugel-Skins** (Chrom, Lava, Toxic, Gold, Plasma) – färben Ball, Schweif und Akzente.
- **Bestenliste** pro Spiel (Top 10) mit Namen. Lokal gespeichert → „Pass & Play" gegen Freunde am selben Gerät.
- **Fortschritt & Highscore** werden im Browser gespeichert; bei NOVA PRISMA steigst du mit „Weiter" wieder im höchsten Level ein.
- **Installierbar** als App, Vollbild, **offline** spielbar.

## 🎯 Steuerung

- **Flipper:** `A`/`←` & `D`/`→` oder die Buttons ◄ ► · **Feder:** `Leertaste`/`↓` halten & loslassen oder Button „FEDER".
- **Breakout:** Paddle per Wischen/Maus oder ◄ ► · Abschuss per Tipp/`Leertaste`.
- **Snake:** Wischen, D-Pad oder Pfeiltasten/`WASD`.

## 📱 Als App aufs Handy

1. Spiel-URL (siehe „GitHub Pages") im **Handy-Browser** öffnen.
2. **iPhone (Safari):** Teilen → **„Zum Home-Bildschirm"**. **Android (Chrome):** Menü ⋮ → **„App installieren"**.
3. Fertig — eigenes Icon, Vollbild, offline.

## 🚀 Testen & Veröffentlichen

- **Schnell am PC:** Repo als ZIP laden (grüner `Code`-Button → `Download ZIP`), entpacken, `index.html` öffnen.
- **Über GitHub Pages (für Handy & Offline-Modus):** Repo → **Settings → Pages** → *Source:* **Deploy from a branch** → Branch `claude/moderne-flipper-app-7zv3hi`, Ordner `/ (root)` → **Save**. Nach ~1 Min erreichbar unter `https://<user>.github.io/<repo>/`.

## 🗂️ Aufbau

```
index.html             – Hub-Shell (Menü, Stage, Bestenliste, Einstellungen)
app.js                 – Hub-Logik: Navigation, Schwierigkeit, Skins, Bestenliste
styles.css             – Layout & Theming
games/pinball.js       – NOVA PRISMA (40 Level, 4 Epochen, Physik)
games/breakout.js      – BLOCK NOVA
games/snake.js         – GRID SNAKE
manifest.webmanifest   – App-Metadaten
service-worker.js      – Offline-Cache
icon-192 / 512 / 180   – App-Icons
```

## 💡 Ausblick

Online-Bestenliste und echtes Mehrspieler (gegen Freunde über Internet) brauchen
einen kleinen Server/Backend — das lokale Pass-&-Play ist der Start. Weitere
Minigames lassen sich einfach als `games/<name>.js` mit
`window.NA.register(...)` ergänzen.

---

Viel Spaß in der NOVA ARCADE. 🔵🔴🟡
