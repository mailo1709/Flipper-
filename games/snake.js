/* GRID SNAKE — Retro-Klassiker fuer den NOVA ARCADE Hub */
(function () {
  'use strict';
  function make(host) {
    const canvas = host.canvas, ctx = host.ctx;
    const CELL = 26, GRID = 20, W = CELL * GRID, H = CELL * GRID + 44, TOP = 44;
    const diff = host.diff(), skin = host.skin();
    const wrap = diff.name === 'Chill';           // Chill: Waende durchlaessig
    let raf = null, running = false, acc = 0, stepT = 0.16 / diff.bSpeed;
    let snake, dir, nextDir, food, score, state, reported, grow;

    function reset() {
      snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      dir = { x: 1, y: 0 }; nextDir = dir; score = 0; grow = 0; reported = false; state = 'play'; placeFood();
    }
    function placeFood() { do { food = { x: (Math.random() * GRID) | 0, y: (Math.random() * GRID) | 0 }; } while (snake.some(s => s.x === food.x && s.y === food.y)); }
    function end() { if (!reported) { reported = true; host.submitScore(score, { len: snake.length }); } state = 'over'; }

    function tick() {
      dir = nextDir;
      let hx = snake[0].x + dir.x, hy = snake[0].y + dir.y;
      if (wrap) { hx = (hx + GRID) % GRID; hy = (hy + GRID) % GRID; }
      else if (hx < 0 || hy < 0 || hx >= GRID || hy >= GRID) { end(); return; }
      if (snake.some(s => s.x === hx && s.y === hy)) { end(); return; }
      snake.unshift({ x: hx, y: hy });
      if (hx === food.x && hy === food.y) { score += 10; grow += 2; placeFood(); }
      if (grow > 0) grow--; else snake.pop();
    }
    function setDir(x, y) { if (x === -dir.x && y === -dir.y) return; nextDir = { x, y }; }

    function cellRect(cx, cy) { return [cx * CELL, TOP + cy * CELL, CELL, CELL]; }
    function draw() {
      ctx.fillStyle = '#05030f'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = skin.accent; for (let i = 0; i <= GRID; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, TOP); ctx.lineTo(i * CELL, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, TOP + i * CELL); ctx.lineTo(W, TOP + i * CELL); ctx.stroke(); } ctx.restore();
      // Futter
      const [fx, fy, fw] = cellRect(food.x, food.y); ctx.save(); ctx.shadowColor = '#ff2f5e'; ctx.shadowBlur = 14; ctx.fillStyle = '#ff2f5e'; ctx.beginPath(); ctx.arc(fx + fw / 2, fy + fw / 2, fw * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      // Schlange
      for (let i = snake.length - 1; i >= 0; i--) { const s = snake[i], [x, y] = cellRect(s.x, s.y); const t = 1 - i / snake.length; ctx.save(); if (i === 0) { ctx.shadowColor = skin.trail; ctx.shadowBlur = 14; } ctx.fillStyle = i === 0 ? skin.ball[0] : skin.ball[1]; ctx.globalAlpha = i === 0 ? 1 : 0.5 + t * 0.5; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 6); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = '#eef1ff'; ctx.textBaseline = 'top'; ctx.font = 'bold 18px "Segoe UI",system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.fillText('SCORE ' + score, 14, 12);
      ctx.textAlign = 'right'; ctx.fillStyle = skin.accent; ctx.fillText(wrap ? 'Wände: offen' : 'Wände: tödlich', W - 14, 14);
      if (state === 'over') { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#ff2f5e'; ctx.shadowColor = '#ff2f5e'; ctx.shadowBlur = 16; ctx.font = 'bold 38px "Segoe UI",system-ui,sans-serif'; ctx.fillText('GAME OVER', W / 2, H / 2 - 40); ctx.shadowBlur = 0; ctx.fillStyle = '#ffd233'; ctx.font = 'bold 24px "Segoe UI",system-ui,sans-serif'; ctx.fillText(score + ' Punkte', W / 2, H / 2 + 4); ctx.fillStyle = '#5aa0ff'; ctx.font = 'bold 18px "Segoe UI",system-ui,sans-serif'; if (Math.floor(Date.now() / 500) % 2 === 0) ctx.fillText('Tippen = nochmal', W / 2, H / 2 + 44); ctx.restore(); }
    }

    function kd(e) { const k = e.key.toLowerCase(); if (k === 'arrowup' || k === 'w') setDir(0, -1); else if (k === 'arrowdown' || k === 's') setDir(0, 1); else if (k === 'arrowleft' || k === 'a') setDir(-1, 0); else if (k === 'arrowright' || k === 'd') setDir(1, 0); else return; e.preventDefault(); }
    let sx = 0, sy = 0;
    function ts(e) { const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; }
    function te(e) { if (state === 'over') { reset(); return; } const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return; if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0); else setDir(0, dy > 0 ? 1 : -1); }
    function tap(e) { if (state === 'over') { reset(); } }

    function loop(now) { if (!running) return; const dt = Math.min((now - (loop.last || now)) / 1000, 0.05); loop.last = now; if (state === 'play') { acc += dt; while (acc >= stepT) { acc -= stepT; tick(); } } draw(); raf = requestAnimationFrame(loop); }
    function start() {
      host.fit(W, H); reset();
      host.addButton('◄', () => setDir(-1, 0), null, 'dpad'); host.addButton('▲', () => setDir(0, -1), null, 'dpad');
      host.addButton('▼', () => setDir(0, 1), null, 'dpad'); host.addButton('►', () => setDir(1, 0), null, 'dpad');
      window.addEventListener('keydown', kd);
      canvas.addEventListener('touchstart', ts, { passive: true }); canvas.addEventListener('touchend', te, { passive: true }); canvas.addEventListener('pointerdown', tap);
      running = true; loop.last = 0; raf = requestAnimationFrame(loop);
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); canvas.removeEventListener('touchstart', ts); canvas.removeEventListener('touchend', te); canvas.removeEventListener('pointerdown', tap); }
    return { start, stop };
  }
  window.NA.register('snake', { name: 'GRID SNAKE', tag: 'Der Klassiker · Wisch-Steuerung', emoji: '🟢', make: make });
})();
