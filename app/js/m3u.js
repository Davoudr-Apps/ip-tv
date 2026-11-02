/* M3U / M3U8 (extended) playlist parser. Returns [{name, url, logo, group, id}] */
(function () {
  function attr(line, key) {
    var m = line.match(new RegExp(key + '="([^"]*)"', 'i'));
    return m ? m[1].trim() : '';
  }
  L.parseM3U = function (text) {
    var lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/), out = [], meta = null, grp = '';
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln) continue;
      if (ln.indexOf('#EXTINF') === 0) {
        var comma = -1, q = false;
        for (var j = 0; j < ln.length; j++) { var c = ln.charAt(j); if (c === '"') q = !q; else if (c === ',' && !q) comma = j; }
        meta = {
          name: comma >= 0 ? ln.slice(comma + 1).trim() : '',
          logo: attr(ln, 'tvg-logo'),
          group: attr(ln, 'group-title'),
          id: attr(ln, 'tvg-id'),
          chno: attr(ln, 'tvg-chno')
        };
        if (!meta.name) meta.name = attr(ln, 'tvg-name') || 'Channel';
      } else if (ln.indexOf('#EXTGRP:') === 0) {
        grp = ln.slice(8).trim();
      } else if (ln.charAt(0) === '#') {
        continue;
      } else if (/^(https?|rtmp|rtsp|udp):\/\//i.test(ln)) {
        var m = meta || { name: ln.split('/').pop() || 'Stream', logo: '', group: '', id: '' };
        out.push({ n: m.name, u: ln, l: m.logo, g: m.group || grp || 'Other', i: m.id });
        meta = null; grp = '';
      }
    }
    return out;
  };
})();
