/* BLOCK NOVA — Breakout/Arkanoid fuer den NOVA ARCADE Hub */
(function () {
  'use strict';
  const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function make(host) {
    const canvas = host.canvas, ctx = host.ctx, W = 520, H = 720;
    const diff = host.diff(), skin = host.skin();
    const COLS = ['#2f7bff', '#ff3b5e', '#ffd233'];
    let raf = null, running = false, last = 0;
    let paddle, ball, bricks, lives, score, wave, state, reported;

    function reset(full) {
      if (full) { lives = 3; score = 0; wave = 1; reported = false; }
      paddle = { w: 120 / (diff.bSpeed), x: W / 2 - 60, y: H - 44, h: 14, speed: 620 };
      launchBall();
      buildBricks();
      state = 'ready';
    }
    function launchBall() {
      const sp = (300 + wave * 20) * diff.bSpeed;
      ball = { x: W / 2, y: H - 70, r: 9, vx: sp * 0.5, vy: -sp, stuck: true };
    }
    function buildBricks() {
      bricks = []; const rows = 4 + Math.min(wave, 4), cols = 9, bw = (W - 60) / cols, bh = 22;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
        bricks.push({ x: 30 + c * bw, y: 70 + r * (bh + 8), w: bw - 6, h: bh, c: COLS[(r + c) % 3], alive: true });
    }
    function loseLife() { lives--; if (lives <= 0) { end(); } else { launchBall(); state = 'ready'; } }
    function end() { if (!reported) { reported = true; host.submitScore(score, { wave }); } state = 'over'; }

    function step(dt) {
      if (left) paddle.x -= paddle.speed * dt;
      if (right) paddle.x += paddle.speed * dt;
      paddle.x = clamp(paddle.x, 10, W - paddle.w - 10);
      if (ball.stuck) { ball.x = paddle.x + paddle.w / 2; return; }
      const sub = 3, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        ball.x += ball.vx * h; ball.y += ball.vy * h;
        if (ball.x < ball.r) { ball.x = ball.r; ball.vx *= -1; }
        if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx *= -1; }
        if (ball.y < ball.r + 50) { ball.y = ball.r + 50; ball.vy *= -1; }
        if (ball.y > H + 30) { loseLife(); return; }
        if (ball.y + ball.r > paddle.y && ball.y - ball.r < paddle.y + paddle.h && ball.x > paddle.x && ball.x < paddle.x + paddle.w && ball.vy > 0) {
          ball.vy *= -1; const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
          const sp = Math.hypot(ball.vx, ball.vy); const ang = hit * 1.0;
          ball.vx = Math.sin(ang) * sp; ball.vy = -Math.abs(Math.cos(ang) * sp); ball.y = paddle.y - ball.r;
        }
        for (const b of bricks) {
          if (!b.alive) continue;
          if (ball.x > b.x - ball.r && ball.x < b.x + b.w + ball.r && ball.y > b.y - ball.r && ball.y < b.y + b.h + ball.r) {
            b.alive = false; score += 50;
            const ox = Math.min(ball.x - (b.x - ball.r), (b.x + b.w + ball.r) - ball.x);
            const oy = Math.min(ball.y - (b.y - ball.r), (b.y + b.h + ball.r) - ball.y);
            if (ox < oy) ball.vx *= -1; else ball.vy *= -1;
            break;
          }
        }
      }
      if (bricks.every(b => !b.alive)) { wave++; score += 500; launchBall(); buildBricks(); state = 'ready'; }
    }

    function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
    function draw() {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a1230'); g.addColorStop(1, '#05030f'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const b of bricks) { if (!b.alive) continue; ctx.save(); ctx.shadowColor = b.c; ctx.shadowBlur = 10; ctx.fillStyle = b.c; roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill(); ctx.restore(); }
      ctx.save(); ctx.shadowColor = skin.accent; ctx.shadowBlur = 14; ctx.fillStyle = skin.accent; roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 7); ctx.fill(); ctx.restore();
      ctx.save(); ctx.shadowColor = skin.trail; ctx.shadowBlur = 14; const bg = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.r); bg.addColorStop(0, skin.ball[0]); bg.addColorStop(1, skin.ball[2]); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#eef1ff'; ctx.font = 'bold 18px "Segoe UI",system-ui,sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillText('SCORE ' + score.toLocaleString('de-DE'), 16, 14);
      ctx.textAlign = 'right'; ctx.fillText('♥ ' + lives + '  ·  Welle ' + wave, W - 16, 14);
      ctx.textAlign = 'center';
      if (state === 'ready') { ctx.fillStyle = '#ffd233'; ctx.font = 'bold 18px "Segoe UI",system-ui,sans-serif'; if (Math.floor(Date.now() / 500) % 2 === 0) ctx.fillText('Tippen / Leertaste zum Abschuss', W / 2, H / 2); }
      if (state === 'over') { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#ff2f5e'; ctx.shadowColor = '#ff2f5e'; ctx.shadowBlur = 16; ctx.font = 'bold 40px "Segoe UI",system-ui,sans-serif'; ctx.fillText('GAME OVER', W / 2, H / 2 - 40); ctx.shadowBlur = 0; ctx.fillStyle = '#ffd233'; ctx.font = 'bold 24px "Segoe UI",system-ui,sans-serif'; ctx.fillText(score.toLocaleString('de-DE') + ' Punkte', W / 2, H / 2 + 6); ctx.fillStyle = '#5aa0ff'; ctx.font = 'bold 18px "Segoe UI",system-ui,sans-serif'; if (Math.floor(Date.now() / 500) % 2 === 0) ctx.fillText('Tippen = nochmal', W / 2, H / 2 + 48); ctx.restore(); }
    }

    let left = false, right = false;
    function fire() { if (state === 'over') { reset(true); return; } if (state === 'ready') { state = 'play'; ball.stuck = false; } }
    function kd(e) { const k = e.key.toLowerCase(); if (k === 'a' || k === 'arrowleft') left = true; if (k === 'd' || k === 'arrowright') right = true; if (k === ' ' || k === 'enter') { fire(); e.preventDefault(); } }
    function ku(e) { const k = e.key.toLowerCase(); if (k === 'a' || k === 'arrowleft') left = false; if (k === 'd' || k === 'arrowright') right = false; }
    function toX(cx) { const r = canvas.getBoundingClientRect(); return (cx - r.left) / r.width * W; }
    function pointer(e) { const t = e.touches ? e.touches[0] : e; if (!t) return; if (e.type === 'pointerdown' || e.type === 'mousedown' || e.type === 'touchstart') fire(); if (t.clientX != null) paddle && (paddle.x = clamp(toX(t.clientX) - paddle.w / 2, 10, W - paddle.w - 10)); }

    function loop(now) { if (!running) return; let dt = (now - last) / 1000; last = now; if (!(dt > 0)) dt = 1 / 60; if (dt > 0.05) dt = 0.05; if (state === 'play') step(dt); draw(); raf = requestAnimationFrame(loop); }
    function start() {
      host.fit(W, H); reset(true);
      host.addButton('◄', () => left = true, () => left = false, 'flip');
      host.addButton('ABSCHUSS', () => fire(), null, 'wide');
      host.addButton('►', () => right = true, () => right = false, 'flip');
      window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
      canvas.addEventListener('pointerdown', pointer); canvas.addEventListener('pointermove', pointer);
      running = true; last = performance.now(); raf = requestAnimationFrame(loop);
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); canvas.removeEventListener('pointerdown', pointer); canvas.removeEventListener('pointermove', pointer); }
    return { start, stop };
  }
  window.NA.register('breakout', { name: 'BLOCK NOVA', tag: 'Breakout · Blöcke zerlegen', emoji: '🧱', make: make });
})();
