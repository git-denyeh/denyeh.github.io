(function () {
  'use strict';

  // Artist follow links. Empty URLs are hidden.
  var ARTIST_LINKS = { spotify: '', apple: '', youtubeMusic: '', amazon: '' };

  var STORES = {
    spotify: { name: 'Spotify', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.6 14.4a.6.6 0 01-.9.2c-2.4-1.5-5.4-1.8-8.9-1a.6.6 0 11-.3-1.2c3.9-.9 7.2-.5 9.9 1.1.3.2.4.6.2.9zm1.2-2.7a.8.8 0 01-1 .3c-2.7-1.7-6.9-2.2-10.2-1.2a.8.8 0 11-.4-1.5c3.7-1.1 8.4-.6 11.4 1.3.4.2.5.7.2 1.1zm.1-2.8C14.7 9 9.4 8.8 6.3 9.7a.9.9 0 11-.5-1.8c3.5-1.1 9.4-.9 13.1 1.3a.9.9 0 01-1 1.7z"/></svg>' },
    apple: { name: 'Apple Music', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3v12.5a3 3 0 11-2-2.8V7.2L9 8.9v8.6a3 3 0 11-2-2.8V5.5z"/></svg>' },
    youtubeMusic: { name: 'YouTube Music', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM10 9v6l5-3z"/></svg>' },
    amazon: { name: 'Amazon Music', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15.5c4.8 3 11.6 3.6 17 .5l.8 1c-5.8 3.6-13.2 3-18.4-.6zM18 14l3-.4.2 3-1-.1-.1-1.4-2 .3z"/></svg>' }
  };
  var STORE_ORDER = ['spotify', 'apple', 'youtubeMusic', 'amazon'];
  var ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
  var ICON_PAUSE = '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>';
  var FADE = 0.6; // crossfade seconds
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (id) { return document.getElementById(id); };
  var tracks = [];
  var filters = { use: null, system: null };
  var current = null; // { track, audio, card }
  var masterVol = 1; // sleep-timer fade multiplier

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fmt(sec) { sec = Math.round(sec || 0); return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
  function shortTitle(t) { return String(t.title || '').split(',')[0]; }

  function storeLinks(links, cls) {
    links = links || {};
    var html = STORE_ORDER.filter(function (k) { return links[k]; }).map(function (k) {
      return '<a class="store ' + (cls || '') + '" href="' + esc(links[k]) + '" target="_blank" rel="noopener" aria-label="Listen in full on ' + STORES[k].name + '" title="' + STORES[k].name + '">' + STORES[k].icon + '</a>';
    }).join('');
    return html ? '<span class="label">Listen in full</span>' + html : '<span class="soon">Coming soon to streaming</span>';
  }

  // ---------- Follow buttons ----------
  function renderFollow() {
    var keys = STORE_ORDER.filter(function (k) { return ARTIST_LINKS[k]; });
    var el = $('follow');
    if (!keys.length) { el.hidden = true; return; }
    el.innerHTML = keys.map(function (k) {
      return '<a class="store" href="' + esc(ARTIST_LINKS[k]) + '" target="_blank" rel="noopener">' + STORES[k].icon + 'Follow on ' + STORES[k].name + '</a>';
    }).join('');
    el.hidden = false;
  }

  // ---------- Filters ----------
  function renderChips() {
    var uses = {}, systems = {};
    tracks.forEach(function (t) { (t.use || []).forEach(function (u) { uses[u.toLowerCase()] = 1; }); if (t.system) systems[t.system] = 1; });
    function build(el, vals, key) {
      Object.keys(vals).sort().forEach(function (v) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.textContent = cap(v);
        b.setAttribute('aria-pressed', 'false');
        if (v === 'binaural') b.title = 'Headphones required';
        b.addEventListener('click', function () {
          filters[key] = filters[key] === v ? null : v;
          el.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === b && filters[key] === v)); });
          applyFilters();
        });
        el.appendChild(b);
      });
    }
    build($('useChips'), uses, 'use');
    build($('sysChips'), systems, 'system');
  }

  function applyFilters() {
    var shown = 0;
    document.querySelectorAll('.card').forEach(function (c) {
      var t = tracks[+c.dataset.i];
      var ok = (!filters.use || (t.use || []).map(function (u) { return u.toLowerCase(); }).indexOf(filters.use) > -1) &&
               (!filters.system || t.system === filters.system);
      c.hidden = !ok; if (ok) shown++;
    });
    $('noMatch').hidden = shown > 0 || !tracks.length;
  }

  // ---------- Cards ----------
  var R = 29, CIRC = 2 * Math.PI * R;
  function renderCards() {
    var grid = $('grid');
    grid.innerHTML = tracks.map(function (t, i) {
      var bin = t.system === 'binaural';
      var len = t.previewLength ? fmt(t.previewLength) + ' preview' : '';
      return '<article class="card" data-i="' + i + '">' +
        '<div class="art"><img src="' + esc(t.cover) + '" alt="Cover art for ' + esc(shortTitle(t)) + '" loading="lazy" decoding="async" width="600" height="600">' +
        '<button type="button" class="pp" aria-label="Play preview of ' + esc(shortTitle(t)) + '">' +
        '<svg class="ring" viewBox="0 0 62 62" aria-hidden="true"><circle class="bg" cx="31" cy="31" r="' + R + '"/><circle class="fg" cx="31" cy="31" r="' + R + '" stroke-dasharray="' + CIRC + '" stroke-dashoffset="' + CIRC + '"/></svg>' +
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + ICON_PLAY + '</svg></button></div>' +
        '<h3>' + esc(t.title) + '</h3>' +
        '<p class="scene">' + esc(t.scene) + '</p>' +
        '<div class="badges">' + (t.use || []).map(function (u) { return '<span class="badge">' + esc(u) + '</span>'; }).join('') +
        '<span class="badge sys">' + esc(t.system) + '</span><span class="preview-len">' + len + '</span></div>' +
        (bin ? '<p class="phones"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1v-6h3zM3 19a2 2 0 002 2h1v-6H3z"/></svg>Use headphones for the binaural effect</p>' : '') +
        '<div class="listen">' + storeLinks(t.links) + '</div></article>';
    }).join('');
    grid.querySelectorAll('.card').forEach(function (card) {
      card.querySelector('.pp').addEventListener('click', function () { toggle(tracks[+card.dataset.i], card); });
    });
  }

  function setCardState(card, playing) {
    if (!card) return;
    card.classList.toggle('playing', playing);
    var b = card.querySelector('.pp');
    b.querySelector('.icon').innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    var t = tracks[+card.dataset.i];
    b.setAttribute('aria-label', (playing ? 'Pause' : 'Play') + ' preview of ' + shortTitle(t));
  }
  function setRing(card, frac) {
    if (!card) return;
    card.querySelector('.ring .fg').setAttribute('stroke-dashoffset', String(CIRC * (1 - Math.max(0, Math.min(1, frac)))));
  }

  // ---------- Playback ----------
  function fadeAudio(a, to, secs, done) {
    if (reduced || secs <= 0) { a.volume = to; if (done) done(); return; }
    var from = a.volume, start = performance.now();
    if (a._fade) cancelAnimationFrame(a._fade);
    (function step(now) {
      var p = Math.min(1, (now - start) / (secs * 1000));
      a.volume = Math.max(0, Math.min(1, from + (to - from) * p));
      if (p < 1) a._fade = requestAnimationFrame(step); else { a._fade = null; if (done) done(); }
    })(start);
  }

  function makeAudio(t, card) {
    var a = new Audio();
    a.preload = 'none';
    a.src = t.file;
    a.loop = noise.type !== null;
    a.volume = 0;
    a.addEventListener('loadedmetadata', function () {
      var el = card && card.querySelector('.preview-len');
      if (el && isFinite(a.duration)) el.textContent = fmt(a.duration) + ' preview';
    });
    a.addEventListener('timeupdate', function () { if (a.duration) setRing(card, a.currentTime / a.duration); });
    a.addEventListener('ended', function () { if (current && current.audio === a) { setCardState(card, false); setRing(card, 0); updateMini(); } });
    return a;
  }

  function play(t, card) {
    var prev = current;
    if (prev && prev.track === t) { // resume
      prev.audio.play().then(function () { fadeAudio(prev.audio, masterVol, FADE); }).catch(function () {});
      setCardState(card, true); updateMini(); return;
    }
    if (prev) {
      var pa = prev.audio, pc = prev.card;
      setCardState(pc, false);
      fadeAudio(pa, 0, FADE, function () { pa.pause(); setRing(pc, 0); pa.removeAttribute('src'); pa.load(); });
    }
    var a = makeAudio(t, card);
    current = { track: t, audio: a, card: card };
    setCardState(card, true);
    a.play().then(function () { fadeAudio(a, masterVol, FADE); }).catch(function () { setCardState(card, false); updateMini(); });
    updateMini();
  }
  function pause() {
    if (!current) return;
    var a = current.audio;
    setCardState(current.card, false);
    fadeAudio(a, 0, 0.25, function () { a.pause(); updateMini(); });
    updateMini();
  }
  function isPlaying() { return current && !current.audio.paused && current.card.classList.contains('playing'); }
  function toggle(t, card) { if (current && current.track === t && isPlaying()) pause(); else play(t, card); }

  // ---------- Background noise (Web Audio) ----------
  var noise = { ctx: null, gain: null, nodes: [], type: null, vol: 0.4, timer: null };
  function ensureCtx() {
    if (!noise.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      noise.ctx = new AC();
      noise.gain = noise.ctx.createGain();
      noise.gain.gain.value = 0;
      noise.gain.connect(noise.ctx.destination);
    }
    if (noise.ctx.state === 'suspended') noise.ctx.resume();
    return noise.ctx;
  }
  function noiseBuffer(ctx, kind) {
    var len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (var i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else d[i] = w * 0.5;
      }
    }
    return buf;
  }
  function stopNoiseNodes() {
    noise.nodes.forEach(function (n) { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
    noise.nodes = [];
    if (noise.timer) { clearTimeout(noise.timer); noise.timer = null; }
  }
  function startNoise(type) {
    var ctx = ensureCtx();
    stopNoiseNodes();
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, type === 'rain' ? 'white' : type);
    src.loop = true;
    if (type === 'rain') {
      // Bed: band-limited noise. Droplets: random gain bumps on a brighter band.
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
      var bed = ctx.createGain(); bed.gain.value = 0.55;
      src.connect(bp); bp.connect(lp); lp.connect(bed); bed.connect(noise.gain);
      var src2 = ctx.createBufferSource(); src2.buffer = src.buffer; src2.loop = true;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      var drops = ctx.createGain(); drops.gain.value = 0;
      src2.connect(hp); hp.connect(drops); drops.connect(noise.gain);
      src2.start();
      noise.nodes.push(bp, lp, bed, src2, hp, drops);
      (function drip() {
        var now = ctx.currentTime, amp = 0.15 + Math.random() * 0.5;
        drops.gain.cancelScheduledValues(now);
        drops.gain.setValueAtTime(drops.gain.value, now);
        drops.gain.linearRampToValueAtTime(amp, now + 0.004);
        drops.gain.exponentialRampToValueAtTime(0.0001, now + 0.04 + Math.random() * 0.08);
        bp.frequency.setTargetAtTime(1100 + Math.random() * 700, now, 0.5);
        noise.timer = setTimeout(drip, 25 + Math.random() * 180);
      })();
    } else {
      src.connect(noise.gain);
    }
    src.start();
    noise.nodes.push(src);
    var g = noise.gain.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(noise.vol * masterVol, now + (reduced ? 0.05 : 1));
  }
  function setNoise(type) {
    if (noise.type === type) type = null;
    noise.type = type;
    document.querySelectorAll('[data-noise]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.noise === type)); });
    if (current) current.audio.loop = type !== null;
    if (type) startNoise(type);
    else if (noise.ctx) {
      var g = noise.gain.gain, now = noise.ctx.currentTime;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + 0.4);
      setTimeout(function () { if (!noise.type) stopNoiseNodes(); }, 450);
    }
    updateMini();
  }
  document.querySelectorAll('[data-noise]').forEach(function (b) {
    b.addEventListener('click', function () { setNoise(b.dataset.noise); });
  });
  $('noiseVol').addEventListener('input', function () {
    noise.vol = this.value / 100;
    if (noise.ctx && noise.type) noise.gain.gain.setTargetAtTime(noise.vol * masterVol, noise.ctx.currentTime, 0.05);
  });

  // ---------- Sleep timer ----------
  var sleep = { end: 0, tick: null, min: 0 };
  function applyMaster() {
    if (current && !current.audio._fade) current.audio.volume = masterVol;
    if (noise.ctx && noise.type) noise.gain.gain.setTargetAtTime(noise.vol * masterVol, noise.ctx.currentTime, 0.1);
  }
  function clearSleep() {
    clearInterval(sleep.tick); sleep.tick = null; sleep.end = 0; sleep.min = 0;
    document.querySelectorAll('[data-min]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    $('timerStatus').textContent = '';
    if (masterVol !== 1) { masterVol = 1; applyMaster(); }
  }
  document.querySelectorAll('[data-min]').forEach(function (b) {
    b.addEventListener('click', function () {
      var m = +b.dataset.min;
      if (sleep.min === m) { clearSleep(); return; }
      clearSleep();
      sleep.min = m; sleep.end = Date.now() + m * 60000;
      b.setAttribute('aria-pressed', 'true');
      sleep.tick = setInterval(function () {
        var left = (sleep.end - Date.now()) / 1000;
        $('timerStatus').textContent = left > 0 ? 'Stops in ' + fmt(Math.max(0, left)) : '';
        if (left <= 30 && left > 0) { masterVol = left / 30; applyMaster(); }
        if (left <= 0) {
          masterVol = 0; applyMaster();
          if (current) { setCardState(current.card, false); current.audio.pause(); }
          if (noise.type) setNoise(noise.type);
          clearSleep(); updateMini();
        }
      }, 500);
      $('timerStatus').textContent = 'Stops in ' + m + ':00';
    });
  });

  // ---------- Mini player ----------
  function updateMini() {
    var mini = $('mini');
    var playing = isPlaying();
    if (!current && !noise.type) { mini.hidden = true; return; }
    mini.hidden = false;
    var t = current && current.track;
    $('miniCover').src = t ? t.cover : '';
    $('miniCover').alt = '';
    $('miniTitle').textContent = t ? shortTitle(t) : 'Background layer';
    $('miniLayer').textContent = noise.type ? 'Background: ' + cap(noise.type) + (t ? ' · looping' : '') : 'Background off';
    $('miniPlay').querySelector('svg').innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    $('miniPlay').setAttribute('aria-label', playing ? 'Pause preview' : 'Play preview');
    $('miniPlay').disabled = !t;
    $('miniLinks').innerHTML = t ? storeLinks(t.links) : '';
    var hl = $('heroLabel');
    if (hl && tracks.length) hl.textContent = playing && current.track === tracks[0] ? 'Pause preview' : 'Listen to a preview';
  }
  $('miniPlay').addEventListener('click', function () { if (current) toggle(current.track, current.card); });

  // ---------- Hero ----------
  $('heroPlay').addEventListener('click', function () {
    if (!tracks.length) return;
    var card = document.querySelector('.card[data-i="0"]');
    toggle(tracks[0], card);
  });

  // ---------- Load ----------
  renderFollow();
  fetch('/soundscapes/tracks.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
    tracks = (Array.isArray(data) ? data : []).filter(function (t) { return t && t.file; });
    tracks.forEach(function (t) { t.system = String(t.system || '').toLowerCase(); t.links = t.links || {}; });
    tracks.sort(function (a, b) { return String(b.added).localeCompare(String(a.added)); });
    if (!tracks.length) { $('emptyState').hidden = false; return; }
    renderChips(); renderCards(); applyFilters();
    $('heroPlay').disabled = false;
  }).catch(function () { $('emptyState').hidden = false; });
})();
