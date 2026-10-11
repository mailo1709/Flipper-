/* =============================================================
   NOVA PRISMA — Neon Weltraum Flipper  ·  30 Level
   Eigene 2D-Physik-Engine, kein Framework.

   Steuerung:
     A / Pfeil links   -> linker Flipper
     D / Pfeil rechts  -> rechter Flipper
     Leertaste / unten -> Feder spannen (halten) & loslassen = Abschuss
     Enter             -> Start / neue Runde / weiter
     C                 -> beim Start: weiter beim hoechsten Level

   Hindernisse: Bumper-Kerne, Slingshots, Drop-Targets, Pegs,
   umlaufende Asteroiden, rotierende Windraeder, Wurmloecher,
   Schwerkraftfallen (Schwarze Loecher) und das PRISMA-Feature.
   ============================================================= */

(() => {
  'use strict';

  const canvas = document.getElementById('table');
  const ctx = canvas.getContext('2d');
  const W = 520, H = 880;
  canvas.width = W;
  canvas.height = H;

  // ---- Farbwelt (Blau / Rot / Gelb) -------------------------
  const COL = {
    blue: '#1f6bff', blueHi: '#5aa0ff',
    red: '#ff2f5e', redHi: '#ff6f8f',
    yellow: '#ffd233', yelHi: '#fff08a',
    wall: '#3a4b8f', wallHi: '#6f86e8',
    rock: '#9aa6d6', rockHi: '#cdd6ff',
    worm: '#b85cff', wormHi: '#e0a6ff',
    bg0: '#05030f', bg1: '#120a2e',
    text: '#eef1ff'
  };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  // ============================================================
  //  Fester Tisch-Rahmen (Waende, Federgasse)
  // ============================================================
  const segments = [];
  function seg(ax, ay, bx, by, opt = {}) {
    segments.push({
      a: { x: ax, y: ay }, b: { x: bx, y: by },
      bounce: opt.bounce ?? 0.35, kind: opt.kind || 'wall', glow: 0
    });
  }
  function poly(points, opt) {
    for (let i = 0; i < points.length - 1; i++)
      seg(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], opt);
  }
  function arc(cx, cy, r, a0, a1, steps, opt) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    poly(pts, opt);
  }

  const PLUNGER_X = 470, LANE_LEFT = 442, RIGHT = 500;

  function buildTable() {
    segments.length = 0;
    poly([[20, 700], [20, 200]], { bounce: 0.3 });
    arc(150, 200, 130, Math.PI, Math.PI * 1.5, 22, { bounce: 0.4 });
    poly([[150, 70], [360, 70]], { bounce: 0.4 });
    arc(360, 200, 130, Math.PI * 1.5, Math.PI * 2, 22, { bounce: 0.4 });
    poly([[LANE_LEFT, 250], [LANE_LEFT, 792]], { bounce: 0.25 });
    arc(360, 200, 120, Math.PI * 1.5, Math.PI * 2.05, 16, { bounce: 0.35 });
    poly([[RIGHT, 130], [RIGHT, 838]], { bounce: 0.25 });
    poly([[LANE_LEFT, 838], [RIGHT, 838]], { bounce: 0.2 });
    poly([[20, 700], [120, 792]], { bounce: 0.2 });
    poly([[LANE_LEFT, 792], [400, 792]], { bounce: 0.2 });
    seg(120, 640, 120, 720, { bounce: 1.15, kind: 'sling' });
    seg(400, 640, 400, 720, { bounce: 1.15, kind: 'sling' });
  }

  // ============================================================
  //  Dynamische Objekte (pro Level neu gesetzt)
  // ============================================================
  let bumpers = [], targets = [], pegs = [], asteroids = [],
      windmills = [], wormholes = [], wells = [];

  // ============================================================
  //  30 Level
  // ============================================================
  const LEVEL_NAMES = [
    'Startrampe', 'Blaue Lagune', 'Rote Riesen', 'Geröllfeld', 'Prisma-Pforte',
    'Gelber Zwerg', 'Asteroiden-Gürtel', 'Kometenbahn', 'Meteor-Schauer', 'Wurmloch-Tor',
    'Zwillingssterne', 'Ionensturm', 'Rotorfeld', 'Pulsar', 'Prisma-Nebel',
    'Gravitationssee', 'Schwarzes Loch', 'Ringwelt', 'Trümmerzone', 'Nova-Kern',
    'Doppel-Rotor', 'Plasmakäfig', 'Spiegelgalaxie', 'Chaos-Sektor', 'Quasar',
    'Singularität', 'Sternenschmiede', 'Endzone', 'Supernova', 'PRISMA GALAXIE'
  ];

  function baseBumpers() {
    return [
      { x: 175, y: 300, core: 'blue' },
      { x: 345, y: 300, core: 'red' },
      { x: 260, y: 210, core: 'yellow' }
    ];
  }
  function baseTargets() {
    return [
      { x: 200, y: 150, w: 26, h: 12, core: 'blue' },
      { x: 260, y: 138, w: 26, h: 12, core: 'yellow' },
      { x: 320, y: 150, w: 26, h: 12, core: 'red' }
    ];
  }

  function makeLevels() {
    const lv = [];
    for (let i = 0; i < 30; i++) {
      const n = i + 1;
      const cfg = { level: n, name: LEVEL_NAMES[i] };
      cfg.bumpers = baseBumpers();
      cfg.targets = baseTargets();
      cfg.pegs = []; cfg.asteroids = []; cfg.windmills = [];
      cfg.wormholes = []; cfg.wells = [];

      if (n >= 4)  cfg.pegs = [[150, 430], [370, 430], [260, 475], [205, 545], [315, 545]].map(p => ({ x: p[0], y: p[1] }));
      if (n >= 7)  cfg.asteroids = [{ cx: 260, cy: 390, orbitR: 72, r: 16, speed: 1.3 }];
      if (n >= 10) cfg.wormholes = [{ a: { x: 92, y: 300 }, b: { x: 430, y: 300 }, r: 20 }];
      if (n >= 13) cfg.windmills = [{ cx: 260, cy: 340, arms: 2, len: 72, speed: 1.6 }];
      if (n >= 16) cfg.wells = [{ x: 260, y: 440, radius: 125, strength: 950 }];
      if (n >= 19) cfg.asteroids = [
        { cx: 180, cy: 410, orbitR: 55, r: 15, speed: 1.6 },
        { cx: 340, cy: 410, orbitR: 55, r: 15, speed: -1.6 }
      ];
      if (n >= 22) {
        cfg.windmills = [
          { cx: 175, cy: 340, arms: 3, len: 56, speed: 1.8 },
          { cx: 345, cy: 340, arms: 3, len: 56, speed: -1.8 }
        ];
        cfg.bumpers = [{ x: 260, y: 255, core: 'yellow' }];
      }
      if (n >= 25) {
        cfg.wormholes = [{ a: { x: 92, y: 260 }, b: { x: 430, y: 260 }, r: 20 }];
        cfg.wells = [{ x: 260, y: 485, radius: 115, strength: 1050 }];
        cfg.asteroids = [{ cx: 260, cy: 370, orbitR: 92, r: 16, speed: 1.7 }];
      }
      if (n >= 28) {
        cfg.windmills = [{ cx: 260, cy: 345, arms: 4, len: 62, speed: 2.2 }];
        cfg.asteroids = [
          { cx: 150, cy: 440, orbitR: 48, r: 14, speed: 2.0 },
          { cx: 370, cy: 440, orbitR: 48, r: 14, speed: -2.0 }
        ];
        cfg.wells = [{ x: 260, y: 560, radius: 120, strength: 1250 }];
        cfg.wormholes = [{ a: { x: 86, y: 300 }, b: { x: 435, y: 300 }, r: 18 }];
      }

      // Levelziel
      if (n % 5 === 0)       { cfg.goalType = 'prisma';  cfg.goalValue = Math.max(1, Math.floor(n / 5)); }
      else if (n % 5 === 3)  { cfg.goalType = 'targets'; cfg.goalValue = 1 + Math.floor(n / 6); }
      else                   { cfg.goalType = 'score';   cfg.goalValue = 1200 + i * 700; }
      lv.push(cfg);
    }
    return lv;
  }
  const LEVELS = makeLevels();

  function loadLevel(idx) {
    const cfg = LEVELS[idx];
    game.levelIdx = idx;
    buildTable();
    bumpers  = cfg.bumpers.map(b => ({ ...b, r: b.r || 28, glow: 0, lit: false }));
    targets  = cfg.targets.map(t => ({ ...t, down: false }));
    pegs     = cfg.pegs.map(p => ({ ...p, r: p.r || 9, glow: 0 }));
    asteroids = cfg.asteroids.map(a => ({ ...a, t: Math.random() * TAU, glow: 0 }));
    windmills = cfg.windmills.map(w => ({ ...w, angle: Math.random() * TAU, glow: 0 }));
    wormholes = cfg.wormholes.map(w => ({ ...w, cd: 0, spin: 0 }));
    wells     = cfg.wells.map(w => ({ ...w, pulse: 0 }));
    game.levelPoints = 0;
    game.targetClears = 0;
    game.prismaCount = 0;
    buildFlippers();
  }

  function goal() { return LEVELS[game.levelIdx]; }
  function progressNow() {
    const g = goal();
    if (g.goalType === 'score') return game.levelPoints;
    if (g.goalType === 'targets') return game.targetClears;
    return game.prismaCount;
  }
  function goalText() {
    const g = goal();
    if (g.goalType === 'score') return 'Ziel: ' + g.goalValue.toLocaleString('de-DE') + ' Punkte';
    if (g.goalType === 'targets') return 'Ziel: ' + g.goalValue + 'x alle Ziele löschen';
    return 'Ziel: ' + g.goalValue + 'x PRISMA zünden';
  }
  function goalReached() { return progressNow() >= goal().goalValue; }

  // ============================================================
  //  Flipper
  // ============================================================
  const flipperSpeed = 26;
  let flipperL, flipperR;
  function makeFlipper(px, py, len, rest, up, side) {
    return { px, py, len, rest, up, angle: rest, prevAngle: rest, omega: 0, side, pressed: false };
  }
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
    if (Math.abs(step) >= Math.abs(d)) f.angle = target; else f.angle += step;
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
    state: 'title',   // title | ready | play | levelclear | over | win
    levelIdx: 0,
    score: 0,
    best: Number(localStorage.getItem('novaprisma_best') || 0),
    maxLevel: Number(localStorage.getItem('novaprisma_level') || 1),
    balls: 3,
    multiplier: 1,
    levelPoints: 0,
    targetClears: 0,
    prismaCount: 0,
    plunger: 0,
    plungerHold: false,
    message: '', msgTimer: 0,
    prismaFlash: 0, shake: 0, clearTimer: 0
  };

  function startGame(levelIdx) {
    game.score = 0;
    game.balls = 3;
    game.multiplier = 1;
    loadLevel(levelIdx);
    balls = [];
    startNewBall();
  }
  function startNewBall() {
    balls = [];
    spawnBallOnPlunger();
    game.state = 'ready';
    game.plunger = 0;
    flash('LEVEL ' + (game.levelIdx + 1) + ' — ' + goal().name, 90);
  }
  function flash(t, f) { game.message = t; game.msgTimer = f; }

  function addScore(n) {
    const g = n * game.multiplier;
    game.score += g;
    game.levelPoints += g;
    if (game.score > game.best) {
      game.best = game.score;
      localStorage.setItem('novaprisma_best', String(game.best));
    }
  }

  function hitCore(core) {
    const b = bumpers.find(x => x.core === core);
    if (b && !b.lit) { b.lit = true; }
  }
  function checkPrisma() {
    if (bumpers.length && bumpers.every(b => b.lit) && targets.every(t => t.down)) {
      addScore(5000);
      game.prismaCount++;
      game.multiplier = Math.min(game.multiplier + 1, 8);
      game.prismaFlash = 60; game.shake = 18;
      flash('★ PRISMA! x' + game.multiplier + ' ★', 120);
      bumpers.forEach(b => b.lit = false);
      targets.forEach(t => t.down = false);
      for (let i = 0; i < 2; i++) {
        const src = bumpers[i % bumpers.length];
        balls.push({ x: src.x, y: src.y, vx: rand(-180, 180), vy: rand(-260, -120), r: BALL_R, onPlunger: false, trail: [] });
      }
    }
  }

  function completeLevel() {
    addScore(2000 + game.levelIdx * 300);
    game.state = 'levelclear';
    game.clearTimer = 150;
    game.prismaFlash = 60; game.shake = 14;
    const next = game.levelIdx + 2;
    if (next > game.maxLevel) { game.maxLevel = next; localStorage.setItem('novaprisma_level', String(Math.min(next, 30))); }
    flash(game.levelIdx + 1 >= 30 ? '' : 'LEVEL ' + (game.levelIdx + 1) + ' GESCHAFFT!', 150);
  }

  // ============================================================
  //  Kollisionen
  // ============================================================
  function collideSegment(ball, s) {
    const ax = s.a.x, ay = s.a.y, bx = s.b.x, by = s.b.y;
    const abx = bx - ax, aby = by - ay;
    const len2 = abx * abx + aby * aby || 1;
    let t = clamp(((ball.x - ax) * abx + (ball.y - ay) * aby) / len2, 0, 1);
    const cx = ax + abx * t, cy = ay + aby * t;
    let dx = ball.x - cx, dy = ball.y - cy, dist = Math.hypot(dx, dy);
    if (dist < ball.r) {
      if (dist < 0.0001) { dx = 0; dy = -1; dist = 0.0001; }
      const nx = dx / dist, ny = dy / dist;
      ball.x += nx * (ball.r - dist); ball.y += ny * (ball.r - dist);
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) { ball.vx -= (1 + s.bounce) * vn * nx; ball.vy -= (1 + s.bounce) * vn * ny; }
      s.glow = 1;
      if (s.kind === 'sling') { ball.vx += nx * 260; ball.vy += ny * 260; addScore(50); }
    }
  }

  // bewegender Kreis (Asteroid, Peg, Bumper): vx/vy = Objektgeschwindigkeit
  function collideMovingCircle(ball, cx, cy, R, vx, vy, rest) {
    let dx = ball.x - cx, dy = ball.y - cy, dist = Math.hypot(dx, dy);
    const sum = ball.r + R;
    if (dist < sum) {
      if (dist < 0.0001) { dx = 0; dy = -1; dist = 0.0001; }
      const nx = dx / dist, ny = dy / dist;
      ball.x = cx + nx * sum; ball.y = cy + ny * sum;
      const rvx = ball.vx - vx, rvy = ball.vy - vy;
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) { ball.vx -= (1 + rest) * vn * nx; ball.vy -= (1 + rest) * vn * ny; }
      return nx * 0 + 1; // Treffer
    }
    return 0;
  }

  function collideFlipper(ball, f) {
    const tip = flipperTip(f);
    const abx = tip.x - f.px, aby = tip.y - f.py;
    const len2 = abx * abx + aby * aby || 1;
    let t = clamp(((ball.x - f.px) * abx + (ball.y - f.py) * aby) / len2, 0, 1);
    const cx = f.px + abx * t, cy = f.py + aby * t;
    let dx = ball.x - cx, dy = ball.y - cy, dist = Math.hypot(dx, dy);
    const R = ball.r + 6;
    if (dist < R) {
      if (dist < 0.0001) { dx = 0; dy = -1; dist = 0.0001; }
      const nx = dx / dist, ny = dy / dist;
      ball.x += nx * (R - dist); ball.y += ny * (R - dist);
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) { ball.vx -= 1.25 * vn * nx; ball.vy -= 1.25 * vn * ny; }
      const rpx = cx - f.px, rpy = cy - f.py;
      const surfVX = -f.omega * rpy, surfVY = f.omega * rpx;
      if (surfVX * nx + surfVY * ny > 0) { ball.vx += surfVX * 0.9; ball.vy += surfVY * 0.9; }
    }
  }

  function collideBumper(ball, b) {
    const dx = ball.x - b.x, dy = ball.y - b.y, dist = Math.hypot(dx, dy), R = ball.r + b.r;
    if (dist < R) {
      const nx = dx / (dist || 1), ny = dy / (dist || 1);
      ball.x = b.x + nx * R; ball.y = b.y + ny * R;
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) { ball.vx -= 1.6 * vn * nx; ball.vy -= 1.6 * vn * ny; }
      ball.vx += nx * 300; ball.vy += ny * 300;
      b.glow = 1; addScore(b.lit ? 250 : 100); hitCore(b.core);
      game.shake = Math.max(game.shake, 5);
      checkPrisma();
    }
  }

  function collideTargets(ball) {
    for (const tg of targets) {
      if (tg.down) continue;
      if (Math.abs(ball.x - tg.x) < tg.w / 2 + ball.r && Math.abs(ball.y - tg.y) < tg.h / 2 + ball.r) {
        tg.down = true;
        ball.vy = Math.abs(ball.vy) * 0.6 + 120;
        addScore(500); hitCore(tg.core); flash('ZIEL! +500', 40); checkPrisma();
        if (targets.every(x => x.down)) {
          addScore(1500); game.targetClears++; flash('ALLE ZIELE! +1500', 60);
          const snapshot = targets;
          setTimeout(() => { if (snapshot === targets) targets.forEach(x => x.down = false); }, 900);
        }
      }
    }
  }

  function astPos(a) { return { x: a.cx + Math.cos(a.t) * a.orbitR, y: a.cy + Math.sin(a.t) * a.orbitR }; }
  function astVel(a) { return { x: -Math.sin(a.t) * a.orbitR * a.speed, y: Math.cos(a.t) * a.orbitR * a.speed }; }

  function collideAsteroids(ball) {
    for (const a of asteroids) {
      const p = astPos(a), v = astVel(a);
      if (collideMovingCircle(ball, p.x, p.y, a.r, v.x, v.y, 0.7)) {
        a.glow = 1; addScore(120); game.shake = Math.max(game.shake, 4);
      }
    }
  }

  function windmillArmTip(w, k) {
    const ang = w.angle + k * TAU / w.arms;
    return { x: w.cx + Math.cos(ang) * w.len, y: w.cy + Math.sin(ang) * w.len, ang };
  }
  function collideWindmills(ball) {
    for (const w of windmills) {
      for (let k = 0; k < w.arms; k++) {
        const tip = windmillArmTip(w, k);
        const abx = tip.x - w.cx, aby = tip.y - w.cy;
        const len2 = abx * abx + aby * aby || 1;
        let t = clamp(((ball.x - w.cx) * abx + (ball.y - w.cy) * aby) / len2, 0, 1);
        const cx = w.cx + abx * t, cy = w.cy + aby * t;
        let dx = ball.x - cx, dy = ball.y - cy, dist = Math.hypot(dx, dy);
        const R = ball.r + 7;
        if (dist < R) {
          if (dist < 0.0001) { dx = 0; dy = -1; dist = 0.0001; }
          const nx = dx / dist, ny = dy / dist;
          ball.x += nx * (R - dist); ball.y += ny * (R - dist);
          const vn = ball.vx * nx + ball.vy * ny;
          if (vn < 0) { ball.vx -= 1.3 * vn * nx; ball.vy -= 1.3 * vn * ny; }
          const rpx = cx - w.cx, rpy = cy - w.cy;
          const sVX = -w.speed * rpy, sVY = w.speed * rpx;
          ball.vx += sVX * 0.6; ball.vy += sVY * 0.6;
          w.glow = 1; addScore(75); game.shake = Math.max(game.shake, 3);
        }
      }
    }
  }

  function applyWells(ball, h) {
    for (const w of wells) {
      const dx = w.x - ball.x, dy = w.y - ball.y, dist = Math.hypot(dx, dy);
      if (dist < w.radius && dist > 1) {
        const a = w.strength * (1 - dist / w.radius);
        ball.vx += (dx / dist) * a * h;
        ball.vy += (dy / dist) * a * h;
      }
    }
  }

  function checkWormholes(ball, dt) {
    for (const w of wormholes) {
      if (w.cd > 0) { w.cd -= dt; continue; }
      const da = Math.hypot(ball.x - w.a.x, ball.y - w.a.y);
      const db = Math.hypot(ball.x - w.b.x, ball.y - w.b.y);
      if (da < w.r) { ball.x = w.b.x; ball.y = w.b.y + w.r + ball.r; w.cd = 0.6; addScore(200); game.shake = 6; }
      else if (db < w.r) { ball.x = w.a.x; ball.y = w.a.y + w.r + ball.r; w.cd = 0.6; addScore(200); game.shake = 6; }
    }
  }

  // ============================================================
  //  Physik-Schritt
  // ============================================================
  const GRAV = 1500;
  function stepBall(ball, dt) {
    if (ball.onPlunger) {
      ball.x = PLUNGER_X; ball.y = 800 + game.plunger * 26; ball.vx = 0; ball.vy = 0; return;
    }
    ball.vy += GRAV * dt;
    ball.vx *= 0.9995; ball.vy *= 0.9995;
    const sp = Math.hypot(ball.vx, ball.vy), MAX = 2300;
    if (sp > MAX) { ball.vx *= MAX / sp; ball.vy *= MAX / sp; }

    const sub = clamp(Math.ceil(sp * dt / (ball.r * 0.5)), 1, 12);
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      applyWells(ball, h);
      ball.x += ball.vx * h; ball.y += ball.vy * h;
      for (const s of segments) collideSegment(ball, s);
      for (const p of pegs) if (collideMovingCircle(ball, p.x, p.y, p.r, 0, 0, 0.9)) { p.glow = 1; addScore(25); }
      for (const b of bumpers) collideBumper(ball, b);
      collideAsteroids(ball);
      collideWindmills(ball);
      collideFlipper(ball, flipperL);
      collideFlipper(ball, flipperR);
    }
    collideTargets(ball);
    checkWormholes(ball, dt);

    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 10) ball.trail.shift();
  }

  function drainCheck() {
    balls = balls.filter(b => b.y <= H + 40);
    if (game.state === 'play' && balls.length === 0) {
      game.balls -= 1;
      game.multiplier = 1;
      if (game.balls <= 0) { game.state = 'over'; flash('GAME OVER', 999999); }
      else startNewBall();
    }
  }

  // ============================================================
  //  Eingabe
  // ============================================================
  function launch() {
    const onF = balls.find(b => b.onPlunger);
    if (onF) {
      onF.onPlunger = false;
      onF.vy = -650 - game.plunger * 1250;
      onF.vx = rand(-15, 5);
      if (game.state === 'ready') game.state = 'play';
      flash('', 0);
    }
    game.plunger = 0;
  }
  function confirmKey(continueLevel) {
    if (game.state === 'title') startGame(continueLevel ? Math.min(game.maxLevel - 1, 29) : 0);
    else if (game.state === 'over') startGame(game.levelIdx); // aktuelles Level erneut
    else if (game.state === 'win') { game.state = 'title'; }
  }

  function keydown(e) {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') flipperL.pressed = true;
    if (k === 'd' || k === 'arrowright') flipperR.pressed = true;
    if (k === ' ' || k === 'arrowdown') { game.plungerHold = true; e.preventDefault(); }
    if (k === 'enter') confirmKey(false);
    if (k === 'c') confirmKey(true);
  }
  function keyup(e) {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') flipperL.pressed = false;
    if (k === 'd' || k === 'arrowright') flipperR.pressed = false;
    if (k === ' ' || k === 'arrowdown') { game.plungerHold = false; launch(); }
  }
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);

  function bindHold(el, onD, onU) {
    if (!el) return;
    const d = e => { e.preventDefault(); onD(); };
    const u = e => { e.preventDefault(); onU(); };
    el.addEventListener('touchstart', d, { passive: false });
    el.addEventListener('touchend', u, { passive: false });
    el.addEventListener('mousedown', d);
    el.addEventListener('mouseup', u);
    el.addEventListener('mouseleave', u);
  }
  bindHold(document.getElementById('btnL'), () => flipperL.pressed = true, () => flipperL.pressed = false);
  bindHold(document.getElementById('btnR'), () => flipperR.pressed = true, () => flipperR.pressed = false);
  bindHold(document.getElementById('btnP'), () => game.plungerHold = true, () => { game.plungerHold = false; launch(); });
  const sb = document.getElementById('btnStart');
  if (sb) sb.addEventListener('click', () => {
    if (game.state === 'title' || game.state === 'over' || game.state === 'win') confirmKey(game.state === 'title' && game.maxLevel > 1);
  });

  // ============================================================
  //  Zeichnen
  // ============================================================
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COL.bg1); g.addColorStop(1, COL.bg0);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = 0.15 + (i % 5) * 0.12;
      ctx.fillStyle = i % 3 === 0 ? COL.blueHi : i % 3 === 1 ? COL.yelHi : '#fff';
      ctx.fillRect(i * 97 % W, i * 173 % H, 2, 2);
    }
    ctx.restore();
  }
  function neonLine(ax, ay, bx, by, color, width, glow) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = 8 + glow * 16;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.restore();
  }
  function drawTable() {
    for (const s of segments) {
      const color = s.kind === 'sling' ? COL.yellow : (s.glow > 0.05 ? COL.wallHi : COL.wall);
      neonLine(s.a.x, s.a.y, s.b.x, s.b.y, color, s.kind === 'sling' ? 6 : 4, s.glow);
      s.glow *= 0.85;
    }
    ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = COL.blue;
    ctx.fillRect(LANE_LEFT + 4, 260, RIGHT - LANE_LEFT - 8, 560); ctx.restore();
  }
  function glowCircle(x, y, r, inner, outer, blur) {
    ctx.save(); ctx.shadowColor = outer; ctx.shadowBlur = blur;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  }
  function drawWells() {
    for (const w of wells) {
      w.pulse += 0.05;
      ctx.save();
      for (let i = 4; i >= 1; i--) {
        ctx.globalAlpha = 0.06 * i;
        ctx.strokeStyle = COL.worm; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(w.x, w.y, w.radius * (i / 4) * (0.9 + 0.1 * Math.sin(w.pulse)), 0, TAU); ctx.stroke();
      }
      ctx.restore();
      glowCircle(w.x, w.y, 14, '#000', COL.worm, 24);
      ctx.save(); ctx.strokeStyle = COL.wormHi; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w.x, w.y, 16, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  function drawWormholes() {
    for (const w of wormholes) {
      w.spin += 0.12;
      for (const end of [w.a, w.b]) {
        ctx.save(); ctx.translate(end.x, end.y); ctx.rotate(w.spin);
        ctx.shadowColor = COL.worm; ctx.shadowBlur = 18;
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.8 - i * 0.2;
          ctx.strokeStyle = i % 2 ? COL.blueHi : COL.wormHi; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, w.r - i * 4, i, i + 4.3); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  function drawPegs() {
    for (const p of pegs) {
      glowCircle(p.x, p.y, p.r, '#fff', COL.blueHi, 8 + p.glow * 14);
      p.glow *= 0.85;
    }
  }
  function drawAsteroids() {
    for (const a of asteroids) {
      const p = astPos(a);
      ctx.save(); ctx.globalAlpha = 0.2; ctx.strokeStyle = COL.rock; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(a.cx, a.cy, a.orbitR, 0, TAU); ctx.stroke(); ctx.restore();
      glowCircle(p.x, p.y, a.r, COL.rockHi, COL.rock, 10 + a.glow * 18);
      ctx.save(); ctx.fillStyle = 'rgba(40,40,70,0.6)';
      ctx.beginPath(); ctx.arc(p.x + 3, p.y + 2, a.r * 0.35, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x - 4, p.y - 3, a.r * 0.2, 0, TAU); ctx.fill(); ctx.restore();
      a.glow *= 0.85;
    }
  }
  function drawWindmills(now) {
    for (const w of windmills) {
      for (let k = 0; k < w.arms; k++) {
        const tip = windmillArmTip(w, k);
        neonLine(w.cx, w.cy, tip.x, tip.y, k % 2 ? COL.red : COL.blue, 10, w.glow);
        neonLine(w.cx, w.cy, tip.x, tip.y, '#fff', 3, 0);
      }
      glowCircle(w.cx, w.cy, 9, COL.yelHi, COL.yellow, 12);
      w.glow *= 0.85;
    }
  }
  function drawBumpers() {
    for (const b of bumpers) {
      const base = COL[b.core], hi = COL[b.core + 'Hi'] || base;
      ctx.save(); ctx.shadowColor = base; ctx.shadowBlur = 20 + b.glow * 30 + (b.lit ? 15 : 0);
      const g = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, b.r);
      g.addColorStop(0, hi); g.addColorStop(1, base);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.lineWidth = b.lit ? 5 : 3; ctx.strokeStyle = b.lit ? '#fff' : hi;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5 + b.glow * 6, 0, TAU); ctx.stroke();
      ctx.restore(); b.glow *= 0.88;
    }
  }
  function drawTargets() {
    for (const tg of targets) {
      ctx.save(); const c = COL[tg.core];
      if (tg.down) { ctx.globalAlpha = 0.22; ctx.fillStyle = c; }
      else { ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.fillStyle = c; }
      ctx.fillRect(tg.x - tg.w / 2, tg.y - tg.h / 2, tg.w, tg.h); ctx.restore();
    }
  }
  function drawFlipper(f) {
    const tip = flipperTip(f);
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = COL.red; ctx.shadowColor = COL.red; ctx.shadowBlur = 16; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.strokeStyle = COL.redHi; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.arc(f.px, f.py, 7, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawBalls() {
    for (const ball of balls) {
      for (let i = 0; i < ball.trail.length; i++) {
        const p = ball.trail[i];
        ctx.save(); ctx.globalAlpha = (i / ball.trail.length) * 0.4; ctx.fillStyle = COL.blueHi;
        ctx.beginPath(); ctx.arc(p.x, p.y, ball.r * (i / ball.trail.length), 0, TAU); ctx.fill(); ctx.restore();
      }
      ctx.save(); ctx.shadowColor = COL.blueHi; ctx.shadowBlur = 18;
      const g = ctx.createRadialGradient(ball.x - 4, ball.y - 4, 2, ball.x, ball.y, ball.r);
      g.addColorStop(0, '#fff'); g.addColorStop(0.5, COL.blueHi); g.addColorStop(1, COL.blue);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  function drawPlunger() {
    const x = PLUNGER_X, topY = 826, h = game.plunger * 26;
    ctx.save(); ctx.fillStyle = COL.yellow; ctx.shadowColor = COL.yellow; ctx.shadowBlur = 10;
    ctx.fillRect(x - 12, topY + h, 24, 30);
    ctx.strokeStyle = COL.yelHi; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const yy = topY + h + 30 + i * (8 + h * 0.2);
      ctx.beginPath(); ctx.moveTo(x - 12, yy); ctx.lineTo(x + 12, yy + 4); ctx.stroke();
    }
    ctx.restore();
  }
  function drawHUD() {
    ctx.save();
    ctx.fillStyle = COL.text; ctx.textBaseline = 'top';
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('PUNKTE', 18, 12);
    ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = COL.yellow;
    ctx.fillText(game.score.toLocaleString('de-DE'), 18, 28);

    ctx.textAlign = 'right';
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = COL.blueHi;
    ctx.fillText('BESTE ' + game.best.toLocaleString('de-DE'), W - 18, 12);
    ctx.fillStyle = COL.text; ctx.fillText('KUGELN ' + game.balls, W - 18, 30);
    ctx.fillStyle = game.multiplier > 1 ? COL.red : COL.text; ctx.fillText('x' + game.multiplier, W - 18, 48);

    // Level + Ziel-Leiste
    ctx.textAlign = 'center'; ctx.fillStyle = COL.text;
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    const g = goal();
    ctx.fillText('LEVEL ' + (game.levelIdx + 1) + '/30 · ' + g.name, W / 2, 12);
    const frac = clamp(progressNow() / g.goalValue, 0, 1);
    const bw = 220, bx = W / 2 - bw / 2, by = 34;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = COL.yellow; ctx.fillRect(bx, by, bw * frac, 8);
    ctx.font = '11px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = COL.blueHi;
    ctx.fillText(goalText(), W / 2, by + 11);
    ctx.restore();

    if (game.msgTimer > 0 && game.message) {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = COL.text;
      ctx.font = 'bold 26px "Segoe UI", system-ui, sans-serif';
      ctx.shadowColor = COL.yellow; ctx.shadowBlur = 12;
      ctx.fillText(game.message, W / 2, H / 2 - 50); ctx.restore();
    }
  }
  function centerText(lines) {
    ctx.save(); ctx.textAlign = 'center';
    for (const l of lines) {
      ctx.fillStyle = l.c || COL.text; ctx.font = l.f;
      if (l.glow) { ctx.shadowColor = l.glow; ctx.shadowBlur = 20; } else ctx.shadowBlur = 0;
      ctx.fillText(l.t, W / 2, l.y);
    }
    ctx.restore();
  }
  function drawTitle() {
    centerText([
      { t: 'NOVA', y: 290, c: COL.yellow, f: 'bold 58px "Segoe UI", system-ui, sans-serif', glow: COL.red },
      { t: 'PRISMA', y: 350, c: COL.blueHi, f: 'bold 58px "Segoe UI", system-ui, sans-serif', glow: COL.blue },
      { t: '30 LEVEL · NEON WELTRAUM FLIPPER', y: 420, c: COL.text, f: 'bold 17px "Segoe UI", system-ui, sans-serif' },
      { t: 'A / D  oder  ← →  =  Flipper', y: 470, c: COL.blueHi, f: '15px "Segoe UI", system-ui, sans-serif' },
      { t: 'Leertaste halten & loslassen = Abschuss', y: 494, c: COL.blueHi, f: '15px "Segoe UI", system-ui, sans-serif' }
    ]);
    if (Math.floor(Date.now() / 500) % 2 === 0)
      centerText([{ t: 'ENTER / START = Level 1', y: 548, c: COL.yellow, f: 'bold 20px "Segoe UI", system-ui, sans-serif' }]);
    if (game.maxLevel > 1)
      centerText([{ t: 'C = weiter bei Level ' + Math.min(game.maxLevel, 30), y: 580, c: COL.redHi, f: 'bold 17px "Segoe UI", system-ui, sans-serif' }]);
  }
  function drawOverlay(title, color, sub) {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    centerText([
      { t: title, y: 330, c: color, f: 'bold 46px "Segoe UI", system-ui, sans-serif', glow: color },
      { t: game.score.toLocaleString('de-DE') + ' Punkte', y: 400, c: COL.yellow, f: 'bold 28px "Segoe UI", system-ui, sans-serif' },
      { t: sub, y: 440, c: COL.text, f: '16px "Segoe UI", system-ui, sans-serif' }
    ]);
    if (Math.floor(Date.now() / 500) % 2 === 0)
      centerText([{ t: 'ENTER / START', y: 495, c: COL.blueHi, f: 'bold 20px "Segoe UI", system-ui, sans-serif' }]);
  }

  // ============================================================
  //  Hauptschleife
  // ============================================================
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;

    if (game.plungerHold && balls.some(b => b.onPlunger))
      game.plunger = clamp(game.plunger + dt * 1.4, 0, 1);

    // Bewegliche Hindernisse animieren
    for (const a of asteroids) a.t += a.speed * dt;
    for (const w of windmills) w.angle += w.speed * dt;

    if (game.state !== 'title') { updateFlipper(flipperL, dt); updateFlipper(flipperR, dt); }

    if (game.state === 'play' || game.state === 'ready') {
      for (const ball of balls) stepBall(ball, dt);
      drainCheck();
      if (game.state === 'play' && goalReached()) {
        if (game.levelIdx + 1 >= 30) { game.state = 'win'; flash('', 0); }
        else completeLevel();
      }
    } else if (game.state === 'levelclear') {
      for (const ball of balls) stepBall(ball, dt);
      if (--game.clearTimer <= 0) { game.balls = 3; loadLevel(game.levelIdx + 1); startNewBall(); }
    }

    if (game.msgTimer > 0) game.msgTimer--;
    if (game.prismaFlash > 0) game.prismaFlash--;
    if (game.shake > 0) game.shake *= 0.9;

    ctx.save();
    if (game.shake > 0.5) ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));
    drawBackground();
    if (game.prismaFlash > 0) {
      ctx.save(); ctx.globalAlpha = game.prismaFlash / 60 * 0.5;
      ctx.fillStyle = ['#1f6bff', '#ff2f5e', '#ffd233'][Math.floor(now / 60) % 3];
      ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    drawTable();
    drawWells();
    drawWormholes();
    drawPegs();
    drawTargets();
    drawAsteroids();
    drawWindmills(now);
    drawBumpers();
    drawFlipper(flipperL); drawFlipper(flipperR);
    drawPlunger();
    drawBalls();
    if (game.state !== 'title') drawHUD();
    if (game.state === 'title') drawTitle();
    if (game.state === 'over') drawOverlay('GAME OVER', COL.red, 'Level ' + (game.levelIdx + 1) + ' erneut versuchen');
    if (game.state === 'win') drawOverlay('GALAXIE GERETTET!', COL.yellow, 'Alle 30 Level geschafft — Legende!');
    ctx.restore();

    requestAnimationFrame(loop);
  }

  // Init
  loadLevel(0);
  requestAnimationFrame(loop);
})();
