/* NEON PONG — Tischtennis mit Balken (du unten vs. CPU oben) */
(function () {
  'use strict';
  const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function make(host) {
    const canvas = host.canvas, ctx = host.ctx, W = 480, H = 720;
    const diff = host.diff(), skin = host.skin();
    const PW = 110, PH = 16, WIN = 7;
    let raf = null, running = false, last = 0;
    let me, cpu, ball, myScore, cpuScore, state, reported, serveDir;

    function reset(full) {
      if (full) { myScore = 0; cpuScore = 0; reported = false; }
      me = { x: W / 2 - PW / 2, y: H - 46, w: PW };
      cpu = { x: W / 2 - PW / 2, y: 30, w: PW };
      serve(full ? 1 : serveDir);
      state = 'ready';
    }
    function serve(dir) { serveDir = dir; const sp = 300 * diff.bSpeed; ball = { x: W / 2, y: H / 2, r: 9, vx: (Math.random() * 2 - 1) * sp * 0.6, vy: dir * sp }; }
    function point(forMe) {
      if (forMe) myScore++; else cpuScore++;
      if (myScore >= WIN || cpuScore >= WIN) { end(); }
      else { serve(forMe ? -1 : 1); state = 'ready'; }
    }
    function end() {
      const win = myScore > cpuScore;
      const score = win ? 1000 + (WIN - cpuScore) * 120 : myScore * 60;
      if (!reported) { reported = true; host.submitScore(score, { win, my: myScore, cpu: cpuScore }); }
      state = 'over';
    }

    function step(dt) {
      // Spieler
      if (left) me.x -= 640 * dt; if (right) me.x += 640 * dt;
      me.x = clamp(me.x, 6, W - me.w - 6);
      // CPU: folgt dem Ball, Tempo nach Schwierigkeit
      const cpuSpeed = (240 + diff.bSpeed * 160);
      const target = ball.x - cpu.w / 2;
      cpu.x += clamp(target - cpu.x, -cpuSpeed * dt, cpuSpeed * dt);
      cpu.x = clamp(cpu.x, 6, W - cpu.w - 6);

      const sub = 3, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        ball.x += ball.vx * h; ball.y += ball.vy * h;
        if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
        if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
        // unteres Paddle (ich)
        if (ball.vy > 0 && ball.y + ball.r > me.y && ball.y < me.y + PH && ball.x > me.x && ball.x < me.x + me.w) {
          const hit = (ball.x - (me.x + me.w / 2)) / (me.w / 2); const sp = Math.hypot(ball.vx, ball.vy) * 1.04;
          ball.vx = clamp(hit, -1, 1) * sp * 0.8; ball.vy = -Math.abs(Math.sqrt(Math.max(sp * sp - ball.vx * ball.vx, 1))); ball.y = me.y - ball.r;
        }
        // oberes Paddle (CPU)
        if (ball.vy < 0 && ball.y - ball.r < cpu.y + PH && ball.y > cpu.y && ball.x > cpu.x && ball.x < cpu.x + cpu.w) {
          const hit = (ball.x - (cpu.x + cpu.w / 2)) / (cpu.w / 2); const sp = Math.hypot(ball.vx, ball.vy) * 1.04;
          ball.vx = clamp(hit, -1, 1) * sp * 0.8; ball.vy = Math.abs(Math.sqrt(Math.max(sp * sp - ball.vx * ball.vx, 1))); ball.y = cpu.y + PH + ball.r;
        }
        if (ball.y > H + 20) { point(false); return; }
        if (ball.y < -20) { point(true); return; }
      }
    }

    function paddle(p, col) { ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, PH, 8); ctx.fill(); ctx.restore(); }
    function draw() {
      ctx.fillStyle = '#05030f'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = skin.accent; ctx.lineWidth = 2; ctx.setLineDash([10, 12]); ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 60px "Segoe UI",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cpuScore, W / 2, H / 2 - 48); ctx.fillText(myScore, W / 2, H / 2 + 48); ctx.restore();
      paddle(cpu, '#ff3b5e'); paddle(me, skin.accent);
      ctx.save(); ctx.shadowColor = skin.trail; ctx.shadowBlur = 14; const g = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.r); g.addColorStop(0, skin.ball[0]); g.addColorStop(1, skin.ball[2]); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#eef1ff'; ctx.textAlign = 'center';
      if (state === 'ready') { ctx.font = 'bold 18px "Segoe UI",system-ui,sans-serif'; ctx.fillStyle = '#ffd233'; if (Math.floor(Date.now() / 500) % 2 === 0) ctx.fillText('Tippen / Leertaste = Aufschlag', W / 2, H / 2 + 120); }
      if (state === 'over') { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); const win = myScore > cpuScore; ctx.fillStyle = win ? '#ffd233' : '#ff2f5e'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16; ctx.font = 'bold 40px "Segoe UI",system-ui,sans-serif'; ctx.fillText(win ? 'GEWONNEN!' : 'VERLOREN', W / 2, H / 2 - 30); ctx.shadowBlur = 0; ctx.fillStyle = '#eef1ff'; ctx.font = 'bold 26px "Segoe UI",system-ui,sans-serif'; ctx.fillText(myScore + ' : ' + cpuScore, W / 2, H / 2 + 20); ctx.fillStyle = '#5aa0ff'; ctx.font = 'bold 18px "Segoe UI",system-ui,sans-serif'; if (Math.floor(Date.now() / 500) % 2 === 0) ctx.fillText('Tippen = nochmal', W / 2, H / 2 + 60); ctx.restore(); }
    }

    let left = false, right = false;
    function fire() { if (state === 'over') reset(true); else if (state === 'ready') state = 'play'; }
    function kd(e) { const k = e.key.toLowerCase(); if (k === 'a' || k === 'arrowleft') left = true; if (k === 'd' || k === 'arrowright') right = true; if (k === ' ' || k === 'enter') { fire(); e.preventDefault(); } }
    function ku(e) { const k = e.key.toLowerCase(); if (k === 'a' || k === 'arrowleft') left = false; if (k === 'd' || k === 'arrowright') right = false; }
    function toX(cx) { const r = canvas.getBoundingClientRect(); return (cx - r.left) / r.width * W; }
    function pointer(e) { const t = e.touches ? e.touches[0] : e; if (!t) return; if (e.type === 'pointerdown' || e.type === 'mousedown' || e.type === 'touchstart') fire(); if (t.clientX != null && me) me.x = clamp(toX(t.clientX) - me.w / 2, 6, W - me.w - 6); }

    function loop(now) { if (!running) return; let dt = (now - last) / 1000; last = now; if (!(dt > 0)) dt = 1 / 60; if (dt > 0.05) dt = 0.05; if (state === 'play') step(dt); draw(); raf = requestAnimationFrame(loop); }
    function start() {
      host.fit(W, H); reset(true);
      host.addButton('◄', () => left = true, () => left = false, 'flip');
      host.addButton('AUFSCHLAG', () => fire(), null, 'wide');
      host.addButton('►', () => right = true, () => right = false, 'flip');
      window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
      canvas.addEventListener('pointerdown', pointer); canvas.addEventListener('pointermove', pointer);
      running = true; last = performance.now(); raf = requestAnimationFrame(loop);
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); canvas.removeEventListener('pointerdown', pointer); canvas.removeEventListener('pointermove', pointer); }
    return { start, stop };
  }
  window.NA.register('pong', { name: 'NEON PONG', tag: 'Tischtennis · du vs. CPU', emoji: '🏓', make: make });
})();
