/* Helpers, storage, themes, remote keys, spatial navigation. */
(function () {
  L.keys = {
    ENTER: 13, BACK: 461, ESC: 27, BACKSPACE: 8, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
    CH_UP: 33, CH_DOWN: 34, PLAY: 415, PAUSE: 19, STOP: 413, INFO: 457, IME_DONE: 65376
  };
  L.store = {
    get: function (k, d) { try { var v = localStorage.getItem('lumen.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('lumen.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem('lumen.' + k); } catch (e) {} }
  };
  L.$ = function (id) { return document.getElementById(id); };
  L.el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  };
  L.icon = function (id) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ico');
    var u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#' + id);
    s.appendChild(u); return s;
  };
  L.setIcon = function (holder, id) { var u = holder.querySelector('use'); if (u) u.setAttribute('href', '#' + id); };
  L.toast = function (msg, ms) {
    var t = L.$('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(L._tt); L._tt = setTimeout(function () { t.classList.remove('show'); }, ms || 2400);
  };
  L.clock = function () {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    return h + ':' + (m < 10 ? '0' : '') + m;
  };
  L.tint = function (s) {
    var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return 'hsl(' + h + ',38%,36%)';
  };
  L.initials = function (s) {
    var w = (s || '?').replace(/[^\w\s؀-ۿ]/g, ' ').trim().split(/\s+/);
    return ((w[0] || '?').charAt(0) + (w[1] ? w[1].charAt(0) : (w[0] || '').charAt(1) || '')).toUpperCase();
  };
  L.logo = function (ch, cls) {
    var box = L.el('div', cls || 'logo');
    box.style.setProperty('--t', L.tint(ch.name));
    box.appendChild(L.el('span', 'mono', L.initials(ch.name)));
    if (ch.logo) {
      var img = new Image(); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      img.onload = function () { box.classList.add('has-img'); };
      img.onerror = function () { if (img.parentNode) img.parentNode.removeChild(img); };
      img.src = ch.logo; box.appendChild(img);
    }
    return box;
  };
  // pick an icon for a group by its name (falls back to null → monogram)
  var GI = [
    [/news|خبر|noticias|nachrichten|info/i, 'g-news'], [/sport|ورزش|football|soccer|futbol|nba|nfl|racing|golf|tennis/i, 'g-sport'],
    [/movie|film|cinema|فیلم|سینما|vod/i, 'g-film'], [/series|show|drama|سریال/i, 'g-series'],
    [/kid|child|cartoon|anim|کودک|junior|family/i, 'g-kids'], [/music|موسیقی|mtv|hits|radio fm/i, 'g-music'],
    [/doc|discovery|nature|science|history|مستند|geo/i, 'g-doc'], [/radio/i, 'g-radio'],
    [/entertain|general|variety|سرگرمی|life/i, 'g-star'], [/\b(us|uk|ca|fr|de|it|es|tr|ir|ar|in|pk|world|intl|international)\b|iran|canada|usa|arab|persian|turk|latino/i, 'g-globe']
  ];
  L.groupIcon = function (name) { for (var i = 0; i < GI.length; i++) if (GI[i][0].test(name || '')) return GI[i][1]; return null; };

  /* ---------- themes ---------- */
  L.themes = [
    { id: 'midnight', name: 'Midnight', desc: 'Calm, deep and simple' },
    { id: 'aurora', name: 'Aurora', desc: 'Northern-light gradients' },
    { id: 'sunset', name: 'Sunset', desc: 'Warm amber and rose' },
    { id: 'ocean', name: 'Ocean', desc: 'Blue glass with soft waves' },
    { id: 'carbon', name: 'Carbon', desc: 'Dotted grid pattern' },
    { id: 'neon', name: 'Neon Lines', desc: 'Diagonal line pattern' },
    { id: 'graphite', name: 'Graphite', desc: 'Neutral greys, no fuss' },
    { id: 'nordic', name: 'Nordic', desc: 'Cool frost blues' },
    { id: 'forest', name: 'Forest', desc: 'Deep green calm' },
    { id: 'rose', name: 'Rosé', desc: 'Soft pink glow' },
    { id: 'mocha', name: 'Mocha', desc: 'Warm coffee tones' },
    { id: 'cyber', name: 'Cyber Grid', desc: 'Cyan grid pattern' },
    { id: 'paper', name: 'Daylight', desc: 'Light, clean and airy' },
    { id: 'lavender', name: 'Lavender', desc: 'Light with violet accents' },
    { id: 'mint', name: 'Mint', desc: 'Light and fresh green' }
  ];
  L.applyTheme = function (id) {
    document.documentElement.setAttribute('data-theme', id);
    L.store.set('theme', id);
  };
  L.applyTheme(L.store.get('theme', 'midnight'));

  /* ---------- spatial navigation ---------- */
  var K = L.keys;
  var nav = L.nav = { cur: null, scopes: [], handlers: [] };
  function visible(el) { return el.offsetWidth > 0 && el.offsetHeight > 0; }
  function root() { return nav.scopes.length ? nav.scopes[nav.scopes.length - 1] : L.$('app'); }
  nav.root = root;
  nav.pushScope = function (el) { nav.scopes.push(el); };
  nav.popScope = function (el) { var i = nav.scopes.lastIndexOf(el); if (i >= 0) nav.scopes.splice(i, 1); else nav.scopes.pop(); };
  nav.focus = function (el, noScroll, byPointer) {
    if (!el) return;
    nav.byPointer = !!byPointer;
    if (nav.cur && nav.cur !== el) nav.cur.classList.remove('focus');
    nav.cur = el; el.classList.add('focus');
    if (el.tagName === 'INPUT') { try { el.focus(); } catch (e) {} }
    else if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    if (!noScroll) nav.ensureVisible(el);
    if (el.onfocused) el.onfocused(el);
    if (nav.onFocusChange) nav.onFocusChange(el);
    nav.byPointer = false;
  };
  nav.focusFirst = function (container) {
    var c = (container || root()).querySelectorAll('.f');
    for (var i = 0; i < c.length; i++) if (visible(c[i])) { nav.focus(c[i]); return c[i]; }
    return null;
  };
  nav.ensureVisible = function (el) {
    var p = el.parentNode;
    while (p && p !== document.body) {
      if (p.classList && p.classList.contains('scroll')) {
        var pr = p.getBoundingClientRect(), r = el.getBoundingClientRect();
        var mv = p.hasAttribute('data-mv') ? Number(p.getAttribute('data-mv')) : 120;
        if (r.bottom > pr.bottom - mv) p.scrollTop += r.bottom - (pr.bottom - mv);
        else if (r.top < pr.top + mv) p.scrollTop -= (pr.top + mv) - r.top;
      }
      if (p.classList && p.classList.contains('hscroll')) {
        var hr = p.getBoundingClientRect(), er = el.getBoundingClientRect(), mh = 90;
        if (er.right > hr.right - mh) p.scrollLeft += er.right - (hr.right - mh);
        else if (er.left < hr.left + mh) p.scrollLeft -= (hr.left + mh) - er.left;
      }
      p = p.parentNode;
    }
  };
  nav.move = function (dir) {
    var cur = nav.cur;
    if (!cur || !visible(cur) || !root().contains(cur)) { nav.focusFirst(); return false; }
    for (var n = cur; n && n !== document.body; n = n.parentNode) {
      if (n.onnav) { var r0 = n.onnav(dir, cur); if (r0) { if (r0.nodeType) nav.focus(r0); return true; } }
    }
    var cr = cur.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    var list = root().querySelectorAll('.f'), best = null, bs = 1e12;
    for (var i = 0; i < list.length; i++) {
      var el = list[i]; if (el === cur || !visible(el) || el.classList.contains('nokey')) continue;
      var r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, prim, sec;
      if (dir === 'right') { if (x <= cx + 2) continue; prim = Math.max(0, r.left - cr.right); sec = Math.abs(y - cy); }
      else if (dir === 'left') { if (x >= cx - 2) continue; prim = Math.max(0, cr.left - r.right); sec = Math.abs(y - cy); }
      else if (dir === 'down') { if (y <= cy + 2) continue; prim = Math.max(0, r.top - cr.bottom); sec = Math.abs(x - cx); }
      else { if (y >= cy - 2) continue; prim = Math.max(0, cr.top - r.bottom); sec = Math.abs(x - cx); }
      var s = prim + sec * (dir === 'left' || dir === 'right' ? 4 : 1.5);
      if (s < bs) { bs = s; best = el; }
    }
    if (best) nav.focus(best);
    return !!best;
  };
  nav.pushHandler = function (fn) { nav.handlers.push(fn); };
  nav.popHandler = function (fn) { var i = nav.handlers.indexOf(fn); if (i >= 0) nav.handlers.splice(i, 1); };
  L.isBack = function (k) { return k === K.BACK || k === K.ESC || k === 10009; };

  // OK: elements with onlong get hold-to-act (bookmark); others act immediately on press
  var holdT = null, holdEl = null, holdDone = false;
  document.addEventListener('keydown', function (e) {
    var k = e.keyCode, inInput = document.activeElement && document.activeElement.tagName === 'INPUT';
    lastKeyAt = Date.now();
    for (var i = nav.handlers.length - 1; i >= 0; i--) {
      if (nav.handlers[i](e) === true) { e.preventDefault(); return; }
    }
    if (L.isBack(k) || (k === K.BACKSPACE && !inInput)) { e.preventDefault(); if (L.onBack) L.onBack(); return; }
    if (inInput) {
      if (k === K.IME_DONE || k === K.ENTER) { e.preventDefault(); nav.move('down'); return; }
      if (k === K.LEFT || k === K.RIGHT) return;
    }
    if (k === K.LEFT) { e.preventDefault(); nav.move('left'); }
    else if (k === K.RIGHT) { e.preventDefault(); nav.move('right'); }
    else if (k === K.UP) { e.preventDefault(); nav.move('up'); }
    else if (k === K.DOWN) { e.preventDefault(); nav.move('down'); }
    else if (k === K.ENTER) {
      e.preventDefault();
      if (e.repeat) return;
      if (nav.cur && (!document.body.contains(nav.cur) || !visible(nav.cur))) { nav.cur = null; nav.focusFirst(); return; }
      var c = nav.cur; if (!c) return;
      if (c.onlong) {
        holdEl = c; holdDone = false; clearTimeout(holdT);
        holdT = setTimeout(function () { if (holdEl === c) { holdDone = true; c.onlong(); } }, 650);
      } else if (c.onenter) c.onenter();
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.keyCode !== K.ENTER || !holdEl) return;
    clearTimeout(holdT); var c = holdEl; holdEl = null;
    if (!holdDone && c === nav.cur && c.onenter) c.onenter();
  });

  // Magic Remote pointer. Hover only moves focus when the pointer is really being used,
  // never right after a key press, and never away from a text field you're typing in.
  var lastKeyAt = 0, cursorOn = true, acc = 0, accT = 0;
  document.addEventListener('cursorStateChange', function (e) { try { cursorOn = !!e.detail.visibility; } catch (x) {} });
  document.addEventListener('mousemove', function (e) {
    if (!cursorOn) return;
    var now = Date.now();
    if (now - lastKeyAt < 700) return;
    if (now - accT > 200) acc = 0;
    accT = now; acc += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
    if (acc < 14) return;
    var ae = document.activeElement; if (ae && ae.tagName === 'INPUT') return;
    for (var t = e.target; t && t !== document.body; t = t.parentNode) {
      if (t.classList && t.classList.contains('f')) { if (t !== nav.cur && root().contains(t) && t.tagName !== 'INPUT') nav.focus(t, true, true); return; }
    }
  });
  document.addEventListener('click', function (e) {
    for (var t = e.target; t && t !== document.body; t = t.parentNode) {
      if (t.classList && t.classList.contains('f')) {
        if (!root().contains(t)) return;
        e.stopPropagation(); nav.focus(t, true, true);
        if (t.tagName !== 'INPUT' && t.onenter) { nav.clicking = true; try { t.onenter(); } finally { nav.clicking = false; } }
        return;
      }
    }
  }, true);
})();
