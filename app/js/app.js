/* Screens: icon rail, Home (groups panel + channel list), Search, Bookmarks, History, Play a link, Playlists, Settings
   + full-height preview panel on the right that follows the selected channel. */
(function () {
  var D = L.data, nav = L.nav, el = L.el, S = L.store;
  var side, sideMain, sideFoot, view, peek, groupsBox, gpList, current = null, activeSide = null, lastInView = null;
  var PEEK_VIEWS = { home: 1, search: 1, bm: 1, history: 1 };
  var pagers = [];

  /* ---------- icon rail ---------- */
  var MENU = [['home', 'i-home', 'Home'], ['search', 'i-search', 'Search'], ['bm', 'i-bm', 'Bookmarks'], ['history', 'i-clock', 'History'], ['link', 'i-link', 'Link']];
  var FOOT = [['playlists', 'i-list', 'Playlists'], ['settings', 'i-gear', 'Settings']];
  function sideItem(parent, m) {
    var it = el('div', 'si f'); it.appendChild(L.icon(m[1])); it.appendChild(el('span', 'sl', m[2]));
    it._key = m[0]; it.onenter = function () { show(m[0]); }; parent.appendChild(it);
  }
  function buildSide() {
    sideMain.innerHTML = ''; sideFoot.innerHTML = '';
    MENU.forEach(function (m) { sideItem(sideMain, m); });
    FOOT.forEach(function (m) { sideItem(sideFoot, m); });
    markSide();
  }
  function markSide() {
    var all = side.querySelectorAll('.si'); activeSide = null;
    for (var i = 0; i < all.length; i++) { var on = all[i]._key === current; all[i].classList.toggle('on', on); if (on) activeSide = all[i]; }
  }

  /* ---------- bookmarks ---------- */
  function toggleBm(c) { var on = D.toggleBm(c); L.toast(on ? 'Added to Bookmarks' : 'Removed from Bookmarks'); syncBm(c); return on; }
  function syncBm(c) {
    var on = D.isBm(c), marks = document.querySelectorAll('[data-u]');
    for (var i = 0; i < marks.length; i++) if (marks[i].getAttribute('data-u') === c.url) { marks[i].classList.toggle('on', on); L.setIcon(marks[i], on ? 'i-bmf' : 'i-bm'); }
    if (pk.c && pk.c.url === c.url) paintPeekBtn();
  }
  function bmButton(c) {
    var b = el('div', 'bmk f'); b.setAttribute('data-u', c.url);
    var on = D.isBm(c); b.appendChild(L.icon(on ? 'i-bmf' : 'i-bm')); b.classList.toggle('on', on);
    b.onenter = function () { toggleBm(c); };
    return b;
  }

  /* ---------- channel rows ---------- */
  function lrow(c, list, i, ctx) {
    var r = el('div', 'lrow');
    var m = el('div', 'lmain f');
    m.appendChild(el('span', 'lno tab', c.no ? String(c.no) : ''));
    m.appendChild(L.logo(c, 'logo sm'));
    var tx = el('div', 'ltx'); tx.appendChild(el('div', 'ln', c.name)); tx.appendChild(el('div', 'lg', c.group)); m.appendChild(tx);
    var info = { c: c, list: list, i: i, ctx: ctx };
    m._ch = info; m._i = i;
    m.onenter = function () {
      // with the pointer: first click selects (shows the preview), a second click plays
      if (nav.clicking && (!pk.c || pk.c.url !== c.url)) { setPeek(info); return; }
      L.player.play(list, i, ctx);
    };
    m.onlong = function () { toggleBm(c); };
    r.appendChild(m); r.appendChild(bmButton(c));
    return r;
  }
  function results(parent, items, ctx, emptyMsg, playList, offset) {
    if (!items.length) { if (emptyMsg) parent.appendChild(empty(emptyMsg)); return null; }
    var box = el('div', 'lst'), shown = 0, pl = playList || items, off = offset || 0;
    function more() {
      var end = Math.min(items.length, shown + L.config.pageSize), frag = document.createDocumentFragment();
      for (var i = shown; i < end; i++) frag.appendChild(lrow(items[i], pl, off + i, ctx));
      box.appendChild(frag); shown = end;
    }
    more();
    box.onnav = function (dir, cur) { if (dir === 'down' && cur._i - off + 6 >= shown && shown < items.length) more(); return false; };
    pagers.push(function () { if (shown < items.length && document.body.contains(box)) more(); });
    parent.appendChild(box); return box;
  }
  function button(icon, label, cls, fn) {
    var b = el('div', 'btn f' + (cls ? ' ' + cls : '')); if (icon) b.appendChild(L.icon(icon)); b.appendChild(el('span', '', label));
    b.onenter = fn; return b;
  }
  function input(ph, type) {
    var i = el('input', 'inp f'); i.placeholder = ph; i.type = type || 'text';
    i.setAttribute('autocomplete', 'off'); i.setAttribute('autocapitalize', 'off'); i.spellcheck = false; return i;
  }
  function empty(msg, sub) {
    var e = el('div', 'empty'); e.appendChild(el('div', 'e1', msg || 'Nothing here yet'));
    if (sub) e.appendChild(el('div', 'e2', sub)); return e;
  }
  function pageHead(kicker, title, right) {
    var h = el('header', 'ph'), l = el('div', 'phl');
    if (kicker) l.appendChild(el('div', 'pk', kicker));
    l.appendChild(el('h1', '', title));
    h.appendChild(l); if (right) h.appendChild(right);
    view.appendChild(h); return h;
  }

  /* ---------- preview panel ---------- */
  var pk = { c: null, t: null, info: null }, pv = { hls: null, t: null };
  function pvStop() {
    clearTimeout(pv.t); if (pv.hls) { try { pv.hls.destroy(); } catch (e) {} pv.hls = null; }
    var v = L.$('pkv'); if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} v.parentNode.classList.remove('live'); }
  }
  function pvStart(c) {
    pvStop();
    if (S.get('previews', true) === false) return;
    pv.t = setTimeout(function () {
      var v = L.$('pkv'); if (!v || L.player.open) return;
      var sound = S.get('previewSound', true) !== false;
      v.removeAttribute('muted'); v.muted = !sound; v.volume = 1;
      v.onplaying = function () { v.parentNode.classList.add('live'); };
      // play with sound; if the platform refuses unmuted autoplay, fall back to muted
      function go() { var p = v.play(); if (p && p.catch) p.catch(function () { if (!v.muted) { v.muted = true; var q = v.play(); if (q && q.catch) q.catch(function () {}); } }); }
      if (/\.m3u8(\?|$)/i.test(c.url) && window.Hls && Hls.isSupported()) {
        pv.hls = new Hls({ maxBufferLength: 8, capLevelToPlayerSize: true });
        pv.hls.on(Hls.Events.ERROR, function (e, d) { if (d.fatal) pvStop(); });
        pv.hls.on(Hls.Events.MANIFEST_PARSED, go);
        pv.hls.loadSource(c.url); pv.hls.attachMedia(v);
      } else { v.src = c.url; go(); }
    }, 700);
  }
  function paintPeekBtn() {
    var b = peek.querySelector('.pk-bm'); if (!b || !pk.c) return;
    var on = D.isBm(pk.c); b.classList.toggle('on', on); L.setIcon(b, on ? 'i-bmf' : 'i-bm');
    b.querySelector('span').textContent = on ? 'Bookmarked' : 'Bookmark';
  }
  function setPeek(info) {
    if (!info || (pk.c && pk.c.url === info.c.url)) return;
    pk.c = info.c; pk.info = info; clearTimeout(pk.t);
    var rows = view.querySelectorAll('.lmain.sel'); for (var i = 0; i < rows.length; i++) rows[i].classList.remove('sel');
    pk.t = setTimeout(function () {
      var c = info.c;
      var lg = peek.querySelector('.pk-logo'); lg.innerHTML = ''; lg.appendChild(L.logo(c, 'logo'));
      peek.querySelector('.pk-screen').style.setProperty('--t', L.tint(c.name));
      peek.querySelector('.pk-no').textContent = c.no ? 'Channel ' + c.no : 'Direct link';
      peek.querySelector('.pk-name').textContent = c.name;
      peek.querySelector('.pk-grp').textContent = c.group;
      var btns = peek.querySelector('.pk-btns'); btns.innerHTML = '';
      btns.appendChild(button('i-play', 'Watch', 'primary', function () { L.player.play(pk.info.list, pk.info.i, pk.info.ctx); }));
      btns.appendChild(button('i-bm', 'Bookmark', 'pk-bm', function () { toggleBm(pk.c); }));
      paintPeekBtn();
      peek.classList.add('ready');
      pvStart(c);
    }, 160);
  }
  function clearPeek() { pk.c = null; pk.info = null; clearTimeout(pk.t); pvStop(); peek.classList.remove('ready'); }

  /* ---------- groups panel (Home) ---------- */
  var chGroup = null, gT = null;
  function buildGroups() {
    gpList.innerHTML = '';
    var all = [{ name: null, label: 'All channels', count: D.channels.length }].concat(D.groups.map(function (g) { return { name: g.name, label: g.name, count: g.count }; }));
    all.forEach(function (g) {
      var it = el('div', 'gi f' + (g.name === chGroup ? ' on' : ''));
      it.appendChild(L.icon(g.name ? (L.groupIcon(g.name) || 'g-star') : 'g-all'));
      it.appendChild(el('span', 'gn', g.label)); it.appendChild(el('em', 'tab', String(g.count)));
      it._g = g.name;
      function apply(focusList) {
        clearTimeout(gT);
        if (chGroup !== g.name || current !== 'home') { chGroup = g.name; markGroups(); if (current === 'home') renderHomeList(); else show('home', true); }
        if (focusList) { var f = view.querySelector('.lmain'); if (f) nav.focus(f); }
      }
      it.onfocused = function () { if (nav.byPointer) return; clearTimeout(gT); gT = setTimeout(function () { if (nav.cur === it) apply(false); }, 380); };
      it.onenter = function () { apply(true); };
      gpList.appendChild(it);
    });
  }
  function markGroups() { var a = gpList.children; for (var i = 0; i < a.length; i++) a[i].classList.toggle('on', a[i]._g === chGroup); }
  function activeGroup() { return gpList.querySelector('.gi.on') || gpList.firstChild; }

  /* ---------- screens ---------- */
  function renderHomeList() {
    pagers = []; view.innerHTML = ''; view.scrollTop = 0;
    var items = chGroup ? D.inGroup(chGroup) : D.channels;
    pageHead(items.length + ' channels', chGroup || 'All channels');
    results(view, items, chGroup || 'All channels', 'No channels in this group');
    var f = view.querySelector('.lmain'); if (f && f._ch) { pk.c = null; setPeek(f._ch); }
  }
  function homeView() { renderHomeList(); }

  function historyView() {
    var r = D.recentChannels();
    pageHead(r.length + ' channels', 'History', r.length ? button('i-trash', 'Clear', 'ghost sm', function () { D.clearRecent(); L.toast('History cleared'); show('history'); }) : null);
    results(view, r, 'History', null);
    if (!r.length) view.appendChild(empty('Nothing watched yet', 'Channels you watch will show up here.'));
  }

  function bmView() {
    var all = D.bmChannels(), groups = D.groupsOf(all);
    pageHead(all.length + ' saved', 'Bookmarks');
    if (!all.length) { view.appendChild(empty('No bookmarks yet', 'Use the bookmark button next to any channel, or hold OK on it.')); return; }
    var ordered = []; groups.forEach(function (g) { all.forEach(function (c) { if (c.group === g.name) ordered.push(c); }); });
    var off = 0;
    groups.forEach(function (g) {
      var h = el('div', 'gh'); h.appendChild(L.icon(L.groupIcon(g.name) || 'g-star')); h.appendChild(el('span', '', g.name)); h.appendChild(el('em', 'tab', String(g.count)));
      view.appendChild(h);
      results(view, ordered.slice(off, off + g.count), 'Bookmarks', null, ordered, off);
      off += g.count;
    });
  }

  var searchQ = '';
  function searchView() {
    pageHead('Find a channel', 'Search');
    var bar = el('div', 'sbar'); bar.appendChild(L.icon('i-search'));
    var inp = input('Channel or group name'); inp.value = searchQ; bar.appendChild(inp); view.appendChild(bar);
    var holder = el('div', 'holder'); view.appendChild(holder);
    var t = null;
    function run() {
      searchQ = inp.value; holder.innerHTML = ''; pagers = [];
      if (!searchQ.trim()) { holder.appendChild(el('div', 'sl2', 'Type to search ' + D.channels.length + ' channels')); return; }
      var res = D.search(searchQ).slice(0, 500);
      holder.appendChild(el('div', 'sl2', res.length + ' result' + (res.length === 1 ? '' : 's')));
      results(holder, res, 'Search: ' + searchQ, 'No matches for “' + searchQ + '”');
    }
    inp.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 250); });
    run();
  }

  function linkView() {
    pageHead('Direct stream', 'Play a link');
    var panel = el('div', 'panel');
    var u = input('https://…/stream.m3u8', 'url'), n = input('Title (optional)');
    panel.appendChild(el('label', '', 'Stream address  ·  .m3u8, .mp4 or .ts')); panel.appendChild(u);
    panel.appendChild(el('label', '', 'Title')); panel.appendChild(n);
    var row = el('div', 'hb');
    row.appendChild(button('i-play', 'Play', 'primary', function () {
      var url = u.value.trim();
      if (!/^https?:\/\//i.test(url)) { L.toast('Enter a full address starting with http:// or https://'); nav.focus(u); return; }
      var item = D.saveLink(n.value.trim(), url); L.player.play([item], 0, 'Direct link');
    }));
    panel.appendChild(row); view.appendChild(panel);
    var links = D.links();
    if (links.length) {
      view.appendChild(el('h2', 'h2s', 'Recent links'));
      var lst = el('div', 'plist');
      links.forEach(function (lk, i) {
        var r = el('div', 'prow');
        var tx = el('div', 'ptx'); tx.appendChild(el('div', 'pn', lk.name)); tx.appendChild(el('div', 'pu', lk.url)); r.appendChild(tx);
        r.appendChild(button('i-play', 'Play', '', function () { L.player.play(links, i, 'Recent links'); }));
        r.appendChild(button('i-trash', 'Remove', 'ghost', function () { D.removeLink(lk.url); show('link'); }));
        lst.appendChild(r);
      });
      view.appendChild(lst);
    }
  }

  function playlistsView() {
    var pls = D.playlists();
    pageHead(pls.length ? pls.length + ' playlist' + (pls.length > 1 ? 's' : '') + '  ·  ' + D.channels.length + ' channels' : 'Get started', 'Playlists');
    if (!pls.length) {
      var intro = el('div', 'intro');
      intro.appendChild(el('div', 'i1', 'Add an M3U playlist to start watching'));
      intro.appendChild(el('div', 'i2', 'Use the playlist link from your TV provider or any service you subscribe to. Channels, groups and logos are picked up automatically.'));
      view.appendChild(intro);
    }
    var list = el('div', 'plist');
    pls.forEach(function (p) {
      var row = el('div', 'prow');
      var tx = el('div', 'ptx'); tx.appendChild(el('div', 'pn', p.name)); tx.appendChild(el('div', 'pu', p.url));
      var meta = p.error ? '⚠ ' + p.error : (p.count ? p.count + ' channels' : 'Not loaded yet') + (p.updated ? '  ·  updated ' + new Date(p.updated).toLocaleDateString() : '');
      tx.appendChild(el('div', 'pm' + (p.error ? ' bad' : ''), meta)); row.appendChild(tx);
      row.appendChild(button('i-refresh', 'Refresh', '', function () { reload(true, 'playlists'); }));
      var armed = false, db = button('i-trash', 'Remove', 'ghost', function () {
        if (!armed) { armed = true; db.querySelector('span').textContent = 'Press again'; db.classList.add('warn'); setTimeout(function () { armed = false; db.querySelector('span').textContent = 'Remove'; db.classList.remove('warn'); }, 3000); return; }
        D.removePlaylist(p.id); L.toast('Playlist removed'); reload(false, 'playlists');
      });
      row.appendChild(db); list.appendChild(row);
    });
    view.appendChild(list);
    var form = el('div', 'panel');
    form.appendChild(el('h2', 'h2s first', 'Add playlist'));
    var u = input('http://…/playlist.m3u', 'url'), n = input('Name (optional)');
    form.appendChild(el('label', '', 'Playlist address')); form.appendChild(u);
    form.appendChild(el('label', '', 'Name')); form.appendChild(n);
    var row2 = el('div', 'hb');
    row2.appendChild(button('i-plus', 'Add & load', 'primary', function () {
      var url = u.value.trim();
      if (!/^https?:\/\//i.test(url)) { L.toast('Enter a full address starting with http:// or https://'); nav.focus(u); return; }
      D.addPlaylist(n.value.trim(), url); reload(true, 'home');
    }));
    form.appendChild(row2); view.appendChild(form);
  }

  function settingsView() {
    pageHead('Make it yours', 'Settings');
    view.appendChild(el('h2', 'h2s first', 'Theme'));
    var tg = el('div', 'themes'), curT = S.get('theme', 'midnight');
    L.themes.forEach(function (th) {
      var c = el('div', 'thc f' + (th.id === curT ? ' on' : ''));
      var sw = el('div', 'sw'); sw.setAttribute('data-theme', th.id);
      var mini = el('div', 'swin'); mini.appendChild(el('i', 'a')); mini.appendChild(el('i', 'b')); sw.appendChild(mini);
      var chk = el('span', 'chk'); chk.appendChild(L.icon('i-check')); sw.appendChild(chk);
      c.appendChild(sw); c.appendChild(el('div', 'thn', th.name)); c.appendChild(el('div', 'thd', th.desc));
      c.onenter = function () {
        L.applyTheme(th.id);
        var all = tg.querySelectorAll('.thc'); for (var i = 0; i < all.length; i++) all[i].classList.remove('on');
        c.classList.add('on'); L.toast(th.name + ' theme applied');
      };
      tg.appendChild(c);
    });
    view.appendChild(tg);
    view.appendChild(el('h2', 'h2s', 'Playback'));
    var r = el('div', 'opt'); var tx = el('div', 'otx'); tx.appendChild(el('div', 'on1', 'Live preview')); tx.appendChild(el('div', 'on2', 'Play the selected channel in the preview panel')); r.appendChild(tx);
    var seg = el('div', 'seg');
    [[true, 'On'], [false, 'Off']].forEach(function (ch) {
      var b = el('div', 'segb f' + (S.get('previews', true) === ch[0] ? ' on' : '')); b.appendChild(el('span', '', ch[1]));
      b.onenter = function () { S.set('previews', ch[0]); var s = seg.querySelectorAll('.segb'); for (var i = 0; i < s.length; i++) s[i].classList.remove('on'); b.classList.add('on'); };
      seg.appendChild(b);
    });
    r.appendChild(seg); view.appendChild(r);
    var r2 = el('div', 'opt'); var tx2 = el('div', 'otx'); tx2.appendChild(el('div', 'on1', 'Preview sound')); tx2.appendChild(el('div', 'on2', 'Hear the selected channel in the preview panel')); r2.appendChild(tx2);
    var seg2 = el('div', 'seg');
    [[true, 'On'], [false, 'Off']].forEach(function (ch) {
      var b = el('div', 'segb f' + (S.get('previewSound', true) === ch[0] ? ' on' : '')); b.appendChild(el('span', '', ch[1]));
      b.onenter = function () { S.set('previewSound', ch[0]); var s2 = seg2.querySelectorAll('.segb'); for (var i = 0; i < s2.length; i++) s2[i].classList.remove('on'); b.classList.add('on'); };
      seg2.appendChild(b);
    });
    r2.appendChild(seg2); r2.style.marginTop = '8px'; view.appendChild(r2);
    view.appendChild(el('h2', 'h2s', 'Data'));
    var dr = el('div', 'hb');
    dr.appendChild(button('i-clock', 'Clear history', '', function () { D.clearRecent(); L.toast('History cleared'); }));
    var armed = false, cb = button('i-trash', 'Clear bookmarks', 'ghost', function () {
      if (!armed) { armed = true; cb.querySelector('span').textContent = 'Press again to confirm'; cb.classList.add('warn'); setTimeout(function () { armed = false; cb.querySelector('span').textContent = 'Clear bookmarks'; cb.classList.remove('warn'); }, 3000); return; }
      D.clearBms(); L.toast('Bookmarks cleared'); cb.querySelector('span').textContent = 'Clear bookmarks'; cb.classList.remove('warn'); armed = false;
    });
    dr.appendChild(cb); view.appendChild(dr);
    view.appendChild(el('div', 'about', 'OneTo 3.1  ·  Hold OK on any channel to bookmark it'));
  }

  var VIEWS = { home: homeView, history: historyView, bm: bmView, search: searchView, link: linkView, playlists: playlistsView, settings: settingsView };
  function show(key, keepFocus) {
    if (!D.playlists().length && { home: 1, history: 1, bm: 1, search: 1 }[key]) key = 'playlists';
    clearPeek(); pagers = [];
    current = key; markSide(); view.innerHTML = ''; view.scrollTop = 0; lastInView = null;
    view.className = 'scroll v-' + key;
    document.body.classList.toggle('with-peek', !!PEEK_VIEWS[key]);
    document.body.classList.toggle('with-groups', key === 'home');
    VIEWS[key]();
    if (PEEK_VIEWS[key] && !pk.c) { var fc = firstChannel(); if (fc) setPeek(fc._ch); }
    if (!keepFocus) {
      var first = (key === 'search' && view.querySelector('.inp')) || firstChannel() || view.querySelector('.f');
      if (first) nav.focus(first); else if (activeSide) nav.focus(activeSide);
    }
  }
  function firstChannel() { return view.querySelector('.lmain'); }

  function reload(force, then) {
    clearPeek(); view.innerHTML = ''; view.className = 'scroll';
    document.body.classList.remove('with-peek'); document.body.classList.remove('with-groups');
    var ld = el('div', 'loading'); ld.appendChild(el('i')); ld.appendChild(el('span', '', 'Loading your channels…')); view.appendChild(ld);
    return D.build(force).then(function (res) {
      buildSide(); buildGroups();
      if (res.errors.length) L.toast(res.errors[0], 5000);
      show(then || current || 'home');
    });
  }

  /* ---------- navigation glue: rail ↔ groups ↔ list ↔ bookmark ↔ preview ---------- */
  function hasSide(cur, dir) {
    var cr = cur.getBoundingClientRect(), list = view.querySelectorAll('.f');
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect(); if (list[i] === cur || !r.width || r.bottom <= cr.top + 8 || r.top >= cr.bottom - 8) continue;
      if (dir === 'left' ? r.right <= cr.left + 2 : r.left >= cr.right - 2) return true;
    }
    return false;
  }
  function leftTarget() { return current === 'home' ? activeGroup() : (activeSide || sideMain.firstChild); }

  L.onBack = function () {
    if (nav.cur && (view.contains(nav.cur) || peek.contains(nav.cur))) { nav.focus(current === 'home' ? activeGroup() : activeSide); return; }
    if (nav.cur && groupsBox.contains(nav.cur)) { nav.focus(activeSide); return; }
    if (current !== 'home' && D.channels.length) { show('home', true); nav.focus(activeSide); return; }
    try { if (window.webOS && webOS.platformBack) { webOS.platformBack(); return; } } catch (e) {}
    try { window.close(); } catch (e) {}
  };

  function boot() {
    side = L.$('side'); sideMain = L.$('side-main'); sideFoot = L.$('side-foot'); view = L.$('view'); peek = L.$('peek');
    groupsBox = L.$('groups'); gpList = L.$('gp-list');
    nav.onFocusChange = function (f) {
      // the preview follows keyboard selection only — hovering with the pointer never changes it
      if (f._ch && PEEK_VIEWS[current] && !nav.byPointer) { setPeek(f._ch); f.classList.add('sel'); }
    };
    side.onnav = function (dir) {
      if (dir !== 'right') return false;
      if (current === 'home') return activeGroup();
      if (lastInView && view.contains(lastInView)) return lastInView;
      return view.querySelector('.f') || false;
    };
    groupsBox.onnav = function (dir) {
      if (dir === 'left') return activeSide || sideMain.firstChild;
      if (dir === 'right') return (lastInView && view.contains(lastInView) && lastInView) || firstChannel() || false;
      return false;
    };
    peek.onnav = function (dir, cur) {
      if (dir === 'left' && !cur.previousSibling) return (lastInView && view.contains(lastInView) && lastInView) || firstChannel() || false;
      return false;
    };
    L.$('main').onnav = function (dir, cur) {
      if (!view.contains(cur)) return false;
      if (dir === 'left' && !hasSide(cur, 'left')) { lastInView = cur; return leftTarget(); }
      if (dir === 'right' && PEEK_VIEWS[current] && pk.c && !hasSide(cur, 'right')) {
        lastInView = cur.classList.contains('bmk') ? cur.previousSibling : cur;
        return peek.querySelector('.btn.primary') || false;
      }
      return false;
    };
    view.addEventListener('scroll', function () {
      if (view.scrollTop + view.clientHeight > view.scrollHeight - 900) pagers.forEach(function (f) { f(); });
    }, { passive: true });
    L.player.onOpen = function () { pvStop(); };
    L.player.onClose = function () {
      var keep = nav.cur;
      if (current === 'history' || current === 'bm') { show(current, true); }
      if (keep && document.body.contains(keep)) nav.focus(keep); else { var g = firstChannel(); if (g) nav.focus(g); }
      if (pk.info) { var info = pk.info; pk.c = null; setPeek(info); }
    };
    var clk = L.$('h-clock'); clk.textContent = L.clock(); setInterval(function () { clk.textContent = L.clock(); }, 10000);

    buildSide();
    if (!D.playlists().length) { show('playlists'); return; }
    reload(false, 'home');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
