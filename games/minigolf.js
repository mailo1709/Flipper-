/* NOVA GOLF — Minigolf, 9 Bahnen. Ziehen & loslassen zum Schlagen. */
(function () {
  'use strict';
  const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const W = 480, H = 760, M = 14, TOP = 54, R = 9, CUP = 15, MAXPULL = 150, MAXSPEED = 1000;

  const HOLES = [
    { tee: [240, 670], cup: [240, 150], obs: [] },
    { tee: [240, 670], cup: [240, 150], obs: [[150, 400, 180, 24]] },
    { tee: [120, 670], cup: [360, 150], obs: [[80, 430, 170, 22], [230, 300, 170, 22]] },
    { tee: [240, 670], cup: [240, 140], obs: [[120, 340, 24, 200], [336, 340, 24, 200]] },
    { tee: [60, 670], cup: [420, 150], obs: [[14, 300, 320, 22], [146, 470, 320, 22]] },
    { tee: [240, 680], cup: [240, 150], obs: [[90, 380, 110, 24], [280, 380, 110, 24]] },
    { tee: [100, 680], cup: [380, 160], obs: [[200, 260, 36, 150], [120, 460, 150, 22]] },
    { tee: [240, 680], cup: [120, 160], obs: [[200, 300, 36, 160], [240, 470, 200, 22], [60, 380, 140, 22]] },
    { tee: [240, 690], cup: [240, 140], obs: [[120, 300, 24, 150], [336, 300, 24, 150], [180, 480, 120, 24], [222, 220, 36, 70]] }
  ];

  function make(host) {
    const canvas = host.canvas, ctx = host.ctx;
    const diff = host.diff(), skin = host.skin();
    let raf = null, running = false, last = 0;
    let hole, ball, segs, cup, strokes, total, score, state, reported, aiming, aimX, aimY;

    function border() {
      return [
        { a: { x: M, y: TOP }, b: { x: W - M, y: TOP } },
        { a: { x: W - M, y: TOP }, b: { x: W - M, y: H - M } },
        { a: { x: W - M, y: H - M }, b: { x: M, y: H - M } },
        { a: { x: M, y: H - M }, b: { x: M, y: TOP } }
      ];
    }
    function rectSegs(r) {
      const [x, y, w, h] = r;
      return [
        { a: { x, y }, b: { x: x + w, y } }, { a: { x: x + w, y }, b: { x: x + w, y: y + h } },
        { a: { x: x + w, y: y + h }, b: { x, y: y + h } }, { a: { x, y: y + h }, b: { x, y } }
      ];
    }
    function loadHole(i) {
      hole = i; const hd = HOLES[i];
      segs = border(); hd.obs.forEach(r => segs = segs.concat(rectSegs(r)));
      ball = { x: hd.tee[0], y: hd.tee[1], vx: 0, vy: 0, stopped: true };
      cup = { x: hd.cup[0], y: hd.cup[1] }; strokes = 0; state = 'aim';
    }
    function reset() { total = 0; score = 0; reported = false; loadHole(0); }

    function collideSeg(s) {
      const ax = s.a.x, ay = s.a.y, abx = s.b.x - ax, aby = s.b.y - ay, l2 = abx * abx + aby * aby || 1;
      const t = clamp(((ball.x - ax) * abx + (ball.y - ay) * aby) / l2, 0, 1);
      const cx = ax + abx * t, cy = ay + aby * t; let dx = ball.x - cx, dy = ball.y - cy, d = Math.hypot(dx, dy);
      if (d < R) {
        if (d < 1e-4) { dx = 0; dy = -1; d = 1e-4; }
        const nx = dx / d, ny = dy / d; ball.x += nx * (R - d); ball.y += ny * (R - d);
        const vn = ball.vx * nx + ball.vy * ny; if (vn < 0) { ball.vx -= 1.6 * vn * nx; ball.vy -= 1.6 * vn * ny; }
      }
    }
    function sink() {
      const reward = Math.max(120, 760 - (strokes - 1) * 150); score += reward; total += strokes;
      if (hole + 1 >= HOLES.length) { score += 1200; if (!reported) { reported = true; host.submitScore(score, { strokes: total }); } state = 'done'; }
      else { setTimeout(() => { if (running) loadHole(hole + 1); }, 500); state = 'sunk'; }
    }
    function step(dt) {
      if (ball.stopped) return;
      const f = Math.pow(0.5, dt); // Reibung
      const sub = 4, h = dt / sub;
      for (let i = 0; i < sub; i++) {
        ball.x += ball.vx * h; ball.y += ball.vy * h;
        for (const s of segs) collideSeg(s);
        const dcx = cup.x - ball.x, dcy = cup.y - ball.y, dc = Math.hypot(dcx, dcy), sp = Math.hypot(ball.vx, ball.vy);
        if (dc < CUP * 0.7 || (dc < CUP && sp < 320)) { ball.vx = 0; ball.vy = 0; ball.stopped = true; sink(); return; }
        else if (dc < CUP + R && sp < 520) { ball.vx += dcx / (dc || 1) * 900 * h; ball.vy += dcy / (dc || 1) * 900 * h; } // Sog in Lochnähe
      }
      ball.vx *= f; ball.vy *= f;
      if (Math.hypot(ball.vx, ball.vy) < 7) { ball.vx = 0; ball.vy = 0; ball.stopped = true; if (state === 'roll') state = 'aim'; }
    }

    function draw() {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a2714'); g.addColorStop(1, '#05140a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // Rasen-Fläche
      ctx.save(); ctx.fillStyle = '#123a1e'; ctx.strokeStyle = '#2e7d46'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(M, TOP, W - 2 * M, H - TOP - M, 10); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = '#7CFC98'; for (let y = TOP; y < H; y += 26) { ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); } ctx.restore();
      // Hindernisse
      for (const r of HOLES[hole].obs) { ctx.save(); ctx.fillStyle = '#5a3a1e'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6; ctx.beginPath(); ctx.roundRect(r[0], r[1], r[2], r[3], 4); ctx.fill(); ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
      // Loch + Fahne
      ctx.save(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cup.x, cup.y, CUP, 0, TAU); ctx.fill(); ctx.strokeStyle = '#eef1ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = '#cfd6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cup.x, cup.y); ctx.lineTo(cup.x, cup.y - 40); ctx.stroke();
      ctx.fillStyle = '#ff2f5e'; ctx.beginPath(); ctx.moveTo(cup.x, cup.y - 40); ctx.lineTo(cup.x + 22, cup.y - 32); ctx.lineTo(cup.x, cup.y - 24); ctx.closePath(); ctx.fill(); ctx.restore();
      // Ziel-Linie beim Zielen
      if (aiming) {
        const dx = ball.x - aimX, dy = ball.y - aimY, dist = Math.min(Math.hypot(dx, dy), MAXPULL), ang = Math.atan2(dy, dx);
        const ex = ball.x + Math.cos(ang) * dist * 1.6, ey = ball.y + Math.sin(ang) * dist * 1.6;
        ctx.save(); ctx.strokeStyle = skin.accent; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = dist > MAXPULL * 0.8 ? '#ff2f5e' : '#ffd233'; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, TAU); ctx.fill(); ctx.restore();
      }
      // Ball
      ctx.save(); ctx.shadowColor = skin.trail; ctx.shadowBlur = 12; const bg = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, R); bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#cfd6e8'); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, TAU); ctx.fill(); ctx.restore();
      // HUD
      ctx.fillStyle = '#eef1ff'; ctx.textBaseline = 'top'; ctx.font = 'bold 17px "Segoe UI",system-ui,sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('Loch ' + (hole + 1) + '/9', 14, 16); ctx.textAlign = 'center'; ctx.fillText('Schläge: ' + strokes, W / 2, 16);
      ctx.textAlign = 'right'; ctx.fillStyle = skin.accent; ctx.fillText('Score ' + score, W - 14, 16);
      if (state === 'aim' && ball.stopped && !aiming) { ctx.textAlign = 'center'; ctx.fillStyle = '#ffd233'; ctx.font = 'bold 15px "Segoe UI",system-ui,sans-serif'; if (Math.floor(Date.now() / 600) % 2 === 0) ctx.fillText('Ziehen & loslassen zum Schlagen', W / 2, H - 30); }
      if (state === 'done') { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#ffd233'; ctx.shadowColor = '#ffd233'; ctx.shadowBlur = 16; ctx.font = 'bold 38px "Segoe UI",system-ui,sans-serif'; ctx.fillText('RUNDE FERTIG!', W / 2, H / 2 - 50); ctx.shadowBlur = 0; ctx.fillStyle = '#eef1ff'; ctx.font = 'bold 22px "Segoe UI",system-ui,sans-serif'; ctx.fillText(total + ' Schläge · ' + score + ' Punkte', W / 2, H / 2 + 2); ctx.fillStyle = '#5aa0ff'; ctx.font = 'bold 18px "Segoe UI",system-ui,sans-serif'; if (Math.floor(Date.now() / 500) % 2 === 0) ctx.fillText('Tippen = nochmal', W / 2, H / 2 + 44); ctx.restore(); }
    }

    function toPt(cx, cy) { const r = canvas.getBoundingClientRect(); return { x: (cx - r.left) / r.width * W, y: (cy - r.top) / r.height * H }; }
    function down(e) {
      const t = e.touches ? e.touches[0] : e; const p = toPt(t.clientX, t.clientY);
      if (state === 'done') { reset(); return; }
      if (state === 'aim' && ball.stopped) { aiming = true; aimX = p.x; aimY = p.y; }
    }
    function move(e) { if (!aiming) return; const t = e.touches ? e.touches[0] : e; const p = toPt(t.clientX, t.clientY); aimX = p.x; aimY = p.y; e.preventDefault && e.preventDefault(); }
    function up() {
      if (!aiming) return; aiming = false;
      const dx = ball.x - aimX, dy = ball.y - aimY, dist = Math.hypot(dx, dy);
      if (dist < 8) return;
      const pull = Math.min(dist, MAXPULL), sp = pull / MAXPULL * MAXSPEED;
      ball.vx = dx / dist * sp; ball.vy = dy / dist * sp; ball.stopped = false; strokes++; state = 'roll';
    }

    function loop(now) { if (!running) return; let dt = (now - last) / 1000; last = now; if (!(dt > 0)) dt = 1 / 60; if (dt > 0.05) dt = 0.05; if (state === 'roll' || state === 'sunk') step(dt); draw(); raf = requestAnimationFrame(loop); }
    function start() {
      host.fit(W, H); reset();
      window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
      canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
      canvas.addEventListener('touchstart', down, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false });
      running = true; last = performance.now(); raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false; if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('touchstart', down); canvas.removeEventListener('touchmove', move);
    }
    return { start, stop };
  }
  window.NA.register('minigolf', { name: 'NOVA GOLF', tag: 'Minigolf · 9 Bahnen', emoji: '⛳', make: make });
})();
