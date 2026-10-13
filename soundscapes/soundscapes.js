/* Soundscapes: denyeh.com/soundscapes. No tracking, no third-party scripts.
   Track schema: see /soundscapes/README.md */
(function () {
  'use strict';
  var MAX = 3, DAY = 86400000;
  var USES = ['sleep','focus','calm','meditate','energy','nature','noise'];
  var SYS = { binaural: 'Binaural · headphones', stereo: 'Stereo', '5.1': '5.1 · download' };
  var NOISE = { pink: 'Pink noise', brown: 'Brown noise' };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var tracks = [], byId = {};
  var filters = { use: null, system: null, noMusic: false };
  var favs = load('ss-favs', []);
  var ctx = null, master = null;
  var mix = [];          // [{id, vol}]
  var live = {};         // id -> {gain, node|el}
  var playing = false, timerId = null, timerEnd = 0, tick = null;

  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function fmtLen(s) { s = +s || 0; var m = Math.round(s / 60); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60 ? m % 60 + ' min' : '') : m + ' min'; }
  function age(t) { var d = Date.parse(t.added + 'T00:00:00'); return isNaN(d) ? Infinity : (Date.now() - d) / DAY; }
  function label(id) { return NOISE[id] || (byId[id] && byId[id].title) || id; }
  function msg(t) { $('#mixMsg').textContent = t; }

  /* ---------- audio ---------- */
  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noiseBuffer(kind) {
    var len = ctx.sampleRate * 8, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        }
      }
    }
    return buf;
  }
  var bufCache = {};
  function startSource(item) {
    if (live[item.id]) return;
    var g = ctx.createGain(); g.gain.value = item.vol / 100; g.connect(master);
    var entry = { gain: g };
    if (NOISE[item.id]) {
      var src = ctx.createBufferSource();
      src.buffer = bufCache[item.id] || (bufCache[item.id] = noiseBuffer(item.id));
      src.loop = true; src.connect(g); src.start(); entry.node = src;
    } else {
      var t = byId[item.id]; if (!t) return;
      var el = new Audio(); el.crossOrigin = 'anonymous'; el.loop = true; el.preload = 'auto'; el.src = t.file;
      try { ctx.createMediaElementSource(el).connect(g); } catch (e) { el.volume = item.vol / 100; }
      el.addEventListener('error', function () { msg('Could not load "' + t.title + '".'); });
      var p = el.play(); if (p && p.catch) p.catch(function () {});
      entry.el = el;
    }
    live[item.id] = entry;
  }
  function stopSource(id) {
    var e = live[id]; if (!e) return;
    try { if (e.node) e.node.stop(); if (e.el) { e.el.pause(); e.el.removeAttribute('src'); e.el.load(); } e.gain.disconnect(); } catch (x) {}
    delete live[id];
  }
  function play() {
    if (!mix.length) return;
    ensureCtx();
    master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(1, ctx.currentTime);
    mix.forEach(startSource); playing = true; render();
  }
  function stopAll() { Object.keys(live).forEach(stopSource); playing = false; render(); }

  /* ---------- mix state ---------- */
  function persist() {
    save('ss-mix', mix);
    var q = mix.length ? '?mix=' + mix.map(function (m) { return encodeURIComponent(m.id) + ':' + m.vol; }).join(',') : location.pathname;
    try { history.replaceState(null, '', mix.length ? q : location.pathname); } catch (e) {}
  }
  function valid(id) { return !!(NOISE[id] || (byId[id] && byId[id].system !== '5.1')); }
  function addToMix(id, vol) {
    if (!valid(id)) return false;
    if (mix.some(function (m) { return m.id === id; })) { msg(label(id) + ' is already in the mix.'); return false; }
    if (mix.length >= MAX) { msg('The mix holds up to 3 sounds. Remove one first.'); return false; }
    mix.push({ id: id, vol: vol == null ? 60 : vol });
    if (playing) startSource(mix[mix.length - 1]);
    persist(); msg('Added ' + label(id) + '.'); openMixer(true); render(); return true;
  }
  function removeFromMix(id) {
    stopSource(id); mix = mix.filter(function (m) { return m.id !== id; });
    if (!mix.length) playing = false;
    persist(); render();
  }
  function solo(id) { stopAll(); mix = [{ id: id, vol: 70 }]; persist(); play(); }
  function parseMix(str) {
    var out = [];
    (str || '').split(',').forEach(function (p) {
      var i = p.lastIndexOf(':'), id = decodeURIComponent(i > 0 ? p.slice(0, i) : p), v = i > 0 ? parseInt(p.slice(i + 1), 10) : 60;
      if (isNaN(v)) v = 60; v = Math.max(0, Math.min(100, v));
      if (valid(id) && out.length < MAX && !out.some(function (m) { return m.id === id; })) out.push({ id: id, vol: v });
    });
    return out;
  }

  /* ---------- sleep timer ---------- */
  function setTimer(min) {
    clearTimeout(timerId); clearInterval(tick);
    $$('.timer .chip').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.min === min)); });
    if (!min) { $('#timerStatus').textContent = ''; return; }
    timerEnd = Date.now() + min * 60000;
    timerId = setTimeout(fadeOut, Math.max(0, min * 60000 - 30000));
    var upd = function () { var r = Math.max(0, Math.ceil((timerEnd - Date.now()) / 60000)); $('#timerStatus').textContent = r ? r + ' min left' : 'fading out'; };
    upd(); tick = setInterval(upd, 15000);
  }
  function fadeOut() {
    if (ctx && master) {
      var t = ctx.currentTime; master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0.0001, t + 30);
    }
    setTimeout(function () { stopAll(); setTimer(0); $('#timerStatus').textContent = 'Timer done'; }, 30000);
  }

  /* ---------- rendering ---------- */
  function match(t) {
    return (!filters.use || (t.use || []).indexOf(filters.use) > -1) &&
      (!filters.system || t.system === filters.system) && (!filters.noMusic || t.noMusic === true);
  }
  function card(t) {
    var isFav = favs.indexOf(t.id) > -1, isNew = age(t) <= 14, on = playing && !!live[t.id];
    var badges = (t.use || []).filter(function (u) { return USES.indexOf(u) > -1; }).map(function (u) { return '<span class="badge">' + esc(u) + '</span>'; }).join('');
    var playBtn = t.system === '5.1' ? '' :
      '<button type="button" class="btn" data-act="play" aria-pressed="' + on + '" aria-label="' + (on ? 'Pause ' : 'Play ') + esc(t.title) + '">' + (on ? 'Pause' : 'Play') + '</button>' +
      '<button type="button" class="btn" data-act="add" aria-label="Add ' + esc(t.title) + ' to mix">+ Add to mix</button>';
    return '<article class="card" data-id="' + esc(t.id) + '">' +
      (t.cover ? '<img src="' + esc(t.cover) + '" alt="" loading="lazy">' : '') +
      '<div class="card-body"><div class="card-top"><h3>' + esc(t.title) + '</h3>' +
      '<button type="button" class="icon" data-act="fav" aria-pressed="' + isFav + '" aria-label="Favorite ' + esc(t.title) + '">' + (isFav ? '★' : '☆') + '</button></div>' +
      '<p class="scene">' + esc(t.scene) + '</p>' +
      '<div class="badges">' + (isNew ? '<span class="badge new">New</span>' : '') + badges +
      '<span class="badge sys">' + esc(SYS[t.system] || t.system) + '</span><span class="badge">' + fmtLen(t.length) + '</span></div>' +
      '<div class="card-actions">' + playBtn +
      '<a class="btn" href="' + esc(t.file) + '" download aria-label="Download ' + esc(t.title) + '">Download</a></div>' +
      '<span class="ai">AI-generated</span></div></article>';
  }
  function render() {
    var list = tracks.filter(match);
    $('#grid').innerHTML = list.map(card).join('');
    $('#emptyState').hidden = tracks.length > 0;
    $('#noMatch').hidden = !tracks.length || list.length > 0;
    var fresh = tracks.filter(function (t) { return age(t) <= 7; });
    $('#newStrip').hidden = !fresh.length;
    $('#newList').innerHTML = fresh.map(card).join('');
    $('#mixCount').textContent = '(' + mix.length + '/3)' + (playing ? ' · playing' : '');
    $('#mixPlay').disabled = !mix.length;
    var ul = $('#mixList'), ids = mix.map(function (m) { return m.id; }).join('|');
    if (ul.dataset.ids !== ids) {
      ul.dataset.ids = ids;
      ul.innerHTML = mix.map(function (m, i) {
        return '<li><label for="vol' + i + '">' + esc(label(m.id)) + '</label>' +
          '<input type="range" id="vol' + i + '" min="0" max="100" value="' + m.vol + '" data-id="' + esc(m.id) + '" aria-label="Volume for ' + esc(label(m.id)) + '">' +
          '<button type="button" class="btn" data-remove="' + esc(m.id) + '" aria-label="Remove ' + esc(label(m.id)) + ' from mix">Remove</button></li>';
      }).join('') || '<li class="scene">Add up to three sounds: tracks, pink noise, brown noise.</li>';
    }
  }
  function openMixer(open) { $('#mixBody').hidden = !open; $('#mixToggle').setAttribute('aria-expanded', String(open)); }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var c = b.closest('.card'), id = c && c.dataset.id;
    if (b.dataset.act === 'play') { if (live[id] && playing) { mix.length === 1 ? stopAll() : removeFromMix(id); } else solo(id); }
    else if (b.dataset.act === 'add') addToMix(id);
    else if (b.dataset.act === 'fav') {
      var i = favs.indexOf(id); if (i > -1) favs.splice(i, 1); else favs.push(id); save('ss-favs', favs); render();
    }
    else if (b.dataset.use) { filters.use = filters.use === b.dataset.use ? null : b.dataset.use; $$('[data-use]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.use === filters.use)); }); render(); }
    else if (b.dataset.system) { filters.system = filters.system === b.dataset.system ? null : b.dataset.system; $$('[data-system]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.system === filters.system)); }); render(); }
    else if (b.id === 'noMusic') { filters.noMusic = !filters.noMusic; b.setAttribute('aria-pressed', String(filters.noMusic)); render(); }
    else if (b.dataset.min) { var m = +b.dataset.min; setTimer(b.getAttribute('aria-pressed') === 'true' ? 0 : m); }
    else if (b.dataset.addnoise) addToMix(b.dataset.addnoise);
    else if (b.dataset.remove) removeFromMix(b.dataset.remove);
    else if (b.id === 'mixToggle') openMixer($('#mixBody').hidden);
    else if (b.id === 'mixPlay') play();
    else if (b.id === 'mixStop') stopAll();
    else if (b.id === 'mixShare') {
      persist(); var url = location.href;
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { msg('Link copied.'); }, function () { msg(url); }); else msg(url);
    }
    else if (b.id === 'playCalm') {
      var pool = tracks.filter(function (t) { return t.system !== '5.1' && (t.use || []).some(function (u) { return u === 'calm' || u === 'sleep'; }); });
      solo(pool.length ? pool[Math.floor(Math.random() * pool.length)].id : 'brown');
      msg('Playing ' + label(mix[0].id) + '.');
    }
  });
  document.addEventListener('input', function (e) {
    var r = e.target; if (r.type !== 'range' || !r.dataset.id) return;
    var m = mix.filter(function (x) { return x.id === r.dataset.id; })[0]; if (!m) return;
    m.vol = +r.value; var l = live[m.id];
    if (l) { l.gain.gain.setTargetAtTime(m.vol / 100, ctx.currentTime, 0.05); if (l.el && !ctx) l.el.volume = m.vol / 100; }
    persist();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#mixBody').hidden) { openMixer(false); $('#mixToggle').focus(); } });

  /* ---------- init ---------- */
  fetch('/soundscapes/tracks.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (data) {
      tracks = (Array.isArray(data) ? data : []).filter(function (t) { return t && t.id && t.file; })
        .sort(function (a, b) { return String(b.added).localeCompare(String(a.added)); });
      tracks.forEach(function (t) { byId[t.id] = t; });
      var q = new URLSearchParams(location.search).get('mix');
      mix = q ? parseMix(q) : (load('ss-mix', []) || []).filter(function (m) { return m && valid(m.id); }).slice(0, MAX);
      if (q && mix.length) { openMixer(true); msg('Shared mix loaded. Press Play mix.'); }
      persist(); render();
    });
})();
