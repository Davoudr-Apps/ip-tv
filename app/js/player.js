/* Live player: HLS / direct streams, channel info (OK/Back), glass channel panel with tabs + group rail. */
(function () {
  var K = L.keys, D = L.data, el = L.el, nav = L.nav;
  var P = L.player = { open: false };
  var root, video, osd, osdBtns, zap, zRail, zTabs, zList, zTitle, spin, err, numEl;
  var hls = null, list = [], idx = 0, ctxName = '', osdT = null, osdOn = false, zapOpen = false;
  var numBuf = '', numT = null, stallT = null, triedNative = false, zapT = null, failed = false;
  var zTab = 'bm', zGroup = null, zItems = [], zShown = 0, railT = null, tabT = null, PAGE = 24;

  function $(s) { return root.querySelector(s); }
  function init() {
    root = L.$('player'); video = L.$('video'); osd = L.$('osd'); osdBtns = osd.querySelector('.osd-btns');
    zap = L.$('zap'); zRail = zap.querySelector('.z-rail'); zTabs = zap.querySelector('.z-tabs'); zList = zap.querySelector('.z-list'); zTitle = zap.querySelector('.z-title');
    spin = L.$('p-spin'); err = L.$('p-err'); numEl = L.$('p-num');
    video.addEventListener('playing', function () { busy(false); hideErr(); clearTimeout(stallT); });
    video.addEventListener('waiting', function () { busy(true); });
    video.addEventListener('loadedmetadata', quality);
    video.addEventListener('error', function () { if (!hls) fail('The stream could not be decoded.'); });
    setInterval(function () { if (P.open) $('.osd-clock').textContent = L.clock(); }, 10000);
    root.addEventListener('mousemove', function () { if (!zapOpen && !osdOn) showOsd(false); });
    zList.addEventListener('scroll', function () { if (zShown < zItems.length && zList.scrollTop + zList.clientHeight > zList.scrollHeight - 600) moreRows(); }, { passive: true });
  }
  function busy(b) { spin.classList.toggle('hidden', !b); }
  function hideErr() { failed = false; err.classList.add('hidden'); }
  function fail(msg) {
    if (hls && !triedNative) { triedNative = true; destroyHls(); playNative(list[idx].url); return; }
    busy(false); clearTimeout(stallT); failed = true;
    err.querySelector('.t2').textContent = msg || '';
    err.classList.remove('hidden'); showOsd(true);
  }
  function quality() {
    var h = video.videoHeight;
    var q = $('.osd-q'); q.textContent = h ? (h >= 2000 ? '4K' : h >= 1000 ? 'FHD' : h >= 700 ? 'HD' : 'SD') : '';
  }
  function destroyHls() { if (hls) { try { hls.destroy(); } catch (e) {} hls = null; } }
  function stop() {
    destroyHls(); clearTimeout(stallT);
    try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
  }
  function playNative(url) { video.src = url; var p = video.play(); if (p && p.catch) p.catch(function () {}); }
  function load(c) {
    stop(); hideErr(); busy(true); triedNative = false; $('.osd-q').textContent = '';
    var isHls = /\.m3u8(\?|$)/i.test(c.url) || /\/hls\//i.test(c.url) || /type=m3u8/i.test(c.url);
    if (isHls && window.Hls && Hls.isSupported()) {
      hls = new Hls({ liveSyncDurationCount: 3, maxBufferLength: 30, manifestLoadingMaxRetry: 2, levelLoadingMaxRetry: 3, fragLoadingMaxRetry: 4 });
      hls.on(Hls.Events.MANIFEST_PARSED, function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); });
      hls.on(Hls.Events.ERROR, function (ev, d) {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR) { try { hls.recoverMediaError(); return; } catch (e) {} }
        fail(d.type === Hls.ErrorTypes.NETWORK_ERROR ? 'The server did not respond.' : 'Playback error.');
      });
      hls.loadSource(c.url); hls.attachMedia(video);
    } else playNative(c.url);
    clearTimeout(stallT);
    stallT = setTimeout(function () { if (video.readyState < 3 && P.open) fail('The stream took too long to start.'); }, 25000);
  }

  /* ---------- channel info (OSD) ---------- */
  function osdButton(icon, label, fn, cls) {
    var b = el('div', 'pbtn f' + (cls ? ' ' + cls : '')); b.appendChild(L.icon(icon)); b.appendChild(el('span', '', label));
    b.onenter = fn; return b;
  }
  function paintOsd() {
    var c = list[idx];
    $('.osd-no').textContent = c.no ? 'CH ' + c.no : '';
    $('.osd-name').textContent = c.name;
    $('.osd-grp').textContent = c.group;
    $('.osd-clock').textContent = L.clock();
    var lg = $('.osd-logo'); lg.innerHTML = ''; lg.appendChild(L.logo(c, 'logo'));
    var keep = nav.cur && osdBtns.contains(nav.cur) ? nav.cur._k : null;
    osdBtns.innerHTML = '';
    if (failed) { var r = osdButton('i-refresh', 'Retry', function () { tune(idx); }); r._k = 'retry'; osdBtns.appendChild(r); }
    if (!c.link) {
      var on = D.isBm(c);
      var b = osdButton(on ? 'i-bmf' : 'i-bm', on ? 'Bookmarked' : 'Bookmark', function () { toggleBm(c); paintOsd(); showOsd(true); }, on ? 'on' : '');
      b._k = 'bm'; osdBtns.appendChild(b);
    }
    var ch = osdButton('i-list', 'Channels', function () { openZap(); }); ch._k = 'ch'; osdBtns.appendChild(ch);
    if (osdOn) {
      var t = null; for (var i = 0; i < osdBtns.children.length; i++) if (osdBtns.children[i]._k === keep) t = osdBtns.children[i];
      nav.focus(t || osdBtns.firstChild);
    }
  }
  function showOsd(withFocus) {
    osd.classList.add('on'); clearTimeout(osdT);
    if (withFocus && !osdOn) { osdOn = true; nav.pushScope(osd); nav.focus(osdBtns.firstChild); }
    osdT = setTimeout(hideOsd, failed ? 60000 : 7000);
  }
  function hideOsd() {
    clearTimeout(osdT); osd.classList.remove('on');
    if (osdOn) { osdOn = false; nav.popScope(osd); }
  }
  function toggleBm(c) { if (c.link) return; var on = D.toggleBm(c); L.toast(on ? 'Added to Bookmarks' : 'Removed from Bookmarks'); return on; }

  function tune(i) {
    if (!list.length) return;
    idx = (i + list.length) % list.length;
    var c = list[idx];
    if (!c.link) D.pushRecent(c);
    load(c); paintOsd(); showOsd(false);
    if (zapOpen) markNow();
  }
  function zapTo(i) {
    idx = (i + list.length) % list.length; paintOsd(); showOsd(false);
    busy(true); clearTimeout(zapT); zapT = setTimeout(function () { tune(idx); }, 450);
  }

  /* ---------- channel panel: tabs (Bookmarks | All) + group rail + list ---------- */
  function source() { return zTab === 'bm' ? D.bmChannels() : (D.channels.length ? D.channels : list); }
  function railItem(label, icon, name) {
    var r = el('div', 'zr f');
    var ic = el('div', 'zi');
    if (icon) ic.appendChild(L.icon(icon)); else ic.appendChild(el('span', 'zm', L.initials(label)));
    r.appendChild(ic); r.appendChild(el('div', 'zl', label));
    r._g = name;
    r.onfocused = function () {
      if (nav.byPointer || zGroup === name) return;
      clearTimeout(railT);
      railT = setTimeout(function () { if (nav.cur !== r) return; zGroup = name; markRail(); renderList(false); }, 220);
    };
    r.onenter = function () { clearTimeout(railT); zGroup = name; markRail(); renderList(true); };
    return r;
  }
  var railCache = {}, railKey = '';
  function railItems() { return zRail.querySelectorAll('.zr'); }
  function markRail() { var a = railItems(); for (var i = 0; i < a.length; i++) a[i].classList.toggle('on', a[i]._g === zGroup); }
  function buildRail(tab) {
    var wrap = el('div', 'zr-wrap');
    var groups = tab === 'bm' ? D.groupsOf(D.bmChannels()) : (D.channels.length ? D.groups : D.groupsOf(list));
    var frag = document.createDocumentFragment();
    frag.appendChild(railItem('All', 'g-all', null));
    groups.forEach(function (g) { frag.appendChild(railItem(g.name, L.groupIcon(g.name), g.name)); });
    wrap.appendChild(frag); return wrap;
  }
  function getRail(tab) {
    var key = D.channels.length + ':' + D.groups.length;
    if (key !== railKey) { railCache = {}; railKey = key; }
    if (tab === 'bm' || !railCache[tab]) railCache[tab] = buildRail(tab);   // bookmarks change often: always fresh (small)
    return railCache[tab];
  }
  function renderRail() {
    var node = getRail(zTab);
    if (zRail.firstChild !== node) { zRail.innerHTML = ''; zRail.appendChild(node); }
    zRail.scrollTop = 0;
    if (zGroup && !Array.prototype.some.call(railItems(), function (r) { return r._g === zGroup; })) zGroup = null;
    markRail();
  }
  function renderTabs() {
    zTabs.innerHTML = '';
    [['bm', 'Bookmarks', 'i-bmf'], ['all', 'All channels', 'g-all']].forEach(function (t) {
      var b = el('div', 'ztab f' + (zTab === t[0] ? ' on' : '')); b.appendChild(L.icon(t[2])); b.appendChild(el('span', '', t[1])); b._t = t[0];
      function pick(focusList) {
        if (zTab !== t[0]) { zTab = t[0]; zGroup = null; markTabs(); renderRail(); renderList(false); }
        var f = focusList && zList.querySelector('.zmain'); nav.focus(f || zTabs.children[t[0] === 'bm' ? 0 : 1], !f);
      }
      b.onfocused = function () {
        if (nav.byPointer || zTab === t[0]) return;
        clearTimeout(tabT); tabT = setTimeout(function () { if (nav.cur === b) pick(false); }, 120);
      };
      b.onenter = function () { clearTimeout(tabT); pick(true); };
      zTabs.appendChild(b);
    });
  }
  function markTabs() { var a = zTabs.children; for (var i = 0; i < a.length; i++) a[i].classList.toggle('on', a[i]._t === zTab); }
  function row(c, i) {
    var r = el('div', 'zrow');
    var main = el('div', 'zmain f');
    main.appendChild(el('span', 'zno tab', c.no ? String(c.no) : ''));
    main.appendChild(L.logo(c, 'logo sm'));
    var tx = el('div', 'ztx'); tx.appendChild(el('div', 'zn', c.name)); tx.appendChild(el('div', 'zg', c.group)); main.appendChild(tx);
    main.appendChild(el('span', 'znow'));
    main.onenter = function () { list = zItems.slice(); ctxName = zTab === 'bm' ? 'Bookmarks' : (zGroup || 'All channels'); closeZap(); tune(i); };
    main.onlong = function () { toggleBm(c); paintBm(); };
    var bm = el('div', 'zbm f'); bm.appendChild(L.icon(D.isBm(c) ? 'i-bmf' : 'i-bm'));
    function paintBm() { var on = D.isBm(c); L.setIcon(bm, on ? 'i-bmf' : 'i-bm'); bm.classList.toggle('on', on); }
    bm.onenter = function () { toggleBm(c); paintBm(); paintOsd(); };
    paintBm();
    r.appendChild(main); r.appendChild(bm); r._c = c;
    return r;
  }
  function renderList(focus) {
    var src = source();
    zItems = zGroup ? src.filter(function (c) { return c.group === zGroup; }) : src;
    zTitle.textContent = (zGroup || (zTab === 'bm' ? 'All bookmarks' : 'All channels')) + '  ·  ' + zItems.length;
    zList.innerHTML = ''; zList.scrollTop = 0;
    if (!zItems.length) {
      var e = el('div', 'zempty'); e.appendChild(L.icon('i-bm'));
      e.appendChild(el('div', '', zTab === 'bm' ? 'No bookmarks yet' : 'No channels'));
      if (zTab === 'bm') e.appendChild(el('div', 'zh', 'Open “All channels” and press the bookmark button next to a channel'));
      zList.appendChild(e); return;
    }
    zShown = 0;
    var cur = list[idx], at = -1;
    for (var j = 0; j < zItems.length; j++) if (zItems[j].url === cur.url) { at = j; break; }
    moreRows(Math.max(PAGE, at + 12));
    markNow();
    if (focus) { var n = zList.querySelector('.zrow.now .zmain') || zList.querySelector('.zmain'); nav.focus(n); }
  }
  function moreRows(n) {
    var end = Math.min(zItems.length, zShown + (n || PAGE)), frag = document.createDocumentFragment();
    for (var i = zShown; i < end; i++) { var r = row(zItems[i], i); r.firstChild._i = i; frag.appendChild(r); }
    zList.appendChild(frag); zShown = end;
  }
  function markNow() {
    var cur = list[idx];
    for (var i = 0; i < zList.children.length; i++) { var r = zList.children[i]; if (r._c) r.classList.toggle('now', r._c.url === cur.url); }
  }
  function openZap() {
    hideOsd();
    zTab = 'bm'; zGroup = null; clearTimeout(railT); clearTimeout(tabT);   // always opens on Bookmarks
    renderTabs(); renderRail(); renderList(false);
    zapOpen = true; zap.classList.add('on'); nav.pushScope(zap);
    setTimeout(function () { if (zapOpen) getRail('all'); }, 350);
    var n = zList.querySelector('.zrow.now .zmain') || zList.querySelector('.zmain') || zTabs.children[1];
    nav.focus(n);
  }
  function closeZap() { if (!zapOpen) return; zapOpen = false; zap.classList.remove('on'); nav.popScope(zap); }
  // rail ←→ list ←→ bookmark buttons; Left from the rail closes the panel
  function zapNav(dir, cur) {
    if (dir === 'down' && cur.classList.contains('zmain') && cur._i + 8 >= zShown && zShown < zItems.length) moreRows();
    if (dir === 'left' && cur.classList.contains('zr')) { closeZap(); return true; }
    if (dir === 'right' && cur.classList.contains('zr')) return zList.querySelector('.zrow.now .zmain') || zList.querySelector('.zmain') || zTabs.firstChild;
    if (dir === 'left' && cur.classList.contains('zmain')) { var on = zRail.querySelector('.zr.on') || zRail.firstChild; return on; }
    if (dir === 'left' && cur.classList.contains('ztab') && cur === zTabs.firstChild) return zRail.querySelector('.zr.on') || zRail.firstChild;
    return false;
  }

  function digit(d) {
    numBuf = (numBuf + d).slice(-4); numEl.textContent = numBuf; numEl.classList.remove('hidden');
    clearTimeout(numT);
    numT = setTimeout(function () {
      var n = parseInt(numBuf, 10); numBuf = ''; numEl.classList.add('hidden');
      var c = null; for (var i = 0; i < D.channels.length; i++) if (D.channels[i].no === n) { c = D.channels[i]; break; }
      if (!c) { L.toast('No channel ' + n); return; }
      var j = list.indexOf(c);
      if (j < 0) { list = D.channels; ctxName = 'All channels'; j = list.indexOf(c); }
      tune(j);
    }, 1400);
  }

  function onKey(e) {
    if (!P.open) return false;
    var k = e.keyCode;
    if (zapOpen) {
      if (L.isBack(k)) { closeZap(); return true; }
      return false; // arrows / OK handled by spatial navigation inside the panel
    }
    if (k >= 48 && k <= 57) { digit(String(k - 48)); return true; }
    if (k >= 96 && k <= 105) { digit(String(k - 96)); return true; }
    if (k === K.CH_UP) { zapTo(idx - 1); return true; }
    if (k === K.CH_DOWN) { zapTo(idx + 1); return true; }
    if (osdOn) {
      if (L.isBack(k)) { P.close(); return true; }       // Back while info is showing → leave the player
      if (k === K.UP) { zapTo(idx - 1); return true; }
      if (k === K.DOWN) { zapTo(idx + 1); return true; }
      if (k === K.INFO) { hideOsd(); return true; }
      if (k === K.LEFT || k === K.RIGHT) { nav.move(k === K.LEFT ? 'left' : 'right'); showOsd(false); return true; }
      if (k === K.ENTER) { if (nav.cur && nav.cur.onenter) nav.cur.onenter(); return true; }
      return true;
    }
    if (L.isBack(k) || k === K.ENTER || k === K.INFO) { showOsd(true); return true; }  // OK / Back → channel info
    if (k === K.UP) { zapTo(idx - 1); return true; }
    if (k === K.DOWN) { zapTo(idx + 1); return true; }
    if (k === K.LEFT || k === K.RIGHT) { openZap(); return true; }
    if (k === K.PAUSE || k === K.STOP) { video.pause(); return true; }
    if (k === K.PLAY) { tune(idx); return true; }
    return true;
  }

  P.play = function (channels, i, name) {
    if (!root) init();
    if (P.onOpen) P.onOpen();
    list = channels.slice(); ctxName = name || '';
    P.open = true; root.classList.remove('hidden'); document.body.classList.add('playing');
    zap.onnav = zapNav;
    nav.pushScope(root); nav.pushHandler(onKey);
    tune(i);
  };
  P.close = function () {
    clearTimeout(zapT); closeZap(); hideOsd(); stop(); P.open = false;
    root.classList.add('hidden'); hideErr(); busy(false);
    document.body.classList.remove('playing');
    nav.popHandler(onKey); nav.popScope(root);
    if (P.onClose) P.onClose(list[idx]);
  };
  document.addEventListener('visibilitychange', function () {
    if (!P.open) return;
    if (document.hidden) stop(); else tune(idx);
  });
})();
