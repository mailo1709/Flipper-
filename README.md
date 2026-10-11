# 🌌 NOVA PRISMA — Neon Weltraum Flipper · 30 Level

Ein moderner, selbstgebauter **Flipper (Pinball)** im Neon-Weltraum-Look mit
**30 Leveln**. Läuft komplett im Browser — kein Download nötig — und lässt sich
als **App auf dem Handy installieren** (PWA, offline spielbar).
Nur HTML, CSS und eine eigene 2D-Physik-Engine in reinem JavaScript. Kein Framework.

> **Ziel:** Jedes Level hat ein eigenes Ziel (Punkte erreichen, alle Ziele löschen
> oder **PRISMA** zünden). Schaffst du es, geht's ins nächste Level — bis du in
> **Level 30 „PRISMA GALAXIE"** die Galaxie rettest.

## 🎮 Steuerung

| Aktion | Tastatur | Touch (Handy) |
| --- | --- | --- |
| Linker Flipper | `A` oder `←` | Button ◄ links |
| Rechter Flipper | `D` oder `→` | Button ► rechts |
| Feder spannen & abschießen | `Leertaste` / `↓` **halten und loslassen** | Button **FEDER** halten |
| Start / neue Runde | `Enter` | **START** |
| Weiter beim höchsten Level | `C` | — |

Je länger du die Feder hältst, desto stärker wird die Kugel abgeschossen.
Pro Level hast du **3 Kugeln**. Schaffst du das Levelziel, geht's weiter; gehen
alle Kugeln verloren, kannst du das Level erneut starten. Dein höchstes Level
und der Highscore werden im Browser gespeichert.

## 🪐 Hindernisse (selbst ausgedacht)

- **Bumper-Kerne** — Azur (blau), Inferno (rot), Solaris (gelb), stoßen kräftig ab
- **Slingshots** — die Prallflächen über den Flippern
- **Drop-Targets** — Ziele, die umklappen
- **Pegs** — kleine Prellstifte (Plinko-Style)
- **Asteroiden** — umlaufende Felsbrocken, die die Kugel im Flug treffen
- **Windräder** — rotierende Neon-Arme, die die Kugel herumschleudern
- **Wurmlöcher** — teleportieren die Kugel von einem Ende zum anderen
- **Schwerkraftfallen / Schwarze Löcher** — ziehen die Kugel an und krümmen ihre Bahn
- **PRISMA** — alle Kerne + alle Ziele zünden → Riesen-Bonus, Multiplikator & **Multiball**

Mit steigendem Level kommen mehr und schnellere Hindernisse dazu
(Sektoren von „Startrampe" bis „Supernova" und „PRISMA GALAXIE").

## 📱 Als App aufs Handy holen

1. Öffne die Spiel-URL (siehe unten „GitHub Pages") im **Handy-Browser**.
2. **iPhone (Safari):** Teilen-Symbol → **„Zum Home-Bildschirm"**.
   **Android (Chrome):** Menü ⋮ → **„App installieren"** bzw. „Zum Startbildschirm hinzufügen".
3. Fertig — NOVA PRISMA liegt mit eigenem Icon auf dem Home-Bildschirm,
   startet im Vollbild und funktioniert auch offline.

## 🚀 Spielen & Testen

### Sofort lokal testen
`index.html` einfach im Browser (am PC) öffnen — läuft direkt.
*(Hinweis: Der Offline-Modus/Service-Worker aktiviert sich nur über `https`
bzw. GitHub Pages, nicht über `file://` — das Spiel selbst läuft trotzdem.)*

### Über GitHub Pages (für den Handy-Zugriff)
Repo → **Settings → Pages** → *Source:* **Deploy from a branch** →
Branch auf diesen Branch stellen, Ordner `/ (root)` → **Save**.
Nach ~1 Minute ist das Spiel erreichbar unter:
`https://<dein-user>.github.io/<repo>/`
Diese URL auf dem Handy öffnen und wie oben als App installieren.

*(Alternativ veröffentlicht der Workflow `.github/workflows/pages.yml` das Spiel
automatisch beim Push auf `main`, wenn unter Settings → Pages „GitHub Actions"
als Quelle gewählt ist.)*

## 🗂️ Aufbau

```
index.html             – Seite, Bedienelemente, PWA-Einbindung
styles.css             – Neon-Rahmen, Layout, Touch-Buttons
game.js                – Physik-Engine, 30 Level, Hindernisse, Rendering
manifest.webmanifest   – App-Metadaten (Name, Icons, Vollbild)
service-worker.js      – Offline-Cache
icon-192 / 512 / 180   – App-Icons
```

## 📈 Punkte

| Ereignis | Punkte |
| --- | --- |
| Peg | 25 |
| Slingshot | 50 |
| Windrad-Arm | 75 |
| Bumper (ungezündet / gezündet) | 100 / 250 |
| Asteroid | 120 |
| Wurmloch | 200 |
| Drop-Target | 500 |
| Alle Targets | +1.500 |
| **PRISMA** | +5.000, Multiplikator +1, Multiball |
| Level geschafft | +2.000 (steigt pro Level) |

Alle Punkte werden mit dem aktuellen Multiplikator multipliziert.

---

Viel Spaß — rette die PRISMA GALAXIE. 🔵🔴🟡
