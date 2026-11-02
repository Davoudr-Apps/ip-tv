/* Playlists, channel library, favorites, recents. */
(function () {
  var S = L.store;
  var D = L.data = { channels: [], groups: [], byUrl: {} };

  D.playlists = function () {
    var p = S.get('playlists', null);
    if (!p) { p = (L.config.defaultPlaylists || []).map(function (x, i) { return { id: 'p' + Date.now() + i, name: x.name, url: x.url, enabled: true }; }); S.set('playlists', p); }
    return p;
  };
  D.savePlaylists = function (p) { S.set('playlists', p); };
  D.addPlaylist = function (name, url) {
    var p = D.playlists();
    var pl = { id: 'p' + Date.now(), name: name || ('Playlist ' + (p.length + 1)), url: url, enabled: true };
    p.push(pl); D.savePlaylists(p); return pl;
  };
  D.removePlaylist = function (id) {
    D.savePlaylists(D.playlists().filter(function (x) { return x.id !== id; }));
    S.del('cache.' + id);
  };

  function timeout(p, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error('Timed out')); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  function fetchText(url) {
    return timeout(fetch(url, { cache: 'no-store' }), 30000).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }
  // fetch + parse one playlist; cache result. force=false uses cache when available.
  D.loadPlaylist = function (pl, force) {
    var c = S.get('cache.' + pl.id, null);
    if (c && !force) return Promise.resolve(c.items);
    return fetchText(pl.url).then(function (txt) {
      var items = L.parseM3U(txt);
      if (!items.length) throw new Error('No channels found in playlist');
      if (!S.set('cache.' + pl.id, { t: Date.now(), items: items })) S.del('cache.' + pl.id); // too big for storage: refetch next time
      pl.count = items.length; pl.updated = Date.now(); pl.error = '';
      var all = D.playlists(); for (var i = 0; i < all.length; i++) if (all[i].id === pl.id) { all[i].count = pl.count; all[i].updated = pl.updated; all[i].error = ''; }
      D.savePlaylists(all);
      return items;
    }, function (e) {
      if (c) return c.items; // keep working offline with the cached copy
      var all = D.playlists(); for (var i = 0; i < all.length; i++) if (all[i].id === pl.id) all[i].error = e.message;
      D.savePlaylists(all);
      throw e;
    });
  };

  D.build = function (force) {
    var pls = D.playlists().filter(function (p) { return p.enabled !== false; });
    var errors = [];
    return Promise.all(pls.map(function (p) {
      return D.loadPlaylist(p, force).then(function (items) { return { p: p, items: items }; }, function (e) { errors.push(p.name + ': ' + e.message); return { p: p, items: [] }; });
    })).then(function (res) {
      var ch = [], seen = {}, groups = {}, gOrder = [];
      res.forEach(function (r) {
        r.items.forEach(function (it) {
          if (seen[it.u]) return; seen[it.u] = 1;
          var c = { name: it.n, url: it.u, logo: it.l, group: it.g, id: it.i, pl: r.p.id, no: ch.length + 1 };
          ch.push(c);
          if (!groups[c.group]) { groups[c.group] = 0; gOrder.push(c.group); }
          groups[c.group]++;
        });
      });
      D.channels = ch; D.byUrl = {};
      ch.forEach(function (c) { D.byUrl[c.url] = c; });
      D.groups = gOrder.map(function (g) { return { name: g, count: groups[g] }; });
      return { errors: errors };
    });
  };

  /* favorites & recents (stored by url) */
  D.favs = function () { return S.get('favs', []); };
  D.isFav = function (c) { return D.favs().indexOf(c.url) >= 0; };
  D.toggleFav = function (c) {
    var f = D.favs(), i = f.indexOf(c.url);
    if (i >= 0) f.splice(i, 1); else f.unshift(c.url);
    S.set('favs', f); return i < 0;
  };
  D.favChannels = function () { return D.favs().map(function (u) { return D.byUrl[u]; }).filter(Boolean); };
  D.pushRecent = function (c) {
    var r = S.get('recent', []).filter(function (u) { return u !== c.url; });
    r.unshift(c.url); S.set('recent', r.slice(0, 40)); S.set('last', c.url);
  };
  D.recentChannels = function () { return S.get('recent', []).map(function (u) { return D.byUrl[u]; }).filter(Boolean); };
  /* direct stream links (Play a link) */
  D.links = function () { return S.get('links', []); };
  D.saveLink = function (name, url) {
    var l = D.links().filter(function (x) { return x.url !== url; });
    var item = { name: name || url.replace(/^https?:\/\//, '').split(/[/?#]/)[0], url: url, group: 'Direct link', logo: '', no: '', link: true, t: Date.now() };
    l.unshift(item); S.set('links', l.slice(0, 20)); return item;
  };
  D.removeLink = function (url) { S.set('links', D.links().filter(function (x) { return x.url !== url; })); };
  D.last = function () { return D.byUrl[S.get('last', '')] || D.recentChannels()[0] || null; };
  D.inGroup = function (g) { return D.channels.filter(function (c) { return c.group === g; }); };
  D.search = function (q) {
    q = q.toLowerCase().trim(); if (!q) return [];
    return D.channels.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0 || c.group.toLowerCase().indexOf(q) >= 0; });
  };
})();
/* "Bookmarks" naming (stored under the same key as the old favorites) */
(function () {
  var D = L.data;
  D.isBm = D.isFav; D.toggleBm = D.toggleFav; D.bmChannels = D.favChannels; D.bms = D.favs;
  D.groupsOf = function (list) {
    var seen = {}, out = [];
    list.forEach(function (c) { if (!seen[c.group]) { seen[c.group] = { name: c.group, count: 0 }; out.push(seen[c.group]); } seen[c.group].count++; });
    return out;
  };
  D.clearRecent = function () { L.store.del('recent'); L.store.del('last'); };
  D.clearBms = function () { L.store.set('favs', []); };
})();
