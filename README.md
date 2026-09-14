# 🌌 NOVA PRISMA — Neon Weltraum Flipper

Ein moderner, selbstgebauter **Flipper (Pinball)** im Neon-Weltraum-Look.
Läuft komplett im Browser — kein Download, keine Installation, keine Frameworks.
Nur HTML, CSS und eine eigene 2D-Physik-Engine in reinem JavaScript.

> **Ziel:** Drei Energie-Kerne zünden — **Azur (blau)**, **Inferno (rot)** und
> **Solaris (gelb)** — dazu die drei Ziel-Platten umlegen. Wer alles zum Leuchten
> bringt, löst **PRISMA** aus: fetter Bonus, höherer Multiplikator und **Multiball**.

## 🎮 Steuerung

| Aktion | Tastatur | Touch |
| --- | --- | --- |
| Linker Flipper | `A` oder `←` | Button ◄ links |
| Rechter Flipper | `D` oder `→` | Button ► rechts |
| Feder spannen & abschießen | `Leertaste` / `↓` **halten und loslassen** | Button **FEDER** halten |
| Spiel starten / neue Runde | `Enter` | **START** |

Je länger du die Feder hältst, desto stärker wird die Kugel abgeschossen.

## ✨ Features

- **Eigene Physik**: Schwerkraft, Substepping gegen Durchtunneln, realistischer
  Flipper-Schwung (die Winkelgeschwindigkeit des Flippers wird auf die Kugel übertragen).
- **Neon-Optik** in den Hauptfarben **Blau / Rot / Gelb** mit Glow, Kugel-Schweif,
  Sternenfeld und Bildschirm-Shake.
- **Hindernisse**: 3 Bumper-Kerne, 2 Slingshots, 3 Drop-Targets, Leitkurven & Inlanes.
- **Multiball & Multiplikator** über das PRISMA-Feature.
- **Highscore** wird lokal im Browser gespeichert.
- **Mobil spielbar** mit Touch-Buttons.

## 🚀 Spielen

### Lokal
Einfach `index.html` im Browser öffnen. Fertig.

### Über GitHub Pages
Der Workflow unter `.github/workflows/pages.yml` veröffentlicht das Spiel
automatisch, sobald auf den `main`-Branch gepusht wird. Danach unter
**Settings → Pages** die Quelle auf *GitHub Actions* stellen — das Spiel ist
dann unter `https://<user>.github.io/<repo>/` erreichbar.

## 🗂️ Aufbau

```
index.html    – Seite & Bedienelemente
styles.css    – Neon-Rahmen, Layout, Touch-Buttons
game.js       – Physik-Engine, Spiellogik und Rendering (Canvas 2D)
```

## 📈 Punkte

| Ereignis | Punkte |
| --- | --- |
| Bumper (ungezündet / gezündet) | 100 / 250 |
| Slingshot | 50 |
| Drop-Target | 500 |
| Alle Targets | +1.500 |
| **PRISMA** (alle Kerne + Targets) | +5.000, Multiplikator +1, Multiball |

Alle Punkte werden mit dem aktuellen Multiplikator multipliziert.

---

Viel Spaß — und lass die Kugel leuchten. 🔵🔴🟡
