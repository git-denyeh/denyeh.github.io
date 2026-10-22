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

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c]; }); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function fmt(sec) { sec = Math.round(sec || 0); return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
  function shortTitle(t) { return String(t.title || '').split(',')[0]; }

  // Text links only. STORE_ORDER keeps Spotify and Amazon on this same line later.
  function storeLinks(links) {
    links = links || {};
    var parts = STORE_ORDER.filter(function (k) { return links[k]; }).map(function (k) {
      return '<a href="' + esc(links[k]) + '" target="_blank" rel="noopener">' + esc(STORES[k].name) + '</a>';
    });
    if (!parts.length) return '';
    return '<span class="listen-label">Listen on</span><span class="listen-links">' +
      parts.join('<span class="listen-sep" aria-hidden="true">·</span>') + '</span>';
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
  var SYSTEMS = ['binaural', 'stereo'];
  var SYS_LABEL = { binaural: 'Binaural', stereo: 'Stereo' };
  function slug(v) { return String(v).toLowerCase().replace(/[^a-z0-9.]+/g, '-'); }
  function readHash() {
    filters.use = null; filters.system = null;
    String(location.hash || '').replace(/^#/, '').split('+').forEach(function (p) {
      p = decodeURIComponent(p).toLowerCase();
      if (!p || p === 'all') return;
      // The 5.1 filter is gone. Old #5.1 links show every track.
      if (p === '5.1' || p === '5-1') return;
      if (SYSTEMS.indexOf(p) > -1 || document.querySelector('#sysChips .chip[data-v="' + p + '"]')) filters.system = p;
      else if (document.querySelector('#useChips .chip[data-v="' + p + '"]')) filters.use = p;
    });
  }
  function writeHash() {
    var parts = [filters.system, filters.use].filter(Boolean);
    var h = parts.length ? '#' + parts.join('+') : '';
    if (h !== (location.hash || '')) history.replaceState(null, '', h || location.pathname + location.search);
  }
  function syncChips() {
    [['useChips', 'use'], ['sysChips', 'system']].forEach(function (r) {
      $(r[0]).querySelectorAll('.chip').forEach(function (c) {
        var on = (c.dataset.v || null) === (filters[r[1]] || null);
        c.setAttribute('aria-pressed', String(on));
        c.classList.toggle('is-active', on);
      });
    });
  }
  function renderChips() {
    var uses = {};
    tracks.forEach(function (t) { (t.use || []).forEach(function (u) { uses[u.toLowerCase()] = 1; }); });
    function build(el, vals, key, labels) {
      ['' ].concat(vals).forEach(function (v) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip';
        b.textContent = v ? (labels && labels[v]) || cap(v) : 'All';
        b.dataset.v = v;
        b.setAttribute('aria-pressed', String(!v));
        if (v === 'binaural') b.title = 'Headphones required';
        b.addEventListener('click', function () {
          filters[key] = v || null;
          syncChips(); writeHash(); applyFilters();
        });
        el.appendChild(b);
      });
    }
    build($('sysChips'), SYSTEMS, 'system', SYS_LABEL);
    build($('useChips'), Object.keys(uses).sort(), 'use');
    window.addEventListener('hashchange', applyHash);
  }

  function applyFilters() {
    var shown = 0;
    document.querySelectorAll('.card').forEach(function (c) {
      var t = tracks[+c.dataset.i];
      var ok = (!filters.use || (t.use || []).map(function (u) { return u.toLowerCase(); }).indexOf(filters.use) > -1) &&
               (!filters.system || t.system === filters.system);
      c.hidden = !ok; if (ok) shown++;
    });
    var nm = $('noMatch');
    if (nm) {
      var what = [filters.system && (SYS_LABEL[filters.system] || cap(filters.system)), filters.use && cap(filters.use)].filter(Boolean).join(' + ');
      nm.textContent = 'No ' + (what ? what + ' ' : '') + 'soundscapes here yet. New ones are on the way; try All in the meantime.';
      nm.hidden = shown > 0 || !tracks.length;
    }
  }

  function trackSlugFromHash() {
    var raw = String(location.hash || '').replace(/^#/, '');
    try { raw = decodeURIComponent(raw); } catch (e) { return ''; }
    if (!raw || raw.indexOf('+') !== -1 || raw.toLowerCase().indexOf('track-') !== 0) return '';
    return raw.slice(6).toLowerCase();
  }
  function revealTrack() {
    var card = document.getElementById('track-' + trackSlugFromHash());
    if (!card) return;
    card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    card.classList.remove('linked');
    void card.offsetWidth;
    card.classList.add('linked');
    clearTimeout(revealTrack.timer);
    revealTrack.timer = setTimeout(function () { card.classList.remove('linked'); }, 2200);
  }
  function applyHash() {
    if (trackSlugFromHash()) {
      filters.use = null; filters.system = null;
      syncChips(); applyFilters(); revealTrack();
      return;
    }
    readHash(); syncChips(); applyFilters();
  }

  // ---------- Cards ----------
  var R = 29, CIRC = 2 * Math.PI * R;
  function renderCards() {
    var grid = $('grid');
    grid.innerHTML = tracks.map(function (t, i) {
      var bin = t.system === 'binaural';
      var len = t.previewLength ? fmt(t.previewLength) + ' preview' : '';
      var listen = storeLinks(t.links);
      return '<article class="card" id="track-' + esc(t.id) + '" data-i="' + i + '">' +
        '<div class="art"><img src="' + esc(t.cover) + '" alt="Cover art for ' + esc(shortTitle(t)) + '" loading="lazy" decoding="async" width="600" height="600">' +
        '<button type="button" class="pp" aria-label="Play preview of ' + esc(shortTitle(t)) + '">' +
        '<svg class="ring" viewBox="0 0 62 62" aria-hidden="true"><circle class="bg" cx="31" cy="31" r="' + R + '"/><circle class="fg" cx="31" cy="31" r="' + R + '" stroke-dasharray="' + CIRC + '" stroke-dashoffset="' + CIRC + '"/></svg>' +
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + ICON_PLAY + '</svg></button></div>' +
        '<h3>' + esc(t.title) + '</h3>' +
        '<p class="scene">' + esc(t.scene) + '</p>' +
        '<div class="badges">' + (t.use || []).map(function (u) { return '<span class="badge">' + esc(u) + '</span>'; }).join('') +
        '<span class="badge sys">' + esc(t.system) + '</span><span class="preview-len">' + len + '</span></div>' +
        (bin ? '<p class="phones"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1v-6h3zM3 19a2 2 0 002 2h1v-6H3z"/></svg>Use headphones for the binaural effect</p>' : '') +
        (listen ? '<div class="listen-on">' + listen + '</div>' : '') +
        '<button type="button" class="copy-link" data-id="' + esc(t.id) + '">Copy link</button></article>';
    }).join('');
    grid.querySelectorAll('.card').forEach(function (card) {
      card.querySelector('.pp').addEventListener('click', function () { toggle(tracks[+card.dataset.i], card); });
      var copy = card.querySelector('.copy-link');
      copy.addEventListener('click', function () {
        var url = new URL('/soundscapes/', location.origin);
        url.hash = 'track-' + copy.getAttribute('data-id');
        var done = function () {
          copy.textContent = 'Copied';
          setTimeout(function () { copy.textContent = 'Copy link'; }, 1400);
        };
        var write = navigator.clipboard && navigator.clipboard.writeText;
        (write ? navigator.clipboard.writeText(url.href) : Promise.reject()).then(done).catch(function () {
          var ta = document.createElement('textarea');
          ta.value = url.href; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-999px';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
          ta.remove();
        });
      });
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
      if (el && !t.previewLength && isFinite(a.duration)) el.textContent = fmt(a.duration) + ' preview';
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

  // ---------- Background layer (Web Audio) ----------
  // Pink/brown are generated live in an AudioWorklet (no short looped buffers);
  // rain is a decoded CC0 field recording looped gaplessly as an AudioBuffer.
  var RAIN_URL = '/soundscapes/audio/layer-rain.mp3?v=1';
  var RAMP = 0.03; // time constant for gain changes (~90ms to settle)
  var noise = { ctx: null, gain: null, master: null, nodes: [], type: null, vol: 0.25, worklet: null, rainBuf: null, rainLoading: null, gen: 0 };
  var WORKLET_SRC = [
    'class DenyehNoise extends AudioWorkletProcessor {',
    '  constructor(o){super();this.kind=(o.processorOptions||{}).kind||"pink";this.s=[];for(var c=0;c<2;c++)this.s.push({b0:0,b1:0,b2:0,b3:0,b4:0,b5:0,b6:0,last:0});}',
    '  process(inputs,outputs){var out=outputs[0];for(var c=0;c<out.length;c++){var d=out[c],s=this.s[c]||this.s[0];',
    '    for(var i=0;i<d.length;i++){var w=Math.random()*2-1;',
    '      if(this.kind==="brown"){s.last=(s.last+0.02*w)/1.02;d[i]=s.last*3.5;}',
    '      else{s.b0=0.99886*s.b0+w*0.0555179;s.b1=0.99332*s.b1+w*0.0750759;s.b2=0.969*s.b2+w*0.153852;',
    '        s.b3=0.8665*s.b3+w*0.3104856;s.b4=0.55*s.b4+w*0.5329522;s.b5=-0.7616*s.b5-w*0.016898;',
    '        d[i]=(s.b0+s.b1+s.b2+s.b3+s.b4+s.b5+s.b6+w*0.5362)*0.11;s.b6=w*0.115926;}}}return true;}',
    '}',
    'registerProcessor("denyeh-noise",DenyehNoise);'
  ].join('\n');
  function ensureCtx() {
    if (!noise.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      var ctx = noise.ctx = new AC();
      // layer gain -> master gain (0.85) -> limiter -> out, so summed layers can't clip
      noise.gain = ctx.createGain(); noise.gain.gain.value = 0;
      noise.master = ctx.createGain(); noise.master.gain.value = 0.85;
      var lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -6; lim.knee.value = 3; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.25;
      noise.gain.connect(noise.master); noise.master.connect(lim); lim.connect(ctx.destination);
      if (ctx.audioWorklet && window.Blob && window.URL) {
        var url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
        noise.worklet = ctx.audioWorklet.addModule(url).then(function () { return true; }, function () { return false; });
      } else noise.worklet = Promise.resolve(false);
    }
    if (noise.ctx.state === 'suspended') noise.ctx.resume();
    return noise.ctx;
  }
  // Fallback only: long (24s) buffers, started at a random offset.
  function noiseBuffer(ctx, kind) {
    var len = ctx.sampleRate * 24, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (var i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        }
      }
      // smooth the loop seam: short equal-power blend of the tail into the head
      var m = 0, q = 0, j;
      for (j = 0; j < len; j++) m += d[j];
      m /= len;
      for (j = 0; j < len; j++) { d[j] -= m; q += d[j] * d[j]; }
      var k0 = 0.2 / Math.sqrt(q / len); // fixed RMS, matches the worklet output
      for (j = 0; j < len; j++) d[j] *= k0;
      var x = Math.floor(ctx.sampleRate * 0.05);
      for (var k = 0; k < x; k++) { var t = k / x; d[k] = d[k] * Math.sin(t * Math.PI / 2) + d[len - x + k] * Math.cos(t * Math.PI / 2); }
    }
    return buf;
  }
  function loadRain(ctx) {
    if (noise.rainBuf) return Promise.resolve(noise.rainBuf);
    if (!noise.rainLoading) {
      noise.rainLoading = fetch(RAIN_URL).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }); })
        .then(function (b) { noise.rainBuf = b; return b; }, function (e) { noise.rainLoading = null; throw e; });
    }
    return noise.rainLoading;
  }
  function stopNoiseNodes() {
    noise.nodes.forEach(function (n) { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
    noise.nodes = [];
  }
  function rampLayer(target, tc) {
    var g = noise.gain.gain, now = noise.ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.setTargetAtTime(target, now, tc || RAMP);
  }
  function fadeLayerOut(sec) {
    var g = noise.gain.gain, now = noise.ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + sec);
  }
  // Per-layer trim so every layer sits at about the same RMS (~0.08), plus a 20Hz highpass.
  var TRIM = { pink: 0.4, brown: 0.4, rain: 1.1 };
  function layerIn(ctx, type, nodes) {
    var trim = ctx.createGain(); trim.gain.value = TRIM[type] || 0.4;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 20; hp.Q.value = 0.7;
    trim.connect(hp); hp.connect(noise.gain);
    nodes.push(trim, hp);
    return trim;
  }
  function startNoise(type) {
    var ctx = ensureCtx(), gen = ++noise.gen;
    fadeLayerOut(0.3);
    var go = function (build) {
      if (gen !== noise.gen) return;
      stopNoiseNodes();
      build();
      var fadeIn = reduced ? 0.1 : (type === 'rain' ? 2 : 1);
      var g = noise.gain.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now); g.setValueAtTime(0, now); g.linearRampToValueAtTime(noise.vol * masterVol, now + fadeIn);
    };
    var delay = new Promise(function (r) { setTimeout(r, 320); });
    if (type === 'rain') {
      Promise.all([loadRain(ctx), delay]).then(function (r) {
        go(function () {
          var src = ctx.createBufferSource(); src.buffer = r[0]; src.loop = true;
          src.connect(layerIn(ctx, 'rain', noise.nodes)); src.start(0, Math.random() * r[0].duration * 0.9);
          noise.nodes.push(src);
        });
      }).catch(function () { if (gen === noise.gen && noise.type === 'rain') setNoise('rain'); });
      return;
    }
    Promise.all([noise.worklet, delay]).then(function (r) {
      go(function () {
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.value = type === 'brown' ? 650 : 7000; lp.Q.value = 0.5;
        var src;
        if (r[0]) {
          src = new AudioWorkletNode(ctx, 'denyeh-noise', { numberOfInputs: 0, outputChannelCount: [2], processorOptions: { kind: type } });
          src.connect(lp);
        } else {
          src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, type); src.loop = true;
          src.connect(lp); src.start(0, Math.random() * src.buffer.duration);
        }
        lp.connect(layerIn(ctx, type, noise.nodes));
        noise.nodes.push(src, lp);
      });
    });
  }
  function setNoise(type) {
    if (noise.type === type) type = null;
    noise.type = type;
    document.querySelectorAll('[data-noise]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.noise === type)); });
    if (current) current.audio.loop = type !== null;
    if (type) startNoise(type);
    else if (noise.ctx) {
      noise.gen++;
      fadeLayerOut(0.3);
      setTimeout(function () { if (!noise.type) stopNoiseNodes(); }, 350);
    }
    updateMini();
  }
  document.querySelectorAll('[data-noise]').forEach(function (b) {
    b.addEventListener('click', function () { setNoise(b.dataset.noise); });
  });
  $('noiseVol').addEventListener('input', function () {
    noise.vol = this.value / 100;
    if (noise.ctx && noise.type) rampLayer(noise.vol * masterVol);
  });

  // ---------- Sleep timer ----------
  var sleep = { end: 0, tick: null, min: 0 };
  function applyMaster() {
    if (current && !current.audio._fade) current.audio.volume = masterVol;
    if (noise.ctx && noise.type) rampLayer(noise.vol * masterVol, 0.1);
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
        if (left <= 45 && left > 0) { masterVol = left / 45; applyMaster(); }
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
  fetch('/soundscapes/tracks.json?v=2', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
    tracks = (Array.isArray(data) ? data : []).filter(function (t) { return t && t.file; });
    tracks.forEach(function (t, i) { t.system = String(t.system || '').toLowerCase(); t.links = t.links || {}; t._i = i; });
    tracks.sort(function (a, b) {
      return String(b.added).localeCompare(String(a.added)) || (a._i - b._i);
    });
    if (!tracks.length) { $('emptyState').hidden = false; return; }
    renderChips(); renderCards(); applyHash();
    $('heroPlay').disabled = false;
  }).catch(function () { $('emptyState').hidden = false; });
})();
