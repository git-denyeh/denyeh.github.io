/* DENYEH Recipes: client-side only. No network requests, no tracking. */
(function () {
  'use strict';
  var fold = function (s) {
    return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- index page ---------- */
  function initIndex() {
    var dataEl = document.getElementById('recipesData');
    if (!dataEl) return;
    var items = JSON.parse(dataEl.textContent);
    var cards = {};
    $$('#grid .card').forEach(function (c) { cards[c.getAttribute('data-slug')] = c; });
    var q = document.getElementById('q');
    var countEl = document.getElementById('count');
    var noMatch = document.getElementById('noMatch');
    var resetBtn = document.getElementById('reset');

    // progressive enhancement: swap static grouped list for the filterable grid
    $$('[data-js-only]').forEach(function (el) { el.hidden = false; });
    var fallback = document.getElementById('byCuisine');
    if (fallback) fallback.hidden = true;

    var SYN = {
      'scallion': ['green onion'], 'scallions': ['green onion'], 'spring onion': ['green onion'],
      'green onion': ['scallion'], 'garbanzo': ['chickpea'], 'garbanzos': ['chickpea'], 'chickpea': ['garbanzo'],
      'cilantro': ['coriander'], 'coriander': ['cilantro'], 'chile': ['chili'], 'chilli': ['chili'], 'chilies': ['chili'],
      'chili': ['chile', 'chilli'], 'aubergine': ['eggplant'], 'eggplant': ['aubergine'], 'courgette': ['zucchini'],
      'zucchini': ['courgette'], 'capsicum': ['bell pepper'], 'prawn': ['shrimp'], 'shrimp': ['prawn'],
      'yoghurt': ['yogurt'], 'yogurt': ['yoghurt'], 'noodle': ['noodles'],
      'pasta': ['spaghetti', 'linguine', 'bucatini', 'rigatoni', 'orzo', 'tonnarelli', 'pappardelle', 'tagliatelle'],
      'spaghetti': ['pasta'], 'beef': ['chuck'], 'mince': ['ground'], 'minced': ['ground'],
      'pork': ['pancetta', 'guanciale', 'bacon'], 'bacon': ['pancetta', 'guanciale'],
      'cheese': ['parmesan', 'pecorino', 'feta'], 'parmigiano': ['parmesan'], 'parmesan': ['parmigiano'],
      'levantine': ['lebanese', 'middle eastern'], 'middle eastern': ['lebanese', 'levantine'], 'lebanese': ['middle eastern'],
      'asian': ['thai', 'chinese'], 'italian': ['italy'], 'soup': ['tom kha', 'broth', 'simmer'],
      'salad': ['salata', 'som tam', 'larb', 'raw'], 'dip': ['hummus'], 'cream': ['heavy cream'],
      'vegetarian': ['vegan'], 'veggie': ['vegetarian', 'vegan'], 'quick': ['weeknight'], 'easy': ['weeknight'],
      'garlic sauce': ['toum'], 'ginger': ['galangal'], 'stock': ['broth'], 'broth': ['stock']
    };
    function alts(term) {
      var a = [term].concat(SYN[term] || []);
      if (term.length > 3 && /s$/.test(term)) a.push(term.replace(/e?s$/, ''));
      return a;
    }
    function terms(query) {
      var s = fold(query).replace(/[^\w\s'-]/g, ' ').trim();
      if (!s) return [];
      var out = [];
      Object.keys(SYN).forEach(function (k) {
        if (k.indexOf(' ') > 0 && s.indexOf(k) >= 0) { out.push(k); s = s.replace(k, ' '); }
      });
      return out.concat(s.split(/\s+/).filter(Boolean));
    }
    items.forEach(function (it) {
      it.hay = fold([it.title, it.subtitle, it.course, (it.cuisine || []).join(' '), it.protein, it.search_text].join(' '));
    });

    var ROWS = ['cuisine', 'course', 'protein', 'diet', 'time'];
    var state = { q: '', cuisine: '', course: '', protein: '', diet: '', time: '' };

    function matches(it) {
      var t = terms(state.q);
      for (var i = 0; i < t.length; i++) {
        var ok = alts(t[i]).some(function (a) { return it.hay.indexOf(a) >= 0; });
        if (!ok) return false;
      }
      if (state.cuisine && (it.cuisine || []).indexOf(state.cuisine) < 0) return false;
      if (state.course && it.course !== state.course) return false;
      if (state.protein && it.protein !== state.protein) return false;
      if (state.diet) {
        var d = it.diet || [];
        if (state.diet === 'Vegetarian') {
          if (!(d.indexOf('Vegetarian') >= 0 || d.indexOf('Vegan') >= 0 || it.protein === 'Vegetarian' || it.protein === 'Vegan')) return false;
        } else if (d.indexOf(state.diet) < 0) return false;
      }
      if (state.time === 'quick' && !(it.total_min && it.total_min <= 30)) return false;
      return true;
    }
    function render() {
      var shown = 0;
      items.forEach(function (it) {
        var ok = matches(it);
        if (cards[it.slug]) cards[it.slug].hidden = !ok;
        if (ok) shown++;
      });
      var any = state.q || ROWS.some(function (r) { return state[r]; });
      countEl.textContent = any ? shown + ' of ' + items.length + ' recipes' : items.length + ' recipes';
      noMatch.hidden = shown !== 0;
      resetBtn.hidden = !any;
      $$('.chip[data-row]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(state[b.getAttribute('data-row')] === b.getAttribute('data-value')));
      });
    }
    function writeHash() {
      var parts = [];
      ['q'].concat(ROWS).forEach(function (k) { if (state[k]) parts.push(k + '=' + encodeURIComponent(state[k])); });
      var h = parts.length ? '#' + parts.join('&') : '';
      if (location.hash !== h) history.replaceState(null, '', h || location.pathname + location.search);
    }
    function readHash() {
      ['q'].concat(ROWS).forEach(function (k) { state[k] = ''; });
      location.hash.replace(/^#/, '').split('&').forEach(function (p) {
        var kv = p.split('=');
        if (kv.length === 2 && kv[0] in state) {
          try { state[kv[0]] = decodeURIComponent(kv[1].replace(/\+/g, ' ')); } catch (e) { /* ignore bad hash */ }
        }
      });
      q.value = state.q;
    }
    var timer;
    q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.q = q.value.trim(); writeHash(); render(); }, 80);
    });
    document.getElementById('searchForm').addEventListener('submit', function (e) { e.preventDefault(); q.blur(); });
    $$('.chip[data-row]').forEach(function (b) {
      b.addEventListener('click', function () {
        var row = b.getAttribute('data-row'), v = b.getAttribute('data-value');
        state[row] = state[row] === v ? '' : v;
        writeHash(); render();
      });
    });
    resetBtn.addEventListener('click', function () {
      ['q'].concat(ROWS).forEach(function (k) { state[k] = ''; });
      q.value = ''; writeHash(); render(); q.focus();
    });
    window.addEventListener('hashchange', function () { readHash(); render(); });
    readHash(); render();
  }

  /* ---------- recipe page ---------- */
  var UNI = { '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8 };
  var NUM = '(\\d+\\s+\\d+\\/\\d+|\\d+\\s*[½¼¾⅓⅔⅛]|\\d+\\/\\d+|\\d+(?:\\.\\d+)?|[½¼¾⅓⅔⅛])';
  function parseNum(s) {
    s = s.trim();
    var m;
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
    if ((m = s.match(/^(\d+)\s*([½¼¾⅓⅔⅛])$/))) return +m[1] + UNI[m[2]];
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
    if (UNI[s]) return UNI[s];
    return parseFloat(s);
  }
  function fmt(n, orig) {
    if (/\./.test(orig)) return String(Math.round(n * 10) / 10);
    if (n >= 50) return String(Math.round(n / 5) * 5);
    if (n >= 10) return String(Math.round(n));
    var whole = Math.floor(n), frac = n - whole;
    var F = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, '']];
    var best = F[0];
    F.forEach(function (f) { if (Math.abs(frac - f[0]) < Math.abs(frac - best[0])) best = f; });
    if (best[0] === 1) { whole += 1; best = F[0]; }
    if (!whole) return best[1] || '0';
    return whole + best[1];
  }
  function scaleText(text, f) {
    if (f === 1) return text;
    var sc = function (s) { return fmt(parseNum(s) * f, s); };
    var out = text;
    var leadMatch = /^\d+\s*\(/.test(text);
    out = out.replace(new RegExp('^((?:about |~|≈|juice of |zest of )?)' + NUM + '((?:\\s*(?:[a-zA-Z]+\\.?\\s*)?[–-]\\s*)' + NUM + ')?', 'i'),
      function (all, pre, a, rng, b) {
        if (rng) return pre + sc(a) + rng.replace(b, sc(b));
        return pre + sc(a);
      });
    if (!leadMatch) {
      out = out.replace(new RegExp('\\(((?:about |~\\s?|≈\\s?)?)' + NUM + '((?:\\s*[–-]\\s*)' + NUM + ')?(?=\\s*[a-zA-Z])', 'g'),
        function (all, pre, a, rng, b) {
          return '(' + pre + sc(a) + (rng ? rng.replace(b, sc(b)) : '');
        });
    }
    return out;
  }
  function initRecipe() {
    var root = document.querySelector('[data-recipe]');
    if (!root) return;
    var slug = root.getAttribute('data-recipe');
    $$('[data-js-only]').forEach(function (el) { el.hidden = false; });

    // ingredient checkboxes (saved per recipe)
    var key = 'denyeh-recipes:' + slug;
    var boxes = $$('.ing input[type=checkbox]');
    var saved = [];
    try { saved = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { saved = []; }
    boxes.forEach(function (b, i) {
      b.checked = saved.indexOf(i) >= 0;
      b.addEventListener('change', function () {
        var on = [];
        boxes.forEach(function (x, j) { if (x.checked) on.push(j); });
        try { localStorage.setItem(key, JSON.stringify(on)); } catch (e) { /* storage blocked: fine */ }
      });
    });
    var clear = document.getElementById('clearChecks');
    if (clear) clear.addEventListener('click', function () {
      boxes.forEach(function (b) { b.checked = false; });
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    });

    // step highlighting
    $$('.steps > li').forEach(function (li) {
      var toggle = function () {
        var on = !li.classList.contains('active');
        $$('.steps > li').forEach(function (x) { x.classList.remove('active'); x.removeAttribute('aria-current'); });
        if (on) { li.classList.add('active'); li.setAttribute('aria-current', 'step'); }
      };
      li.addEventListener('click', toggle);
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });

    // servings scaler
    var qtys = $$('[data-orig]');
    var yieldEl = document.getElementById('yieldVal');
    var yieldOrig = yieldEl ? yieldEl.textContent : '';
    $$('.chip[data-scale]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = parseFloat(b.getAttribute('data-scale'));
        $$('.chip[data-scale]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        qtys.forEach(function (el) { el.textContent = scaleText(el.getAttribute('data-orig'), f); });
        if (yieldEl) yieldEl.textContent = f === 1 ? yieldOrig : yieldOrig + ' (×' + b.textContent.replace('×', '') + ')';
        var note = document.getElementById('scaleNote');
        if (note) note.hidden = f === 1;
      });
    });

    // cook mode: keep screen awake where supported
    var cookBtn = document.getElementById('cookBtn');
    var status = document.getElementById('toolStatus');
    var lock = null, cookOn = false;
    function requestLock() {
      if (!('wakeLock' in navigator)) {
        status.textContent = "This browser can't keep the screen awake. Big text still works.";
        return;
      }
      navigator.wakeLock.request('screen').then(function (l) {
        lock = l;
        status.textContent = 'Screen will stay on while this page is open.';
        l.addEventListener('release', function () { lock = null; });
      }).catch(function () {
        status.textContent = "Couldn't keep the screen awake (low battery or browser setting). Big text still works.";
      });
    }
    if (cookBtn) {
      cookBtn.addEventListener('click', function () {
        cookOn = !cookOn;
        cookBtn.setAttribute('aria-pressed', String(cookOn));
        document.body.classList.toggle('cook', cookOn);
        if (cookOn) requestLock();
        else { if (lock) lock.release(); lock = null; status.textContent = ''; }
      });
      document.addEventListener('visibilitychange', function () {
        if (cookOn && document.visibilityState === 'visible' && !lock) requestLock();
      });
    }
    var printBtn = document.getElementById('printBtn');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    initIndex();
    initRecipe();
  }
  if (typeof module !== 'undefined') module.exports = { scaleText: scaleText, fold: fold };
})();
