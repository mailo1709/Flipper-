/* =============================================================
   NOVA PRISMA — Flipper (40 Level)
   Epochen: Spielbude '74 (retro) -> 16-Bit -> Neon Modern -> Hyper Holo
   Eigene 2D-Physik. Modul fuer den NOVA ARCADE Hub.
   ============================================================= */
(function () {
  'use strict';

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const L = x => Math.round(x + (255 - x) * amt), h = x => x.toString(16).padStart(2, '0');
    return '#' + h(L(r)) + h(L(g)) + h(L(b));
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  // ---- Epoche je Level -> wird mit steigendem Level moderner ----
  function era(n) {
    if (n <= 8) return { name: "Spielbude '74", bg0: '#140b02', bg1: '#2a1705',
      wall: '#c8731e', blue: '#2fa7b5', red: '#e0392b', yellow: '#f2b705', scan: 0.26, glow: false, retro: true };
    if (n <= 18) return { name: '16-Bit Arcade', bg0: '#06122a', bg1: '#0a2048',
      wall: '#3a6fd8', blue: '#2f7bff', red: '#ff3b5e', yellow: '#ffd233', scan: 0.12, glow: false, retro: false };
    if (n <= 30) return { name: 'Neon Modern', bg0: '#05030f', bg1: '#120a2e',
      wall: '#3a4b8f', blue: '#1f6bff', red: '#ff2f5e', yellow: '#ffd233', scan: 0, glow: true, retro: false };
    return { name: 'Hyper Holo', bg0: '#02121a', bg1: '#06283a',
      wall: '#1fd3c9', blue: '#17e0ff', red: '#ff46c3', yellow: '#b9ff3d', scan: 0, glow: true, retro: false };
  }
  function eraName(n) { return era(n).name; }

  const LEVEL_NAMES = [
    'Jahrmarkt', 'Münzeinwurf', 'Groschengrab', 'Kirmeslicht', 'Flipperkönig', 'Tilt!', 'Bronzekugel', 'Replay',
    'Pixelstart', 'Chiptune', 'Highscore', 'Bonusrunde', 'Turbo', 'Extraball', 'Combo', 'Jackpot', 'Arcade-Halle', 'Endgegner',
    'Neon City', 'Laserbahn', 'Hologramm', 'Rotorfeld', 'Pulsar', 'Prisma-Nebel', 'Gravitationssee', 'Schwarzes Loch', 'Ringwelt', 'Trümmerzone', 'Nova-Kern', 'Supernova',
    'Holo-Deck', 'Quantenfeld', 'Singularität', 'Zeitriss', 'Sternenschmiede', 'Antimaterie', 'Wurmloch-Nest', 'Chaos-Matrix', 'Omega', 'PRISMA GALAXIE'
  ];
  const LEVEL_COUNT = 40;

  function baseBumpers() {
    return [{ x: 175, y: 300, core: 'blue' }, { x: 345, y: 300, core: 'red' }, { x: 260, y: 210, core: 'yellow' }];
  }
  function baseTargets() {
    return [
      { x: 200, y: 150, w: 26, h: 12, core: 'blue' },
      { x: 260, y: 138, w: 26, h: 12, core: 'yellow' },
      { x: 320, y: 150, w: 26, h: 12, core: 'red' }];
  }
  function makeLevels() {
    const lv = [];
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const n = i + 1, cfg = { level: n, name: LEVEL_NAMES[i] || ('Sektor ' + n) };
      cfg.bumpers = baseBumpers(); cfg.targets = baseTargets();
      cfg.pegs = []; cfg.asteroids = []; cfg.windmills = []; cfg.wormholes = []; cfg.wells = [];
      // Retro (1-8): rein klassisch – nur Bumper, Slingshots, Targets
      if (n >= 9)  cfg.pegs = [[150, 430], [370, 430], [260, 475], [205, 545], [315, 545]].map(p => ({ x: p[0], y: p[1] }));
      if (n >= 13) cfg.asteroids = [{ cx: 260, cy: 390, orbitR: 72, r: 16, speed: 1.3 }];
      if (n >= 19) cfg.wormholes = [{ a: { x: 92, y: 300 }, b: { x: 430, y: 300 }, r: 20 }];
      if (n >= 22) cfg.windmills = [{ cx: 260, cy: 340, arms: 2, len: 72, speed: 1.6 }];
      if (n >= 25) cfg.asteroids = [{ cx: 180, cy: 410, orbitR: 55, r: 15, speed: 1.6 }, { cx: 340, cy: 410, orbitR: 55, r: 15, speed: -1.6 }];
      if (n >= 28) cfg.wells = [{ x: 260, y: 455, radius: 120, strength: 980 }];
      if (n >= 31) {
        cfg.windmills = [{ cx: 175, cy: 340, arms: 3, len: 56, speed: 1.9 }, { cx: 345, cy: 340, arms: 3, len: 56, speed: -1.9 }];
        cfg.bumpers = [{ x: 260, y: 250, core: 'yellow' }];
        cfg.wormholes = [{ a: { x: 92, y: 265 }, b: { x: 430, y: 265 }, r: 20 }];
        cfg.wells = [{ x: 260, y: 500, radius: 115, strength: 1080 }];
      }
      if (n >= 36) {
        cfg.windmills = [{ cx: 260, cy: 345, arms: 4, len: 62, speed: 2.3 }];
        cfg.asteroids = [{ cx: 150, cy: 440, orbitR: 48, r: 14, speed: 2.1 }, { cx: 370, cy: 440, orbitR: 48, r: 14, speed: -2.1 }];
        cfg.wells = [{ x: 150, y: 560, radius: 95, strength: 1150 }, { x: 370, y: 560, radius: 95, strength: 1150 }];
        cfg.wormholes = [{ a: { x: 86, y: 300 }, b: { x: 435, y: 300 }, r: 18 }];
      }
      if (n % 6 === 0)      { cfg.goalType = 'prisma';  cfg.goalValue = Math.max(1, Math.floor(n / 6)); }
      else if (n % 6 === 4) { cfg.goalType = 'targets'; cfg.goalValue = 1 + Math.floor(n / 8); }
      else                  { cfg.goalType = 'score';   cfg.goalValue = 1000 + i * 600; }
      lv.push(cfg);
    }
    return lv;
  }
  const LEVELS = makeLevels();

  // ================= Modul-Fabrik =================
  function makePinball(host) {
    const canvas = host.canvas, ctx = host.ctx;
    const W = 520, H = 880, BALL_R = 11;
    const PLUNGER_X = 470, LANE_LEFT = 442, RIGHT = 500;
    const diff = host.diff(), skin = host.skin();
    const GRAV = 1500 * diff.grav;
    const PROG_KEY = 'na_pinball_max';

    let pal, segments = [], bumpers = [], targets = [], pegs = [], asteroids = [], windmills = [], wormholes = [], wells = [];
    let flipperL, flipperR, balls = [];
    let raf = null, running = false, last = 0, reported = false;

    const game = {
      state: 'title', levelIdx: 0, score: 0, balls: diff.balls, multiplier: 1,
      levelPoints: 0, targetClears: 0, prismaCount: 0,
      plunger: 0, plungerHold: false, message: '', msgTimer: 0,
      prismaFlash: 0, shake: 0, clearTimer: 0,
      maxLevel: Math.max(1, Number(localStorage.getItem(PROG_KEY) || 1)),
      best: 0
    };

    // ---- Tisch ----
    function seg(ax, ay, bx, by, o = {}) { segments.push({ a: { x: ax, y: ay }, b: { x: bx, y: by }, bounce: o.bounce ?? 0.35, kind: o.kind || 'wall', glow: 0 }); }
    function poly(p, o) { for (let i = 0; i < p.length - 1; i++) seg(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], o); }
    function arcW(cx, cy, r, a0, a1, st, o) { const p = []; for (let i = 0; i <= st; i++) { const a = a0 + (a1 - a0) * (i / st); p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } poly(p, o); }
    function buildTable() {
      segments = [];
      poly([[20, 700], [20, 200]], { bounce: 0.3 });
      arcW(150, 200, 130, Math.PI, Math.PI * 1.5, 22, { bounce: 0.4 });
      poly([[150, 70], [360, 70]], { bounce: 0.4 });
      arcW(360, 200, 130, Math.PI * 1.5, Math.PI * 2, 22, { bounce: 0.4 });
      poly([[LANE_LEFT, 250], [LANE_LEFT, 792]], { bounce: 0.25 });
      arcW(360, 200, 120, Math.PI * 1.5, Math.PI * 2.05, 16, { bounce: 0.35 });
      poly([[RIGHT, 130], [RIGHT, 838]], { bounce: 0.25 });
      poly([[LANE_LEFT, 838], [RIGHT, 838]], { bounce: 0.2 });
      poly([[20, 700], [120, 792]], { bounce: 0.2 });
      poly([[LANE_LEFT, 792], [400, 792]], { bounce: 0.2 });
      seg(120, 640, 120, 720, { bounce: 1.15, kind: 'sling' });
      seg(400, 640, 400, 720, { bounce: 1.15, kind: 'sling' });
    }

    function buildFlippers() {
      flipperL = { px: 168, py: 772, len: 96, rest: 0.42, up: -0.5, angle: 0.42, prevAngle: 0.42, omega: 0, pressed: false };
      flipperR = { px: 352, py: 772, len: 96, rest: Math.PI - 0.42, up: Math.PI + 0.5, angle: Math.PI - 0.42, prevAngle: Math.PI - 0.42, omega: 0, pressed: false };
    }
    const flipperTip = f => ({ x: f.px + Math.cos(f.angle) * f.len, y: f.py + Math.sin(f.angle) * f.len });

    function loadLevel(idx) {
      const cfg = LEVELS[idx]; game.levelIdx = idx;
      const e = era(idx + 1);
      pal = {
        name: e.name, bg0: e.bg0, bg1: e.bg1, wall: e.wall, wallHi: lighten(e.wall, 0.4),
        blue: e.blue, red: e.red, yellow: e.yellow,
        blueHi: lighten(e.blue, 0.45), redHi: lighten(e.red, 0.45), yelHi: lighten(e.yellow, 0.45),
        rock: '#9aa6d6', rockHi: '#cdd6ff', worm: '#b85cff', wormHi: '#e0a6ff', text: '#eef1ff',
        scan: e.scan, glow: e.glow, retro: e.retro, ball: skin.ball, trail: skin.trail
      };
      buildTable();
      const os = diff.obSpeed;
      bumpers = cfg.bumpers.map(b => ({ ...b, r: b.r || 28, glow: 0, lit: false }));
      targets = cfg.targets.map(t => ({ ...t, down: false }));
      pegs = cfg.pegs.map(p => ({ ...p, r: p.r || 9, glow: 0 }));
      asteroids = cfg.asteroids.map(a => ({ ...a, speed: a.speed * os, t: Math.random() * TAU, glow: 0 }));
      windmills = cfg.windmills.map(w => ({ ...w, speed: w.speed * os, angle: Math.random() * TAU, glow: 0 }));
      wormholes = cfg.wormholes.map(w => ({ ...w, cd: 0, spin: 0 }));
      wells = cfg.wells.map(w => ({ ...w, pulse: 0 }));
      game.levelPoints = 0; game.targetClears = 0; game.prismaCount = 0;
      buildFlippers();
    }
    const goal = () => LEVELS[game.levelIdx];
    function goalValue() { return Math.max(1, Math.round(goal().goalValue * (goal().goalType === 'score' ? diff.goalMul : 1))); }
    function progressNow() { const g = goal(); return g.goalType === 'score' ? game.levelPoints : g.goalType === 'targets' ? game.targetClears : game.prismaCount; }
    function goalText() { const g = goal(); return g.goalType === 'score' ? 'Ziel: ' + goalValue().toLocaleString('de-DE') + ' Pkt' : g.goalType === 'targets' ? 'Ziel: ' + g.goalValue + 'x alle Ziele' : 'Ziel: ' + g.goalValue + 'x PRISMA'; }
    const goalReached = () => progressNow() >= goalValue();

    // ---- Spielfluss ----
    function startGame(levelIdx) {
      reported = false;
      game.score = 0; game.balls = diff.balls; game.multiplier = 1;
      loadLevel(levelIdx); balls = []; startNewBall();
    }
    function startNewBall() {
      balls = []; balls.push({ x: PLUNGER_X, y: 800, vx: 0, vy: 0, r: BALL_R, onPlunger: true, trail: [] });
      game.state = 'ready'; game.plunger = 0;
      flash('LEVEL ' + (game.levelIdx + 1) + ' — ' + goal().name, 90);
    }
    function flash(t, f) { game.message = t; game.msgTimer = f; }
    function addScore(n) {
      const g = n * game.multiplier; game.score += g; game.levelPoints += g;
    }
    function hitCore(core) { const b = bumpers.find(x => x.core === core); if (b && !b.lit) b.lit = true; }
    function checkPrisma() {
      if (bumpers.length && bumpers.every(b => b.lit) && targets.every(t => t.down)) {
        addScore(5000); game.prismaCount++; game.multiplier = Math.min(game.multiplier + 1, 8);
        game.prismaFlash = 60; game.shake = 18; flash('★ PRISMA! x' + game.multiplier + ' ★', 120);
        bumpers.forEach(b => b.lit = false); targets.forEach(t => t.down = false);
        for (let i = 0; i < 2; i++) { const s = bumpers[i % bumpers.length]; balls.push({ x: s.x, y: s.y, vx: rand(-180, 180), vy: rand(-260, -120), r: BALL_R, onPlunger: false, trail: [] }); }
      }
    }
    function saveProgress(level) { if (level > game.maxLevel) { game.maxLevel = level; localStorage.setItem(PROG_KEY, String(Math.min(level, LEVEL_COUNT))); } }
    function completeLevel() {
      addScore(2000 + game.levelIdx * 300); game.state = 'levelclear'; game.clearTimer = 150;
      game.prismaFlash = 60; game.shake = 14; saveProgress(game.levelIdx + 2);
      flash('LEVEL ' + (game.levelIdx + 1) + ' GESCHAFFT!', 150);
    }
    function endRun(win) {
      if (!reported) { reported = true; host.submitScore(game.score, { level: game.levelIdx + 1 }); }
      game.state = win ? 'win' : 'over'; flash('', 0);
      if (win) saveProgress(LEVEL_COUNT);
    }

    // ---- Kollisionen ----
    function collideSegment(ball, s) {
      const ax = s.a.x, ay = s.a.y, abx = s.b.x - ax, aby = s.b.y - ay, l2 = abx * abx + aby * aby || 1;
      const t = clamp(((ball.x - ax) * abx + (ball.y - ay) * aby) / l2, 0, 1);
      const cx = ax + abx * t, cy = ay + aby * t; let dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy);
      if (d < ball.r) {
        if (d < 1e-4) { dx = 0; dy = -1; d = 1e-4; }
        const nx = dx / d, ny = dy / d; ball.x += nx * (ball.r - d); ball.y += ny * (ball.r - d);
        const vn = ball.vx * nx + ball.vy * ny; if (vn < 0) { ball.vx -= (1 + s.bounce) * vn * nx; ball.vy -= (1 + s.bounce) * vn * ny; }
        s.glow = 1; if (s.kind === 'sling') { ball.vx += nx * 260; ball.vy += ny * 260; addScore(50); }
      }
    }
    function collideMoving(ball, cx, cy, R, vx, vy, rest) {
      let dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy); const sum = ball.r + R;
      if (d < sum) {
        if (d < 1e-4) { dx = 0; dy = -1; d = 1e-4; }
        const nx = dx / d, ny = dy / d; ball.x = cx + nx * sum; ball.y = cy + ny * sum;
        const rvx = ball.vx - vx, rvy = ball.vy - vy, vn = rvx * nx + rvy * ny;
        if (vn < 0) { ball.vx -= (1 + rest) * vn * nx; ball.vy -= (1 + rest) * vn * ny; }
        return true;
      }
      return false;
    }
    function collideFlipper(ball, f) {
      const tip = flipperTip(f), abx = tip.x - f.px, aby = tip.y - f.py, l2 = abx * abx + aby * aby || 1;
      const t = clamp(((ball.x - f.px) * abx + (ball.y - f.py) * aby) / l2, 0, 1);
      const cx = f.px + abx * t, cy = f.py + aby * t; let dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy); const R = ball.r + 6;
      if (d < R) {
        if (d < 1e-4) { dx = 0; dy = -1; d = 1e-4; }
        const nx = dx / d, ny = dy / d; ball.x += nx * (R - d); ball.y += ny * (R - d);
        const vn = ball.vx * nx + ball.vy * ny; if (vn < 0) { ball.vx -= 1.25 * vn * nx; ball.vy -= 1.25 * vn * ny; }
        const rpx = cx - f.px, rpy = cy - f.py, sVX = -f.omega * rpy, sVY = f.omega * rpx;
        if (sVX * nx + sVY * ny > 0) { ball.vx += sVX * 0.9 * diff.flip; ball.vy += sVY * 0.9 * diff.flip; }
      }
    }
    function collideBumper(ball, b) {
      const dx = ball.x - b.x, dy = ball.y - b.y, d = Math.hypot(dx, dy), R = ball.r + b.r;
      if (d < R) {
        const nx = dx / (d || 1), ny = dy / (d || 1); ball.x = b.x + nx * R; ball.y = b.y + ny * R;
        const vn = ball.vx * nx + ball.vy * ny; if (vn < 0) { ball.vx -= 1.6 * vn * nx; ball.vy -= 1.6 * vn * ny; }
        ball.vx += nx * 300; ball.vy += ny * 300; b.glow = 1; addScore(b.lit ? 250 : 100); hitCore(b.core); game.shake = Math.max(game.shake, 5); checkPrisma();
      }
    }
    function collideTargets(ball) {
      for (const tg of targets) {
        if (tg.down) continue;
        if (Math.abs(ball.x - tg.x) < tg.w / 2 + ball.r && Math.abs(ball.y - tg.y) < tg.h / 2 + ball.r) {
          tg.down = true; ball.vy = Math.abs(ball.vy) * 0.6 + 120; addScore(500); hitCore(tg.core); flash('ZIEL! +500', 40); checkPrisma();
          if (targets.every(x => x.down)) { addScore(1500); game.targetClears++; flash('ALLE ZIELE! +1500', 60); const snap = targets; setTimeout(() => { if (snap === targets) targets.forEach(x => x.down = false); }, 900); }
        }
      }
    }
    const astPos = a => ({ x: a.cx + Math.cos(a.t) * a.orbitR, y: a.cy + Math.sin(a.t) * a.orbitR });
    const astVel = a => ({ x: -Math.sin(a.t) * a.orbitR * a.speed, y: Math.cos(a.t) * a.orbitR * a.speed });
    function collideAsteroids(ball) { for (const a of asteroids) { const p = astPos(a), v = astVel(a); if (collideMoving(ball, p.x, p.y, a.r, v.x, v.y, 0.7)) { a.glow = 1; addScore(120); game.shake = Math.max(game.shake, 4); } } }
    function wmTip(w, k) { const ang = w.angle + k * TAU / w.arms; return { x: w.cx + Math.cos(ang) * w.len, y: w.cy + Math.sin(ang) * w.len }; }
    function collideWindmills(ball) {
      for (const w of windmills) for (let k = 0; k < w.arms; k++) {
        const tip = wmTip(w, k), abx = tip.x - w.cx, aby = tip.y - w.cy, l2 = abx * abx + aby * aby || 1;
        const t = clamp(((ball.x - w.cx) * abx + (ball.y - w.cy) * aby) / l2, 0, 1);
        const cx = w.cx + abx * t, cy = w.cy + aby * t; let dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy); const R = ball.r + 7;
        if (d < R) {
          if (d < 1e-4) { dx = 0; dy = -1; d = 1e-4; }
          const nx = dx / d, ny = dy / d; ball.x += nx * (R - d); ball.y += ny * (R - d);
          const vn = ball.vx * nx + ball.vy * ny; if (vn < 0) { ball.vx -= 1.3 * vn * nx; ball.vy -= 1.3 * vn * ny; }
          const rpx = cx - w.cx, rpy = cy - w.cy; ball.vx += -w.speed * rpy * 0.6; ball.vy += w.speed * rpx * 0.6;
          w.glow = 1; addScore(75); game.shake = Math.max(game.shake, 3);
        }
      }
    }
    function applyWells(ball, h) { for (const w of wells) { const dx = w.x - ball.x, dy = w.y - ball.y, d = Math.hypot(dx, dy); if (d < w.radius && d > 1) { const a = w.strength * (1 - d / w.radius); ball.vx += dx / d * a * h; ball.vy += dy / d * a * h; } } }
    function checkWorm(ball, dt) {
      for (const w of wormholes) { if (w.cd > 0) { w.cd -= dt; continue; }
        if (Math.hypot(ball.x - w.a.x, ball.y - w.a.y) < w.r) { ball.x = w.b.x; ball.y = w.b.y + w.r + ball.r; w.cd = 0.6; addScore(200); game.shake = 6; }
        else if (Math.hypot(ball.x - w.b.x, ball.y - w.b.y) < w.r) { ball.x = w.a.x; ball.y = w.a.y + w.r + ball.r; w.cd = 0.6; addScore(200); game.shake = 6; } }
    }
    function stepBall(ball, dt) {
      if (ball.onPlunger) { ball.x = PLUNGER_X; ball.y = 800 + game.plunger * 26; ball.vx = 0; ball.vy = 0; return; }
      ball.vy += GRAV * dt; ball.vx *= 0.9995; ball.vy *= 0.9995;
      const sp = Math.hypot(ball.vx, ball.vy), MAX = 2300; if (sp > MAX) { ball.vx *= MAX / sp; ball.vy *= MAX / sp; }
      const sub = clamp(Math.ceil(sp * dt / (ball.r * 0.5)), 1, 12), h = dt / sub;
      for (let i = 0; i < sub; i++) {
        applyWells(ball, h); ball.x += ball.vx * h; ball.y += ball.vy * h;
        for (const s of segments) collideSegment(ball, s);
        for (const p of pegs) if (collideMoving(ball, p.x, p.y, p.r, 0, 0, 0.9)) { p.glow = 1; addScore(25); }
        for (const b of bumpers) collideBumper(ball, b);
        collideAsteroids(ball); collideWindmills(ball); collideFlipper(ball, flipperL); collideFlipper(ball, flipperR);
      }
      collideTargets(ball); checkWorm(ball, dt);
      ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 10) ball.trail.shift();
    }
    function drainCheck() {
      balls = balls.filter(b => b.y <= H + 40);
      if (game.state === 'play' && balls.length === 0) {
        game.balls -= 1; game.multiplier = 1;
        if (game.balls <= 0) endRun(false); else startNewBall();
      }
    }
    function updateFlipper(f, dt) {
      f.prevAngle = f.angle; const target = f.pressed ? f.up : f.rest, d = target - f.angle, step = 26 * dt * Math.sign(d);
      if (Math.abs(step) >= Math.abs(d)) f.angle = target; else f.angle += step; f.omega = dt > 0 ? (f.angle - f.prevAngle) / dt : 0;
    }

    // ---- Eingabe ----
    function launch() {
      const o = balls.find(b => b.onPlunger);
      if (o) { o.onPlunger = false; o.vy = -650 - game.plunger * 1250; o.vx = rand(-15, 5); if (game.state === 'ready') game.state = 'play'; flash('', 0); }
      game.plunger = 0;
    }
    function startFromState(cont) {
      if (game.state === 'title') startGame(cont ? Math.min(game.maxLevel - 1, LEVEL_COUNT - 1) : 0);
      else if (game.state === 'over') startGame(game.levelIdx);
      else if (game.state === 'win') game.state = 'title';
    }
    function onKeyDown(e) {
      if (e.repeat) return; const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') flipperL.pressed = true;
      if (k === 'd' || k === 'arrowright') flipperR.pressed = true;
      if (k === ' ' || k === 'arrowdown') { game.plungerHold = true; e.preventDefault(); }
      if (k === 'enter') startFromState(false);
      if (k === 'c') startFromState(true);
    }
    function onKeyUp(e) {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') flipperL.pressed = false;
      if (k === 'd' || k === 'arrowright') flipperR.pressed = false;
      if (k === ' ' || k === 'arrowdown') { game.plungerHold = false; launch(); }
    }
    // Overlay-Buttons (Tap)
    const START_BTN = { x: W / 2 - 110, y: 512, w: 220, h: 46 };
    const CONT_BTN = { x: W / 2 - 110, y: 568, w: 220, h: 40 };
    const RETRY_BTN = { x: W / 2 - 110, y: 462, w: 220, h: 46 };
    const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    function toInternal(cx, cy) { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left) / r.width * W, y: (cy - r.top) / r.height * H }; }
    function onPointer(e) {
      const t = e.changedTouches ? e.changedTouches[0] : e; const p = toInternal(t.clientX, t.clientY);
      if (game.state === 'title') { if (inRect(p, START_BTN)) startGame(0); else if (game.maxLevel > 1 && inRect(p, CONT_BTN)) startGame(Math.min(game.maxLevel - 1, LEVEL_COUNT - 1)); }
      else if (game.state === 'over') { if (inRect(p, RETRY_BTN)) startGame(game.levelIdx); }
      else if (game.state === 'win') { if (inRect(p, RETRY_BTN)) game.state = 'title'; }
    }

    // ---- Zeichnen ----
    function neon(ax, ay, bx, by, color, w, glow) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; if (pal.glow) { ctx.shadowColor = color; ctx.shadowBlur = 8 + glow * 16; } ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore(); }
    function orb(x, y, r, inner, outer, blur) { ctx.save(); if (pal.glow) { ctx.shadowColor = outer; ctx.shadowBlur = blur; } const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); g.addColorStop(0, inner); g.addColorStop(1, outer); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); }
    function bg() {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, pal.bg1); g.addColorStop(1, pal.bg0); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (pal.retro) { ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = pal.wall; ctx.lineWidth = 1; for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } ctx.restore(); }
      else { ctx.save(); for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.15 + (i % 5) * 0.12; ctx.fillStyle = i % 3 === 0 ? pal.blueHi : i % 3 === 1 ? pal.yelHi : '#fff'; ctx.fillRect(i * 97 % W, i * 173 % H, 2, 2); } ctx.restore(); }
    }
    function table() {
      for (const s of segments) { const c = s.kind === 'sling' ? pal.yellow : (s.glow > 0.05 && pal.glow ? pal.wallHi : pal.wall); neon(s.a.x, s.a.y, s.b.x, s.b.y, c, s.kind === 'sling' ? 6 : 4, s.glow); s.glow *= 0.85; }
      ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = pal.blue; ctx.fillRect(LANE_LEFT + 4, 260, RIGHT - LANE_LEFT - 8, 560); ctx.restore();
    }
    function drawWells() { for (const w of wells) { w.pulse += 0.05; ctx.save(); for (let i = 4; i >= 1; i--) { ctx.globalAlpha = 0.06 * i; ctx.strokeStyle = pal.worm; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w.x, w.y, w.radius * (i / 4) * (0.9 + 0.1 * Math.sin(w.pulse)), 0, TAU); ctx.stroke(); } ctx.restore(); orb(w.x, w.y, 14, '#000', pal.worm, 24); ctx.save(); ctx.strokeStyle = pal.wormHi; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w.x, w.y, 16, 0, TAU); ctx.stroke(); ctx.restore(); } }
    function drawWorm() { for (const w of wormholes) { w.spin += 0.12; for (const e of [w.a, w.b]) { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(w.spin); if (pal.glow) { ctx.shadowColor = pal.worm; ctx.shadowBlur = 18; } for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.8 - i * 0.2; ctx.strokeStyle = i % 2 ? pal.blueHi : pal.wormHi; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, w.r - i * 4, i, i + 4.3); ctx.stroke(); } ctx.restore(); } } }
    function drawPegs() { for (const p of pegs) { orb(p.x, p.y, p.r, '#fff', pal.blueHi, 8 + p.glow * 14); p.glow *= 0.85; } }
    function drawAst() { for (const a of asteroids) { const p = astPos(a); ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = pal.rock; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(a.cx, a.cy, a.orbitR, 0, TAU); ctx.stroke(); ctx.restore(); orb(p.x, p.y, a.r, pal.rockHi, pal.rock, 10 + a.glow * 18); ctx.save(); ctx.fillStyle = 'rgba(40,40,70,0.6)'; ctx.beginPath(); ctx.arc(p.x + 3, p.y + 2, a.r * 0.35, 0, TAU); ctx.fill(); ctx.restore(); a.glow *= 0.85; } }
    function drawWind() { for (const w of windmills) { for (let k = 0; k < w.arms; k++) { const tip = wmTip(w, k); neon(w.cx, w.cy, tip.x, tip.y, k % 2 ? pal.red : pal.blue, 10, w.glow); neon(w.cx, w.cy, tip.x, tip.y, '#fff', 3, 0); } orb(w.cx, w.cy, 9, pal.yelHi, pal.yellow, 12); w.glow *= 0.85; } }
    function coreCol(core) { return core === 'blue' ? pal.blue : core === 'red' ? pal.red : pal.yellow; }
    function coreHi(core) { return core === 'blue' ? pal.blueHi : core === 'red' ? pal.redHi : pal.yelHi; }
    function drawBumpers() {
      for (const b of bumpers) { const base = coreCol(b.core), hi = coreHi(b.core);
        if (pal.retro) { ctx.save(); ctx.fillStyle = base; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.lineWidth = b.lit ? 6 : 4; ctx.strokeStyle = b.lit ? '#fff' : hi; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke(); ctx.fillStyle = hi; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU); ctx.fill(); ctx.restore(); }
        else { ctx.save(); ctx.shadowColor = base; ctx.shadowBlur = 20 + b.glow * 30 + (b.lit ? 15 : 0); const g = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, b.r); g.addColorStop(0, hi); g.addColorStop(1, base); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.lineWidth = b.lit ? 5 : 3; ctx.strokeStyle = b.lit ? '#fff' : hi; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5 + b.glow * 6, 0, TAU); ctx.stroke(); ctx.restore(); }
        b.glow *= 0.88;
      }
    }
    function drawTargets() { for (const tg of targets) { ctx.save(); const c = coreCol(tg.core); if (tg.down) { ctx.globalAlpha = 0.22; ctx.fillStyle = c; } else { if (pal.glow) { ctx.shadowColor = c; ctx.shadowBlur = 14; } ctx.fillStyle = c; } ctx.fillRect(tg.x - tg.w / 2, tg.y - tg.h / 2, tg.w, tg.h); ctx.restore(); } }
    function drawFlipper(f) { const tip = flipperTip(f); ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = pal.red; if (pal.glow) { ctx.shadowColor = pal.red; ctx.shadowBlur = 16; } ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(tip.x, tip.y); ctx.stroke(); ctx.strokeStyle = pal.redHi; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(tip.x, tip.y); ctx.stroke(); ctx.fillStyle = pal.yellow; ctx.beginPath(); ctx.arc(f.px, f.py, 7, 0, TAU); ctx.fill(); ctx.restore(); }
    function drawBalls() {
      for (const ball of balls) {
        for (let i = 0; i < ball.trail.length; i++) { const p = ball.trail[i]; ctx.save(); ctx.globalAlpha = i / ball.trail.length * 0.4; ctx.fillStyle = pal.trail; ctx.beginPath(); ctx.arc(p.x, p.y, ball.r * (i / ball.trail.length), 0, TAU); ctx.fill(); ctx.restore(); }
        ctx.save(); if (pal.glow) { ctx.shadowColor = pal.trail; ctx.shadowBlur = 18; } const g = ctx.createRadialGradient(ball.x - 4, ball.y - 4, 2, ball.x, ball.y, ball.r); g.addColorStop(0, pal.ball[0]); g.addColorStop(0.5, pal.ball[1]); g.addColorStop(1, pal.ball[2]); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    function drawPlunger() { const x = PLUNGER_X, topY = 826, h = game.plunger * 26; ctx.save(); ctx.fillStyle = pal.yellow; if (pal.glow) { ctx.shadowColor = pal.yellow; ctx.shadowBlur = 10; } ctx.fillRect(x - 12, topY + h, 24, 30); ctx.strokeStyle = pal.yelHi; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { const yy = topY + h + 30 + i * (8 + h * 0.2); ctx.beginPath(); ctx.moveTo(x - 12, yy); ctx.lineTo(x + 12, yy + 4); ctx.stroke(); } ctx.restore(); }
    function scan() { if (pal.scan > 0) { ctx.save(); ctx.globalAlpha = pal.scan; ctx.fillStyle = '#000'; for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1); ctx.restore(); } }
    function hud() {
      ctx.save(); ctx.fillStyle = pal.text; ctx.textBaseline = 'top';
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif'; ctx.fillText('PUNKTE', 16, 10);
      ctx.font = 'bold 26px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = pal.yellow; ctx.fillText(game.score.toLocaleString('de-DE'), 16, 26);
      ctx.textAlign = 'right'; ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = pal.text; ctx.fillText('KUGELN ' + game.balls, W - 16, 12);
      ctx.fillStyle = game.multiplier > 1 ? pal.red : pal.text; ctx.fillText('x' + game.multiplier, W - 16, 30);
      ctx.textAlign = 'center'; ctx.fillStyle = pal.text; ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('LVL ' + (game.levelIdx + 1) + '/' + LEVEL_COUNT + ' · ' + goal().name, W / 2, 10);
      ctx.font = '10px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = pal.wallHi; ctx.fillText(pal.name, W / 2, 28);
      const frac = clamp(progressNow() / goalValue(), 0, 1), bw = 200, bx = W / 2 - bw / 2, by = 42;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, by, bw, 7); ctx.fillStyle = pal.yellow; ctx.fillRect(bx, by, bw * frac, 7);
      ctx.font = '10px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = pal.blueHi; ctx.fillText(goalText(), W / 2, by + 10);
      ctx.restore();
      if (game.msgTimer > 0 && game.message) { ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = pal.text; ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif'; if (pal.glow) { ctx.shadowColor = pal.yellow; ctx.shadowBlur = 12; } ctx.fillText(game.message, W / 2, H / 2 - 60); ctx.restore(); }
    }
    function button(r, label, col) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 10); ctx.fill(); ctx.stroke(); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif'; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2); ctx.restore(); }
    function ctext(t, y, c, f) { ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = c; ctx.font = f; if (pal.glow) { ctx.shadowColor = c; ctx.shadowBlur = 16; } ctx.fillText(t, W / 2, y); ctx.restore(); }
    function title() {
      ctext('NOVA', 300, pal.yellow, 'bold 56px "Segoe UI", system-ui, sans-serif');
      ctext('PRISMA', 358, pal.blueHi, 'bold 56px "Segoe UI", system-ui, sans-serif');
      ctext('40 LEVEL · von Retro bis Hyper-Neon', 420, pal.text, 'bold 15px "Segoe UI", system-ui, sans-serif');
      ctext(diff.name + '-Modus', 450, pal.wallHi, '13px "Segoe UI", system-ui, sans-serif');
      button(START_BTN, '▶  LEVEL 1', pal.yellow);
      if (game.maxLevel > 1) button(CONT_BTN, 'WEITER · Level ' + Math.min(game.maxLevel, LEVEL_COUNT), pal.redHi);
    }
    function overlay(t, c, sub) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); ctx.restore(); ctext(t, 330, c, 'bold 44px "Segoe UI", system-ui, sans-serif'); ctext(game.score.toLocaleString('de-DE') + ' Punkte', 392, pal.yellow, 'bold 26px "Segoe UI", system-ui, sans-serif'); ctext(sub, 428, pal.text, '14px "Segoe UI", system-ui, sans-serif'); button(RETRY_BTN, t === 'GEWONNEN!' ? 'ZUM MENÜ' : 'NOCHMAL', pal.blueHi); }

    // ---- Schleife ----
    function loop(now) {
      if (!running) return;
      let dt = (now - last) / 1000; last = now; if (!(dt > 0)) dt = 1 / 60; if (dt > 0.05) dt = 0.05;
      if (game.plungerHold && balls.some(b => b.onPlunger)) game.plunger = clamp(game.plunger + dt * 1.4, 0, 1);
      for (const a of asteroids) a.t += a.speed * dt;
      for (const w of windmills) w.angle += w.speed * dt;
      if (game.state !== 'title') { updateFlipper(flipperL, dt); updateFlipper(flipperR, dt); }
      if (game.state === 'play' || game.state === 'ready') {
        for (const b of balls) stepBall(b, dt); drainCheck();
        if (game.state === 'play' && goalReached()) { if (game.levelIdx + 1 >= LEVEL_COUNT) { endRun(true); } else completeLevel(); }
      } else if (game.state === 'levelclear') { for (const b of balls) stepBall(b, dt); if (--game.clearTimer <= 0) { game.balls = diff.balls; loadLevel(game.levelIdx + 1); startNewBall(); } }
      if (game.msgTimer > 0) game.msgTimer--; if (game.prismaFlash > 0) game.prismaFlash--; if (game.shake > 0) game.shake *= 0.9;

      ctx.save(); if (game.shake > 0.5) ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));
      bg();
      if (game.prismaFlash > 0) { ctx.save(); ctx.globalAlpha = game.prismaFlash / 60 * 0.5; ctx.fillStyle = [pal.blue, pal.red, pal.yellow][Math.floor(now / 60) % 3]; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      table(); drawWells(); drawWorm(); drawPegs(); drawTargets(); drawAst(); drawWind(); drawBumpers(); drawFlipper(flipperL); drawFlipper(flipperR); drawPlunger(); drawBalls();
      if (game.state !== 'title') hud();
      if (game.state === 'title') title();
      if (game.state === 'over') overlay('GAME OVER', pal.red, 'Level ' + (game.levelIdx + 1) + ' erneut');
      if (game.state === 'win') overlay('GEWONNEN!', pal.yellow, 'Alle 40 Level — Legende!');
      scan();
      ctx.restore();
      raf = requestAnimationFrame(loop);
    }

    function start() {
      host.fit(W, H);
      host.addButton('◄', () => flipperL.pressed = true, () => flipperL.pressed = false, 'flip');
      const mid = document.createElement('div'); mid.className = 'ctlmid';
      host.controls.appendChild(mid);
      const pb = document.createElement('button'); pb.className = 'ctl plunger'; pb.innerHTML = 'FEDER<br>halten';
      const pd = e => { e.preventDefault(); game.plungerHold = true; }, pu = e => { e.preventDefault(); game.plungerHold = false; launch(); };
      pb.addEventListener('touchstart', pd, { passive: false }); pb.addEventListener('touchend', pu, { passive: false }); pb.addEventListener('mousedown', pd); pb.addEventListener('mouseup', pu); pb.addEventListener('mouseleave', pu);
      mid.appendChild(pb);
      host.addButton('►', () => flipperR.pressed = true, () => flipperR.pressed = false, 'flip');
      window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
      canvas.addEventListener('pointerdown', onPointer);
      loadLevel(0); game.state = 'title';
      running = true; last = performance.now(); raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false; if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointer);
    }
    return { start, stop };
  }

  window.NA.register('pinball', { name: 'NOVA PRISMA', tag: 'Flipper · 40 Level · Retro → Neon', emoji: '🔴', make: makePinball });
})();
