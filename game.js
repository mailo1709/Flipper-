/* =============================================================
   NOVA PRISMA — Neon Weltraum Flipper
   Eigene 2D-Physik-Engine, kein Framework.
   Steuerung:
     A / Pfeil links   -> linker Flipper
     D / Pfeil rechts  -> rechter Flipper
     Leertaste / unten -> Feder aufladen (halten) & loslassen (Kugel abschiessen)
     Enter             -> Spiel starten / neue Kugel
   Auf dem Handy: Buttons unten am Bildschirm.
   ============================================================= */

(() => {
  'use strict';

  // ---- Leinwand / Auflösung ---------------------------------
  const canvas = document.getElementById('table');
  const ctx = canvas.getContext('2d');
  const W = 520, H = 880;          // interne Spielfeldgröße
  canvas.width = W;
  canvas.height = H;

  // ---- Farbwelt (Blau / Rot / Gelb) -------------------------
  const COL = {
    blue:   '#1f6bff',
    blueHi: '#5aa0ff',
    red:    '#ff2f5e',
    redHi:  '#ff6f8f',
    yellow: '#ffd233',
    yelHi:  '#fff08a',
    wall:   '#3a4b8f',
    wallHi: '#6f86e8',
    bg0:    '#05030f',
    bg1:    '#120a2e',
    text:   '#eef1ff'
  };
  const CORES = ['blue', 'red', 'yellow'];

  // ---- Hilfsfunktionen --------------------------------------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  // ============================================================
  //  Geometrie des Tisches
  // ============================================================
  // Segmente = feste Wände {a:{x,y}, b:{x,y}, bounce, kind, key}
  const segments = [];
  function seg(ax, ay, bx, by, opt = {}) {
    segments.push({
      a: { x: ax, y: ay }, b: { x: bx, y: by },
      bounce: opt.bounce ?? 0.35,
      kind: opt.kind || 'wall',
      key: opt.key || null,
      glow: 0
    });
  }
  // Polylinie aus Punktliste
  function poly(points, opt) {
    for (let i = 0; i < points.length - 1; i++) {
      seg(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], opt);
    }
  }
  // Bogen als Polylinie
  function arc(cx, cy, r, a0, a1, steps, opt) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    poly(pts, opt);
    return pts;
  }

  const PLUNGER_X = 470;           // Mitte der Federgasse
  const LANE_LEFT = 442;           // Trennwand Spielfeld/Federgasse
  const RIGHT = 500;               // äußere rechte Wand

  function buildTable() {
    segments.length = 0;

    // Äußere linke Wand + oberer Bogen
    poly([[20, 700], [20, 200]], { bounce: 0.3 });
    arc(150, 200, 130, Math.PI, Math.PI * 1.5, 22, { bounce: 0.4 }); // oben links
    poly([[150, 70], [360, 70]], { bounce: 0.4 });                    // Decke
    arc(360, 200, 130, Math.PI * 1.5, Math.PI * 2, 22, { bounce: 0.4 }); // oben rechts (Richtung Gasse)

    // Trennwand der Federgasse (rechts). Oben eine Lücke -> Kugel schiesst raus.
    poly([[LANE_LEFT, 250], [LANE_LEFT, 792]], { bounce: 0.25 });
    // Einweg-Leitkurve oben: lenkt die Kugel aus der Gasse nach links ins Feld
    arc(360, 200, 120, Math.PI * 1.5, Math.PI * 2.05, 16, { bounce: 0.35 });

    // Äußere rechte Wand + Boden der Federgasse
    poly([[RIGHT, 130], [RIGHT, 838]], { bounce: 0.25 });
    poly([[LANE_LEFT, 838], [RIGHT, 838]], { bounce: 0.2 }); // Boden unter Feder

    // Untere Trichter zu den Flippern (Inlanes)
    poly([[20, 700], [120, 792]], { bounce: 0.2 });          // linke Rampe zum Flipper
    poly([[LANE_LEFT, 792], [400, 792]], { bounce: 0.2 });   // rechte Rampe (innen)

    // Slingshots (dreieckige Prallflächen über den Flippern)
    seg(120, 640, 120, 720, { bounce: 1.15, kind: 'sling', key: 'slingL' }); // linke Slingshot-Fläche
    seg(400, 640, 400, 720, { bounce: 1.15, kind: 'sling', key: 'slingR' }); // rechte Slingshot-Fläche

    // Obere Ablenker (kleine Bänder um die Bumper)
    seg(150, 430, 120, 500, { bounce: 0.6, kind: 'wall' });
    seg(370, 430, 400, 500, { bounce: 0.6, kind: 'wall' });
  }

  // ---- Bumper (runde Prallkörper) ---------------------------
  let bumpers = [];
  function buildBumpers() {
    bumpers = [
      { x: 175, y: 300, r: 30, core: 'blue',   glow: 0, lit: false },
      { x: 345, y: 300, r: 30, core: 'red',    glow: 0, lit: false },
      { x: 260, y: 210, r: 32, core: 'yellow', glow: 0, lit: false }
    ];
  }

  // ---- Drop-Targets (Ziele die man umlegt) ------------------
  let targets = [];
  function buildTargets() {
    targets = [
      { x: 200, y: 150, w: 26, h: 12, down: false, core: 'blue' },
      { x: 260, y: 138, w: 26, h: 12, down: false, core: 'yellow' },
      { x: 320, y: 150, w: 26, h: 12, down: false, core: 'red' }
    ];
  }

  // ============================================================
  //  Flipper
  // ============================================================
  function makeFlipper(px, py, len, restAngle, upAngle, side) {
    return {
      px, py, len,
      rest: restAngle, up: upAngle,
      angle: restAngle, prevAngle: restAngle,
      omega: 0, side,
      pressed: false
    };
  }
  const flipperSpeed = 26; // rad/s
  let flipperL, flipperR;
  function buildFlippers() {
    flipperL = makeFlipper(168, 772, 96, 0.42, -0.5, 'L');
    flipperR = makeFlipper(352, 772, 96, Math.PI - 0.42, Math.PI + 0.5, 'R');
  }
  function flipperTip(f) {
    return { x: f.px + Math.cos(f.angle) * f.len, y: f.py + Math.sin(f.angle) * f.len };
  }
  function updateFlipper(f, dt) {
    f.prevAngle = f.angle;
    const target = f.pressed ? f.up : f.rest;
    const d = target - f.angle;
    const step = flipperSpeed * dt * Math.sign(d);
    if (Math.abs(step) >= Math.abs(d)) f.angle = target;
    else f.angle += step;
    f.omega = (f.angle - f.prevAngle) / dt;
  }

  // ============================================================
  //  Kugeln
  // ============================================================
  const BALL_R = 11;
  let balls = [];
  function spawnBallOnPlunger() {
    balls.push({ x: PLUNGER_X, y: 800, vx: 0, vy: 0, r: BALL_R, onPlunger: true, trail: [] });
  }

  // ============================================================
  //  Spielzustand
  // ============================================================
  const game = {
    state: 'title',      // title | ready | play | over
    score: 0,
    best: Number(localStorage.getItem('novaprisma_best') || 0),
    balls: 3,
    multiplier: 1,
    plunger: 0,          // 0..1 Ladung
    plungerHold: false,
    message: '',
    msgTimer: 0,
    prismaFlash: 0,
    shake: 0
  };

  function resetGame() {
    game.score = 0;
    game.balls = 3;
    game.multiplier = 1;
    game.message = '';
    buildTable();
    buildBumpers();
    buildTargets();
    buildFlippers();
    balls = [];
    startNewBall();
  }
  function startNewBall() {
    balls = [];
    spawnBallOnPlunger();
    game.state = 'ready';
    game.plunger = 0;
    flash('BALL BEREIT — FEDER SPANNEN', 90);
  }

  function flash(text, frames) {
    game.message = text;
    game.msgTimer = frames;
  }

  function addScore(n) {
    game.score += n * game.multiplier;
    if (game.score > game.best) {
      game.best = game.score;
      localStorage.setItem('novaprisma_best', String(game.best));
    }
  }

  // Kern getroffen -> aufleuchten, Prisma prüfen
  function hitCore(core) {
    const b = bumpers.find(x => x.core === core);
    if (b && !b.lit) {
      b.lit = true;
      checkPrisma();
    }
  }
  function checkPrisma() {
    if (bumpers.every(b => b.lit) && targets.every(t => t.down)) {
      // PRISMA! Grosser Bonus + Multiball
      addScore(5000);
      game.multiplier = Math.min(game.multiplier + 1, 6);
      game.prismaFlash = 60;
      game.shake = 18;
      flash('★ PRISMA! MULTIBALL x' + game.multiplier + ' ★', 150);
      bumpers.forEach(b => b.lit = false);
      targets.forEach(t => t.down = false);
      // zwei Extra-Kugeln aus den Bumpern
      for (let i = 0; i < 2; i++) {
        const src = bumpers[i];
        balls.push({ x: src.x, y: src.y, vx: rand(-180, 180), vy: rand(-260, -120), r: BALL_R, onPlunger: false, trail: [] });
      }
    }
  }

  // ============================================================
  //  Kollisionen
  // ============================================================
  function collideSegment(ball, s, dt) {
    const ax = s.a.x, ay = s.a.y, bx = s.b.x, by = s.b.y;
    const abx = bx - ax, aby = by - ay;
    const len2 = abx * abx + aby * aby || 1;
    let t = ((ball.x - ax) * abx + (ball.y - ay) * aby) / len2;
    t = clamp(t, 0, 1);
    const cx = ax + abx * t, cy = ay + aby * t;
    let dx = ball.x - cx, dy = ball.y - cy;
    let dist = Math.hypot(dx, dy);
    if (dist < ball.r) {
      if (dist < 0.0001) { dx = 0; dy = -1; dist = 0.0001; }
      const nx = dx / dist, ny = dy / dist;
      ball.x += nx * (ball.r - dist);
      ball.y += ny * (ball.r - dist);
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        ball.vx -= (1 + s.bounce) * vn * nx;
        ball.vy -= (1 + s.bounce) * vn * ny;
      }
      s.glow = 1;
      if (s.kind === 'sling') {
        ball.vx += nx * 260;
        ball.vy += ny * 260;
        addScore(50);
      }
      return true;
    }
    return false;
  }

  function collideFlipper(ball, f) {
    const tip = flipperTip(f);
    const ax = f.px, ay = f.py, bx = tip.x, by = tip.y;
    const abx = bx - ax, aby = by - ay;
    const len2 = abx * abx + aby * aby || 1;
    let t = ((ball.x - ax) * abx + (ball.y - ay) * aby) / len2;
    t = clamp(t, 0, 1);
    const cx = ax + abx * t, cy = ay + aby * t;
    let dx = ball.x - cx, dy = ball.y - cy;
    let dist = Math.hypot(dx, dy);
    const R = ball.r + 6; // Flipper hat Dicke
    if (dist < R) {
      if (dist < 0.0001) { dx = 0; dy = -1; dist = 0.0001; }
      const nx = dx / dist, ny = dy / dist;
      ball.x += nx * (R - dist);
      ball.y += ny * (R - dist);
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        ball.vx -= 1.25 * vn * nx;
        ball.vy -= 1.25 * vn * ny;
      }
      // Schwung des Flippers auf die Kugel übertragen
      const rpx = cx - f.px, rpy = cy - f.py;
      const surfVX = -f.omega * rpy;
      const surfVY = f.omega * rpx;
      const surfVN = surfVX * nx + surfVY * ny;
      if (surfVN > 0) {
        ball.vx += surfVX * 0.9;
        ball.vy += surfVY * 0.9;
      }
      return true;
    }
    return false;
  }

  function collideBumper(ball, b) {
    const dx = ball.x - b.x, dy = ball.y - b.y;
    const dist = Math.hypot(dx, dy);
    const R = ball.r + b.r;
    if (dist < R) {
      const nx = dx / (dist || 1), ny = dy / (dist || 1);
      ball.x = b.x + nx * R;
      ball.y = b.y + ny * R;
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        ball.vx -= 1.6 * vn * nx;
        ball.vy -= 1.6 * vn * ny;
      }
      // fester Abstosskick
      ball.vx += nx * 300;
      ball.vy += ny * 300;
      b.glow = 1;
      addScore(b.lit ? 250 : 100);
      hitCore(b.core);
      game.shake = Math.max(game.shake, 5);
      return true;
    }
    return false;
  }

  function collideTargets(ball) {
    for (const tg of targets) {
      if (tg.down) continue;
      if (Math.abs(ball.x - tg.x) < tg.w / 2 + ball.r &&
          Math.abs(ball.y - tg.y) < tg.h / 2 + ball.r) {
        tg.down = true;
        ball.vy = Math.abs(ball.vy) * 0.6 + 120; // nach unten abprallen
        addScore(500);
        hitCore(tg.core);
        flash('ZIEL! +500', 45);
        checkPrisma();
        // alle unten? -> neu aufstellen mit Bonus
        if (targets.every(x => x.down)) {
          addScore(1500);
          flash('ALLE ZIELE! +1500', 60);
          setTimeout(() => targets.forEach(x => x.down = false), 900);
        }
      }
    }
  }

  // ============================================================
  //  Physik-Schritt
  // ============================================================
  const GRAV = 1500;
  function stepBall(ball, dt) {
    if (ball.onPlunger) {
      // wartet auf der Feder
      ball.x = PLUNGER_X;
      ball.y = 800 + game.plunger * 26;
      ball.vx = 0; ball.vy = 0;
      return;
    }
    ball.vy += GRAV * dt;
    // Luftreibung leicht
    ball.vx *= 0.9995;
    ball.vy *= 0.9995;
    // Geschwindigkeit begrenzen
    const sp = Math.hypot(ball.vx, ball.vy);
    const MAX = 2200;
    if (sp > MAX) { ball.vx *= MAX / sp; ball.vy *= MAX / sp; }

    // Substepping gegen Durchtunneln
    const move = sp * dt;
    const sub = clamp(Math.ceil(move / (ball.r * 0.5)), 1, 10);
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      ball.x += ball.vx * h;
      ball.y += ball.vy * h;
      for (const s of segments) collideSegment(ball, s, h);
      for (const b of bumpers) collideBumper(ball, b);
      collideFlipper(ball, flipperL);
      collideFlipper(ball, flipperR);
    }
    collideTargets(ball);

    // Trail für Neon-Schweif
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 10) ball.trail.shift();
  }

  function drainCheck() {
    // Kugel unten durch den Abfluss verloren?
    balls = balls.filter(b => {
      if (b.y > H + 40) return false;
      return true;
    });
    if (game.state === 'play' && balls.length === 0) {
      game.balls -= 1;
      game.multiplier = 1;
      if (game.balls <= 0) {
        game.state = 'over';
        flash('GAME OVER', 999999);
      } else {
        startNewBall();
      }
    }
  }

  // ============================================================
  //  Eingabe
  // ============================================================
  function launch() {
    // Feder loslassen -> Kugel abschiessen
    const onFeder = balls.find(b => b.onPlunger);
    if (onFeder) {
      onFeder.onPlunger = false;
      onFeder.vy = -650 - game.plunger * 1250;
      onFeder.vx = rand(-15, 5);
      if (game.state === 'ready') game.state = 'play';
      flash('', 0);
    }
    game.plunger = 0;
  }

  const keys = {};
  function keydown(e) {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') { flipperL.pressed = true; }
    if (k === 'd' || k === 'arrowright') { flipperR.pressed = true; }
    if (k === ' ' || k === 'arrowdown') { game.plungerHold = true; e.preventDefault(); }
    if (k === 'enter') {
      if (game.state === 'title' || game.state === 'over') resetGame();
    }
    keys[k] = true;
  }
  function keyup(e) {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') flipperL.pressed = false;
    if (k === 'd' || k === 'arrowright') flipperR.pressed = false;
    if (k === ' ' || k === 'arrowdown') { game.plungerHold = false; launch(); }
    keys[k] = false;
  }
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);

  // Touch- / Maus-Buttons
  function bindHold(el, onDown, onUp) {
    if (!el) return;
    const d = (e) => { e.preventDefault(); onDown(); };
    const u = (e) => { e.preventDefault(); onUp(); };
    el.addEventListener('touchstart', d, { passive: false });
    el.addEventListener('touchend', u, { passive: false });
    el.addEventListener('mousedown', d);
    el.addEventListener('mouseup', u);
    el.addEventListener('mouseleave', u);
  }
  bindHold(document.getElementById('btnL'), () => flipperL.pressed = true, () => flipperL.pressed = false);
  bindHold(document.getElementById('btnR'), () => flipperR.pressed = true, () => flipperR.pressed = false);
  bindHold(document.getElementById('btnP'), () => game.plungerHold = true, () => { game.plungerHold = false; launch(); });
  const startBtn = document.getElementById('btnStart');
  if (startBtn) startBtn.addEventListener('click', () => {
    if (game.state === 'title' || game.state === 'over') resetGame();
  });

  // ============================================================
  //  Zeichnen
  // ============================================================
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COL.bg1);
    g.addColorStop(1, COL.bg0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Sterne
    ctx.save();
    for (let i = 0; i < 60; i++) {
      const sx = (i * 97 % W);
      const sy = (i * 173 % H);
      ctx.globalAlpha = 0.15 + (i % 5) * 0.12;
      ctx.fillStyle = i % 3 === 0 ? COL.blueHi : i % 3 === 1 ? COL.yelHi : '#ffffff';
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.restore();
  }

  function neonLine(ax, ay, bx, by, color, width, glow) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 + glow * 16;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  }

  function drawTable() {
    for (const s of segments) {
      let color = COL.wall;
      if (s.kind === 'sling') color = COL.yellow;
      const glow = s.glow;
      neonLine(s.a.x, s.a.y, s.b.x, s.b.y, glow > 0.05 ? COL.wallHi : color, s.kind === 'sling' ? 6 : 4, glow);
      s.glow *= 0.85;
    }
    // Federgasse Hinweis
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = COL.blue;
    ctx.fillRect(LANE_LEFT + 4, 260, RIGHT - LANE_LEFT - 8, 560);
    ctx.restore();
  }

  function drawBumpers() {
    for (const b of bumpers) {
      const base = COL[b.core];
      const hi = COL[b.core + 'Hi'] || base;
      ctx.save();
      ctx.shadowColor = base;
      ctx.shadowBlur = 20 + b.glow * 30 + (b.lit ? 15 : 0);
      const g = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, b.r);
      g.addColorStop(0, hi);
      g.addColorStop(1, base);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      // Ring
      ctx.lineWidth = b.lit ? 5 : 3;
      ctx.strokeStyle = b.lit ? '#ffffff' : hi;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 5 + b.glow * 6, 0, TAU);
      ctx.stroke();
      ctx.restore();
      b.glow *= 0.88;
    }
  }

  function drawTargets() {
    for (const tg of targets) {
      ctx.save();
      const c = COL[tg.core];
      if (tg.down) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = c;
      } else {
        ctx.shadowColor = c;
        ctx.shadowBlur = 14;
        ctx.fillStyle = c;
      }
      ctx.fillRect(tg.x - tg.w / 2, tg.y - tg.h / 2, tg.w, tg.h);
      ctx.restore();
    }
  }

  function drawFlipper(f) {
    const tip = flipperTip(f);
    ctx.save();
    ctx.strokeStyle = COL.red;
    ctx.shadowColor = COL.red;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f.px, f.py);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    // Highlight
    ctx.strokeStyle = COL.redHi;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(f.px, f.py);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    // Drehpunkt
    ctx.fillStyle = COL.yellow;
    ctx.beginPath();
    ctx.arc(f.px, f.py, 7, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBalls() {
    for (const ball of balls) {
      // Schweif
      for (let i = 0; i < ball.trail.length; i++) {
        const p = ball.trail[i];
        ctx.save();
        ctx.globalAlpha = (i / ball.trail.length) * 0.4;
        ctx.fillStyle = COL.blueHi;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ball.r * (i / ball.trail.length), 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.shadowColor = COL.blueHi;
      ctx.shadowBlur = 18;
      const g = ctx.createRadialGradient(ball.x - 4, ball.y - 4, 2, ball.x, ball.y, ball.r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, COL.blueHi);
      g.addColorStop(1, COL.blue);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPlunger() {
    const x = PLUNGER_X;
    const topY = 826;
    const h = game.plunger * 26;
    ctx.save();
    ctx.fillStyle = COL.yellow;
    ctx.shadowColor = COL.yellow;
    ctx.shadowBlur = 10;
    ctx.fillRect(x - 12, topY + h, 24, 30);
    // Federwindungen
    ctx.strokeStyle = COL.yelHi;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const yy = topY + h + 30 + i * (8 + h * 0.2);
      ctx.beginPath();
      ctx.moveTo(x - 12, yy);
      ctx.lineTo(x + 12, yy + 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    ctx.fillStyle = COL.text;
    ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('PUNKTE', 20, 14);
    ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COL.yellow;
    ctx.fillText(game.score.toLocaleString('de-DE'), 20, 34);

    ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COL.blueHi;
    ctx.textAlign = 'right';
    ctx.fillText('BESTE: ' + game.best.toLocaleString('de-DE'), W - 20, 16);
    ctx.fillStyle = COL.text;
    ctx.fillText('KUGELN: ' + game.balls, W - 20, 38);
    ctx.fillStyle = game.multiplier > 1 ? COL.red : COL.text;
    ctx.fillText('x' + game.multiplier, W - 20, 60);
    ctx.restore();

    // Nachricht
    if (game.msgTimer > 0 && game.message) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = COL.text;
      ctx.font = 'bold 26px "Segoe UI", system-ui, sans-serif';
      ctx.shadowColor = COL.yellow;
      ctx.shadowBlur = 12;
      ctx.fillText(game.message, W / 2, H / 2 - 40);
      ctx.restore();
    }
  }

  function drawTitle() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = COL.yellow;
    ctx.shadowColor = COL.red;
    ctx.shadowBlur = 24;
    ctx.font = 'bold 58px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('NOVA', W / 2, 300);
    ctx.fillStyle = COL.blueHi;
    ctx.shadowColor = COL.blue;
    ctx.fillText('PRISMA', W / 2, 360);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COL.text;
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('NEON WELTRAUM FLIPPER', W / 2, 430);
    ctx.font = '15px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COL.blueHi;
    ctx.fillText('A / D  oder  ← →  =  Flipper', W / 2, 480);
    ctx.fillText('Leertaste halten & loslassen = Abschuss', W / 2, 505);
    ctx.fillStyle = COL.yellow;
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    if (Math.floor(Date.now() / 500) % 2 === 0)
      ctx.fillText('ENTER / START drücken', W / 2, 560);
    ctx.restore();
  }

  function drawGameOver() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = COL.red;
    ctx.shadowColor = COL.red;
    ctx.shadowBlur = 20;
    ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('GAME OVER', W / 2, 340);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COL.yellow;
    ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(game.score.toLocaleString('de-DE') + ' Punkte', W / 2, 410);
    ctx.fillStyle = COL.text;
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Beste: ' + game.best.toLocaleString('de-DE'), W / 2, 445);
    ctx.fillStyle = COL.blueHi;
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    if (Math.floor(Date.now() / 500) % 2 === 0)
      ctx.fillText('ENTER / START für neue Runde', W / 2, 500);
    ctx.restore();
  }

  // ============================================================
  //  Hauptschleife
  // ============================================================
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // Sprünge (Tab-Wechsel) begrenzen

    // Feder laden
    if (game.plungerHold && balls.some(b => b.onPlunger)) {
      game.plunger = clamp(game.plunger + dt * 1.4, 0, 1);
    }

    if (game.state !== 'title') {
      updateFlipper(flipperL, dt);
      updateFlipper(flipperR, dt);
      if (game.state === 'play' || game.state === 'ready') {
        for (const ball of balls) stepBall(ball, dt);
        drainCheck();
      }
    }

    if (game.msgTimer > 0) game.msgTimer--;
    if (game.prismaFlash > 0) game.prismaFlash--;
    if (game.shake > 0) game.shake *= 0.9;

    // ---- Render ----
    ctx.save();
    if (game.shake > 0.5) ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));
    drawBackground();
    if (game.prismaFlash > 0) {
      ctx.save();
      ctx.globalAlpha = game.prismaFlash / 60 * 0.5;
      ctx.fillStyle = ['#1f6bff', '#ff2f5e', '#ffd233'][Math.floor(now / 60) % 3];
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    drawTable();
    drawTargets();
    drawBumpers();
    drawFlipper(flipperL);
    drawFlipper(flipperR);
    drawPlunger();
    drawBalls();
    drawHUD();
    if (game.state === 'title') drawTitle();
    if (game.state === 'over') drawGameOver();
    ctx.restore();

    requestAnimationFrame(loop);
  }

  // Init
  buildTable();
  buildBumpers();
  buildTargets();
  buildFlippers();
  requestAnimationFrame(loop);
})();
