/* =============================================================
   NOVA ARCADE — Hub: Menü, Einstellungen, Skins, Bestenliste
   Spiele registrieren sich über window.NA.register(id, meta).
   ============================================================= */
window.NA = (function () {
  'use strict';

  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  const DIFF = {
    chill:  { name: 'Chill',    grav: 0.85, balls: 5, obSpeed: 0.8,  goalMul: 0.8,  flip: 1.05, bSpeed: 0.85 },
    normal: { name: 'Normal',   grav: 1.0,  balls: 3, obSpeed: 1.0,  goalMul: 1.0,  flip: 1.0,  bSpeed: 1.0 },
    hard:   { name: 'Hardcore', grav: 1.18, balls: 2, obSpeed: 1.3,  goalMul: 1.35, flip: 0.95, bSpeed: 1.25 }
  };
  const SKINS = {
    chrome: { name: 'Chrom',  ball: ['#ffffff', '#b9c6ff', '#6f86e8'], trail: '#8aa0ff', accent: '#5aa0ff' },
    ember:  { name: 'Lava',   ball: ['#fff2c2', '#ff9a3c', '#c4300f'], trail: '#ff8a3c', accent: '#ff7a3c' },
    toxic:  { name: 'Toxic',  ball: ['#f0ffd0', '#9bff3d', '#3a9e10'], trail: '#9bff3d', accent: '#9bff3d' },
    gold:   { name: 'Gold',   ball: ['#fff8d6', '#ffd84d', '#b58600'], trail: '#ffd84d', accent: '#ffd84d' },
    plasma: { name: 'Plasma', ball: ['#ffe3ff', '#ff6be0', '#7a1bd6'], trail: '#ff8ae8', accent: '#ff6be0' }
  };
  const DEFAULTS = { player: 'Spieler', difficulty: 'normal', skin: 'chrome' };
  let settings = Object.assign({}, DEFAULTS, LS.get('na_settings', {}));

  const games = {}, order = [];
  function register(id, meta) { games[id] = meta; order.push(id); }

  const lbKey = id => 'na_lb_' + id;
  function topScore(id) { const l = LS.get(lbKey(id), []); return l.length ? l[0].score : 0; }
  function addScore(id, score, extra) {
    if (!(score > 0)) return;
    const l = LS.get(lbKey(id), []);
    l.push({ name: settings.player || 'Spieler', score: Math.round(score), extra: extra || null, ts: Date.now() });
    l.sort((a, b) => b.score - a.score);
    LS.set(lbKey(id), l.slice(0, 10));
  }
  function save() { LS.set('na_settings', settings); }

  let el = {}, current = null, resizeH = null, scoreTab = null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

  function showView(name) { ['home', 'stage', 'scores', 'settings'].forEach(v => { el[v].hidden = v !== name; }); }

  function sizeCanvas(w, h) {
    const maxW = Math.min(window.innerWidth * 0.96, 560);
    const maxH = window.innerHeight * 0.64;
    const s = Math.min(maxW / w, maxH / h);
    el.gameCanvas.style.width = (w * s) + 'px';
    el.gameCanvas.style.height = (h * s) + 'px';
  }

  function makeHost() {
    const canvas = el.gameCanvas;
    return {
      canvas, ctx: canvas.getContext('2d'), controls: el.controls, settings, DIFF, SKINS,
      diff: () => DIFF[settings.difficulty] || DIFF.normal,
      skin: () => SKINS[settings.skin] || SKINS.chrome,
      fit(w, h) { canvas.width = w; canvas.height = h; sizeCanvas(w, h); },
      submitScore(score, extra) { addScore(current, score, extra); },
      addButton(label, onD, onU, cls) {
        const b = document.createElement('button'); b.className = 'ctl ' + (cls || ''); b.innerHTML = label;
        const d = e => { e.preventDefault(); onD && onD(); }, u = e => { e.preventDefault(); onU && onU(); };
        b.addEventListener('touchstart', d, { passive: false }); b.addEventListener('touchend', u, { passive: false });
        b.addEventListener('mousedown', d); b.addEventListener('mouseup', u); b.addEventListener('mouseleave', u);
        el.controls.appendChild(b); return b;
      },
      exit() { backToHome(); }
    };
  }

  function renderHome() {
    el.playerLine.textContent = '👤 ' + (settings.player || 'Spieler') + '  ·  ' + (DIFF[settings.difficulty] || DIFF.normal).name + '-Modus';
    el.gameGrid.innerHTML = '';
    order.forEach(id => {
      const g = games[id];
      const card = document.createElement('button'); card.className = 'card';
      card.innerHTML = '<div class="cardicon">' + g.emoji + '</div><div class="cardbody"><div class="cardname">' +
        esc(g.name) + '</div><div class="cardtag">' + esc(g.tag) + '</div><div class="cardbest">Beste: ' +
        topScore(id).toLocaleString('de-DE') + '</div></div><div class="cardgo">▶</div>';
      card.onclick = () => openGame(id);
      el.gameGrid.appendChild(card);
    });
  }

  function openGame(id) {
    current = id; const g = games[id];
    el.stageTitle.textContent = g.name; el.stageMeta.textContent = (DIFF[settings.difficulty] || DIFF.normal).name;
    el.controls.innerHTML = '';
    showView('stage');
    const host = makeHost();
    g._inst = g.make(host);
    resizeH = () => sizeCanvas(host.canvas.width, host.canvas.height);
    window.addEventListener('resize', resizeH);
    try { g._inst.start(); } catch (e) { console.error(e); }
  }
  function backToHome() {
    if (current) { const g = games[current]; try { g._inst && g._inst.stop(); } catch (e) {} g._inst = null; }
    if (resizeH) { window.removeEventListener('resize', resizeH); resizeH = null; }
    el.controls.innerHTML = ''; current = null;
    renderHome(); showView('home');
  }

  function renderScores() {
    el.scoreTabs.innerHTML = '';
    order.forEach(id => {
      const b = document.createElement('button'); b.className = 'tab' + (id === scoreTab ? ' on' : '');
      b.textContent = games[id].name; b.onclick = () => { scoreTab = id; renderScores(); };
      el.scoreTabs.appendChild(b);
    });
    const list = LS.get(lbKey(scoreTab), []);
    el.scoreList.innerHTML = list.length
      ? list.map((r, i) => '<div class="srow"><span class="srank">' + (i + 1) + '</span><span class="sname">' +
          esc(r.name) + '</span><span class="sscore">' + r.score.toLocaleString('de-DE') + '</span></div>').join('')
      : '<p class="empty">Noch keine Scores — leg los und trag dich ein!</p>';
  }

  function renderSettings() {
    el.nameInput.value = settings.player || '';
    el.diffRow.innerHTML = '';
    Object.keys(DIFF).forEach(k => {
      const b = document.createElement('button'); b.className = 'chip' + (k === settings.difficulty ? ' on' : ''); b.textContent = DIFF[k].name;
      b.onclick = () => { settings.difficulty = k; save(); renderSettings(); };
      el.diffRow.appendChild(b);
    });
    el.skinRow.innerHTML = '';
    Object.keys(SKINS).forEach(k => {
      const s = SKINS[k]; const b = document.createElement('button'); b.className = 'chip skinchip' + (k === settings.skin ? ' on' : '');
      b.innerHTML = '<span class="sw" style="background:radial-gradient(circle at 35% 35%,' + s.ball[0] + ',' + s.ball[2] + ')"></span>' + s.name;
      b.onclick = () => { settings.skin = k; save(); applyAccent(); renderSettings(); };
      el.skinRow.appendChild(b);
    });
  }
  function applyAccent() { const s = SKINS[settings.skin] || SKINS.chrome; document.documentElement.style.setProperty('--accent', s.accent); }

  function boot() {
    ['home', 'stage', 'scores', 'settings', 'gameGrid', 'playerLine', 'gameCanvas', 'controls',
     'stageTitle', 'stageMeta', 'scoreTabs', 'scoreList', 'nameInput', 'diffRow', 'skinRow'].forEach(id => el[id] = $(id));
    $('navScores').onclick = () => { scoreTab = scoreTab || order[0]; renderScores(); showView('scores'); };
    $('navSettings').onclick = () => { renderSettings(); showView('settings'); };
    $('backBtn').onclick = backToHome;
    document.querySelectorAll('[data-home]').forEach(b => b.onclick = () => { renderHome(); showView('home'); });
    el.nameInput.addEventListener('input', e => { settings.player = e.target.value.slice(0, 12); save(); });
    scoreTab = order[0]; applyAccent(); renderHome(); showView('home');
  }

  document.addEventListener('DOMContentLoaded', boot);
  return { register, addScore, DIFF, SKINS, getSettings: () => settings };
})();
