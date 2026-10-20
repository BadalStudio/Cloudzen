/* Pocket Code - a code editor for your phone. No frameworks, no build step. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var LS_KEY = 'pocketcode.v1';

  /* ================================================================
   * Sample project
   * ============================================================== */
  var SAMPLE = [
    {
      name: 'index.html',
      content:
        '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n' +
        '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
        '  <title>My First Page</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n' +
        '  <h1>Hello from Pocket Code 👋</h1>\n' +
        '  <p>Tap the button, then press ▶ to see changes.</p>\n' +
        '  <button id="btn">Click me</button>\n  <p id="out"></p>\n\n' +
        '  <script src="script.js"></script>\n</body>\n</html>\n'
    },
    {
      name: 'style.css',
      content:
        'body {\n  font-family: system-ui, sans-serif;\n  text-align: center;\n  padding: 32px 16px;\n' +
        '  background: #0f172a;\n  color: #e2e8f0;\n}\n\n' +
        'button {\n  padding: 12px 22px;\n  border: 0;\n  border-radius: 12px;\n  background: #38bdf8;\n' +
        '  color: #04121f;\n  font-size: 16px;\n  font-weight: 700;\n}\n'
    },
    {
      name: 'script.js',
      content:
        "let count = 0;\n\ndocument.getElementById('btn').addEventListener('click', () => {\n" +
        "  count++;\n  document.getElementById('out').textContent = 'Clicked ' + count + ' times';\n" +
        "  console.log('count =', count);\n});\n"
    }
  ];

  /* ================================================================
   * Language helpers
   * ============================================================== */
  var EXT_LANG = {
    html: 'html', htm: 'html', css: 'css', js: 'js', mjs: 'js', jsx: 'js', ts: 'js', tsx: 'js',
    json: 'json', py: 'py', java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp',
    md: 'md', markdown: 'md', txt: 'text'
  };
  var LANG_NAME = {
    html: 'HTML', css: 'CSS', js: 'JavaScript', json: 'JSON', py: 'Python', java: 'Java',
    c: 'C', cpp: 'C++', md: 'Markdown', text: 'Plain text'
  };
  var LANG_ICON = {
    html: '🌐', css: '🎨', js: '🟨', json: '🧾', py: '🐍', java: '☕', c: '🔧', cpp: '🔧', md: '📝', text: '📄'
  };
  var COMMENT = {
    js: ['//'], java: ['//'], c: ['//'], cpp: ['//'], py: ['#'],
    css: ['/*', '*/'], html: ['<!--', '-->']
  };

  function langOf(name) {
    var m = /\.([^.]+)$/.exec(name || '');
    return (m && EXT_LANG[m[1].toLowerCase()]) || 'text';
  }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* ================================================================
   * State (saved to localStorage)
   * ============================================================== */
  var DEFAULTS = { fontSize: 14, theme: 'dark', tabSize: 2, autoClose: true };
  var state = loadState();
  var view = {};          // per-file caret/scroll memory (not persisted)
  var saveTimer = null;

  function freshState() {
    var files = SAMPLE.map(function (f) { return { id: uid(), name: f.name, content: f.content }; });
    return { files: files, open: [files[0].id], active: files[0].id, settings: Object.assign({}, DEFAULTS) };
  }

  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY));
      if (s && Array.isArray(s.files) && s.files.length) {
        s.settings = Object.assign({}, DEFAULTS, s.settings || {});
        var ids = s.files.map(function (f) { return f.id; });
        s.open = (s.open || []).filter(function (id) { return ids.indexOf(id) !== -1; });
        if (ids.indexOf(s.active) === -1) s.active = ids[0];
        if (s.open.indexOf(s.active) === -1) s.open.push(s.active);
        return s;
      }
    } catch (e) { /* ignore corrupted data */ }
    return freshState();
  }

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save (storage full?)'); }
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }

  function cur() {
    return state.files.filter(function (f) { return f.id === state.active; })[0];
  }
  function byId(id) {
    return state.files.filter(function (f) { return f.id === id; })[0];
  }

  /* ================================================================
   * Elements
   * ============================================================== */
  var ta = $('#ta'), hl = $('#layer-hl'), ml = $('#layer-match'), gutter = $('#gutter');
  var tabsEl = $('#tabs'), statusPos = $('#st-pos'), statusInfo = $('#st-info');
  var busy = false;       // true while we insert text ourselves
  var lastLines = -1;

  /* ================================================================
   * Toast + modal
   * ============================================================== */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function ask(opts) {
    return new Promise(function (resolve) {
      var host = $('#modal');
      host.innerHTML = '';
      var card = document.createElement('div');
      card.className = 'card';
      var h = document.createElement('h3');
      h.textContent = opts.title || '';
      card.appendChild(h);
      if (opts.text) {
        var p = document.createElement('p');
        p.textContent = opts.text;
        card.appendChild(p);
      }
      var input = null;
      if (opts.input) {
        input = document.createElement('input');
        input.type = 'text';
        input.value = opts.value || '';
        input.autocapitalize = 'off';
        input.autocomplete = 'off';
        input.spellcheck = false;
        card.appendChild(input);
      }
      var row = document.createElement('div');
      row.className = 'row';
      var no = document.createElement('button');
      no.textContent = 'Cancel';
      var yes = document.createElement('button');
      yes.className = 'ok' + (opts.danger ? ' danger' : '');
      yes.textContent = opts.ok || 'OK';
      row.appendChild(no);
      row.appendChild(yes);
      card.appendChild(row);
      host.appendChild(card);
      host.hidden = false;

      function done(val) {
        host.hidden = true;
        host.innerHTML = '';
        host.onclick = null;
        resolve(val);
      }
      yes.onclick = function () { done(input ? input.value : true); };
      no.onclick = function () { done(null); };
      host.onclick = function (e) { if (e.target === host) done(null); };
      if (input) {
        input.onkeydown = function (e) { if (e.key === 'Enter') yes.onclick(); };
        setTimeout(function () { input.focus(); input.select(); }, 30);
      }
    });
  }

  /* ================================================================
   * Rendering
   * ============================================================== */
  function applySettings() {
    var s = state.settings;
    var root = document.documentElement;
    root.dataset.theme = s.theme;
    root.style.setProperty('--fs', s.fontSize + 'px');
    root.style.setProperty('--lh', Math.round(s.fontSize * 1.6) + 'px');
    root.style.setProperty('--tab', String(s.tabSize));
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = s.theme === 'dark' ? '#1b1d23' : '#eef0f4';
    $('#fs-val').textContent = s.fontSize;
    $('#tab-2').classList.toggle('on', s.tabSize === 2);
    $('#tab-4').classList.toggle('on', s.tabSize === 4);
    $('#theme-toggle').textContent = s.theme === 'dark' ? 'Dark' : 'Light';
    $('#autoclose-toggle').textContent = s.autoClose ? 'On' : 'Off';
    $('#autoclose-toggle').classList.toggle('on', s.autoClose);
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    state.open.forEach(function (id) {
      var f = byId(id);
      if (!f) return;
      var b = document.createElement('button');
      b.className = 'tab' + (id === state.active ? ' active' : '');
      b.dataset.id = id;
      b.setAttribute('role', 'tab');
      var n = document.createElement('span');
      n.className = 'name';
      n.textContent = f.name;
      var x = document.createElement('i');
      x.className = 'x';
      x.dataset.close = id;
      x.textContent = '×';
      b.appendChild(n);
      b.appendChild(x);
      tabsEl.appendChild(b);
    });
    var a = tabsEl.querySelector('.tab.active');
    if (a && a.scrollIntoView) a.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }

  function renderFileList() {
    var ul = $('#filelist');
    ul.innerHTML = '';
    state.files.forEach(function (f) {
      var li = document.createElement('li');
      li.className = f.id === state.active ? 'active' : '';
      li.dataset.id = f.id;
      li.innerHTML =
        '<button class="fname" data-act="open"><span>' + (LANG_ICON[langOf(f.name)] || '📄') +
        '</span><span class="n"></span></button>' +
        '<button class="mini" data-act="rename" aria-label="Rename">✎</button>' +
        '<button class="mini" data-act="delete" aria-label="Delete">🗑</button>';
      li.querySelector('.n').textContent = f.name;
      ul.appendChild(li);
    });
  }

  function paint() {
    var f = cur();
    var v = ta.value;
    var lang = langOf(f.name);
    var h = Highlighter.highlight(v, lang);
    if (v.charAt(v.length - 1) === '\n') h += ' ';
    hl.innerHTML = h;

    var lines = v.split('\n').length;
    if (lines !== lastLines) {
      lastLines = lines;
      var nums = new Array(lines);
      for (var i = 0; i < lines; i++) nums[i] = i + 1;
      gutter.textContent = nums.join('\n');
      gutter.style.minWidth = (String(lines).length * 0.62 * state.settings.fontSize + 18) + 'px';
    }
    paintMatches();
    updateStatus();
  }

  function updateStatus() {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    var before = v.slice(0, s);
    var ln = before.split('\n').length;
    var col = s - before.lastIndexOf('\n');
    statusPos.textContent = 'Ln ' + ln + ', Col ' + col + (e > s ? '  (' + (e - s) + ' selected)' : '');
    statusInfo.textContent = (LANG_NAME[langOf(cur().name)] || 'Plain text') + ' · ' +
      state.settings.tabSize + ' spaces';
  }

  function syncScroll() {
    var t = ta.scrollTop, l = ta.scrollLeft;
    hl.scrollTop = t; hl.scrollLeft = l;
    ml.scrollTop = t; ml.scrollLeft = l;
    gutter.scrollTop = t;
  }

  /* ================================================================
   * File switching
   * ============================================================== */
  function rememberView() {
    var f = cur();
    if (f) view[f.id] = { s: ta.selectionStart, e: ta.selectionEnd, top: ta.scrollTop, left: ta.scrollLeft };
  }

  function loadActiveIntoEditor() {
    var f = cur();
    ta.value = f.content;
    lastLines = -1;
    paint();
    var v = view[f.id];
    if (v) {
      try { ta.setSelectionRange(v.s, v.e); } catch (e) { /* ignore */ }
      ta.scrollTop = v.top; ta.scrollLeft = v.left;
    } else {
      ta.setSelectionRange(0, 0);
      ta.scrollTop = 0; ta.scrollLeft = 0;
    }
    syncScroll();
    renderTabs();
    renderFileList();
    updateStatus();
    refreshFind();
  }

  function setActive(id) {
    if (id === state.active && ta.value === cur().content) { renderTabs(); return; }
    rememberView();
    state.active = id;
    if (state.open.indexOf(id) === -1) state.open.push(id);
    loadActiveIntoEditor();
    scheduleSave();
  }

  function closeTab(id) {
    var i = state.open.indexOf(id);
    if (i === -1) return;
    rememberView();
    state.open.splice(i, 1);
    if (id === state.active) {
      var next = state.open[i] || state.open[i - 1] || state.files[0].id;
      if (state.open.indexOf(next) === -1) state.open.push(next);
      state.active = next;
      loadActiveIntoEditor();
    } else {
      renderTabs();
    }
    scheduleSave();
  }

  function uniqueName(name) {
    var exists = function (n) { return state.files.some(function (f) { return f.name === n; }); };
    if (!exists(name)) return name;
    var m = /^(.*?)(\.[^.]*)?$/.exec(name);
    var base = m[1], ext = m[2] || '', i = 2;
    while (exists(base + '-' + i + ext)) i++;
    return base + '-' + i + ext;
  }

  function addFile(name, content) {
    var f = { id: uid(), name: uniqueName(name), content: content || '' };
    state.files.push(f);
    return f;
  }

  /* ================================================================
   * Editing helpers
   * ============================================================== */
  function insert(str) {
    busy = true;
    try {
      ta.focus();
      if (!document.execCommand('insertText', false, str)) {
        var s = ta.selectionStart, e = ta.selectionEnd;
        ta.setRangeText(str, s, e, 'end');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } finally { busy = false; }
  }

  function removeSelection() {
    busy = true;
    try {
      ta.focus();
      if (!document.execCommand('delete')) {
        ta.setRangeText('', ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } finally { busy = false; }
  }

  function unit() { return new Array(state.settings.tabSize + 1).join(' '); }

  function tabKey(shift) {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e && !shift) { insert(unit()); return; }

    var ls = v.lastIndexOf('\n', s - 1) + 1;
    var le = v.indexOf('\n', e);
    if (le === -1) le = v.length;
    if (e > s && v.charAt(e - 1) === '\n') le = e - 1;

    var block = v.slice(ls, le);
    var re = new RegExp('^(?: {1,' + state.settings.tabSize + '}|\\t)');
    var out = block.split('\n').map(function (l) {
      return shift ? l.replace(re, '') : (l.length ? unit() + l : l);
    }).join('\n');
    if (out === block) return;

    ta.focus();
    ta.setSelectionRange(ls, le);
    insert(out);
    if (s === e) {
      var p = Math.max(ls, s + (out.length - block.length));
      ta.setSelectionRange(p, p);
    } else {
      ta.setSelectionRange(ls, ls + out.length);
    }
  }

  function toggleComment() {
    var f = cur(), lang = langOf(f.name), c = COMMENT[lang];
    if (!c) { toast('No comment style for this file type'); return; }
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    var ls = v.lastIndexOf('\n', s - 1) + 1;
    var le = v.indexOf('\n', e);
    if (le === -1) le = v.length;
    if (e > s && v.charAt(e - 1) === '\n') le = e - 1;
    var lines = v.slice(ls, le).split('\n');
    var open = c[0], close = c[1] || '';
    var nonEmpty = lines.filter(function (l) { return l.trim().length; });
    var allCommented = nonEmpty.length > 0 && nonEmpty.every(function (l) {
      var t = l.trim();
      return t.indexOf(open) === 0 && (!close || t.slice(-close.length) === close);
    });
    var out = lines.map(function (l) {
      if (!l.trim().length) return l;
      var ind = /^[ \t]*/.exec(l)[0], body = l.slice(ind.length);
      if (allCommented) {
        body = body.slice(open.length);
        if (body.charAt(0) === ' ') body = body.slice(1);
        if (close) {
          body = body.slice(0, body.length - close.length);
          if (body.slice(-1) === ' ') body = body.slice(0, -1);
        }
        return ind + body;
      }
      return ind + open + ' ' + body + (close ? ' ' + close : '');
    }).join('\n');
    ta.focus();
    ta.setSelectionRange(ls, le);
    insert(out);
    ta.setSelectionRange(ls, ls + out.length);
  }

  function moveCaret(delta) {
    ta.focus();
    var p = Math.max(0, Math.min(ta.value.length, ta.selectionEnd + delta));
    ta.setSelectionRange(p, p);
    updateStatus();
  }

  function moveVert(dir) {
    ta.focus();
    var v = ta.value, p = ta.selectionEnd;
    var ls = v.lastIndexOf('\n', p - 1) + 1;
    var col = p - ls, target;
    if (dir < 0) {
      if (ls === 0) { target = 0; }
      else {
        var pls = v.lastIndexOf('\n', ls - 2) + 1;
        target = Math.min(pls + col, ls - 1);
      }
    } else {
      var le = v.indexOf('\n', p);
      if (le === -1) { target = v.length; }
      else {
        var nle = v.indexOf('\n', le + 1);
        if (nle === -1) nle = v.length;
        target = Math.min(le + 1 + col, nle);
      }
    }
    ta.setSelectionRange(target, target);
    updateStatus();
  }

  function smartEnter() {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    var lang = langOf(cur().name);
    var ls = v.lastIndexOf('\n', s - 1) + 1;
    var line = v.slice(ls, s);
    var indent = /^[ \t]*/.exec(line)[0];
    var trimmed = line.replace(/\s+$/, '');
    var prev = v.charAt(s - 1), next = v.charAt(e);
    var text, back = 0;

    if (PAIRS[prev] && PAIRS[prev] === next && '([{'.indexOf(prev) !== -1) {
      text = '\n' + indent + unit() + '\n' + indent;
      back = indent.length + 1;
    } else if (lang === 'html' && prev === '>' && v.slice(e, e + 2) === '</') {
      text = '\n' + indent + unit() + '\n' + indent;
      back = indent.length + 1;
    } else if (/[{(\[]$/.test(trimmed) || (lang === 'py' && /:$/.test(trimmed))) {
      text = '\n' + indent + unit();
    } else {
      text = '\n' + indent;
    }
    insert(text);
    if (back) {
      var p = ta.selectionStart - back;
      ta.setSelectionRange(p, p);
    }
  }

  var PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
  var CLOSERS = { ')': 1, ']': 1, '}': 1, '"': 1, "'": 1, '`': 1 };
  var QUOTES = { '"': 1, "'": 1, '`': 1 };

  ta.addEventListener('beforeinput', function (e) {
    if (busy || e.isComposing) return;
    try {
      var v = ta.value, s = ta.selectionStart, en = ta.selectionEnd;

      if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
        e.preventDefault();
        smartEnter();
        return;
      }

      if (!state.settings.autoClose) return;

      if (e.inputType === 'insertText' && e.data && e.data.length === 1) {
        var ch = e.data;
        if (s !== en && PAIRS[ch]) {                 // wrap selection
          e.preventDefault();
          var sel = v.slice(s, en);
          insert(ch + sel + PAIRS[ch]);
          ta.setSelectionRange(s + 1, s + 1 + sel.length);
          return;
        }
        if (s === en) {
          var next = v.charAt(s), prev = v.charAt(s - 1);
          if (CLOSERS[ch] && next === ch) {          // type over closing char
            e.preventDefault();
            ta.setSelectionRange(s + 1, s + 1);
            return;
          }
          if (PAIRS[ch]) {
            if (QUOTES[ch] && /\w/.test(prev)) return;   // e.g. don't
            if (/\w/.test(next)) return;                 // don't pair before a word
            e.preventDefault();
            insert(ch + PAIRS[ch]);
            ta.setSelectionRange(s + 1, s + 1);
          }
        }
        return;
      }

      if (e.inputType === 'deleteContentBackward' && s === en && s > 0) {
        var p = v.charAt(s - 1);
        if (PAIRS[p] && PAIRS[p] === v.charAt(s)) {   // delete both halves of an empty pair
          e.preventDefault();
          ta.setSelectionRange(s - 1, s + 1);
          removeSelection();
        }
      }
    } catch (err) { /* never break typing */ }
  });

  ta.addEventListener('input', function () {
    cur().content = ta.value;
    paint();
    scheduleSave();
  });
  ta.addEventListener('scroll', syncScroll, { passive: true });

  ta.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Tab') { e.preventDefault(); tabKey(e.shiftKey); return; }
    if (mod && e.key === 's') { e.preventDefault(); exportFile(cur()); return; }
    if (mod && e.key === 'Enter') { e.preventDefault(); runPreview(); return; }
    if (mod && e.key === '/') { e.preventDefault(); toggleComment(); return; }
    if (mod && e.key === 'f') { e.preventDefault(); openFind(); }
  });

  document.addEventListener('selectionchange', function () {
    if (document.activeElement === ta) updateStatus();
  });

  /* ================================================================
   * Extra keys bar
   * ============================================================== */
  var KEYS = [
    { l: '⇥', t: 'Tab', f: function () { tabKey(false); }, fn: 1 },
    { l: '⇤', t: 'Outdent', f: function () { tabKey(true); }, fn: 1 },
    { l: '↶', t: 'Undo', f: function () { ta.focus(); document.execCommand('undo'); }, fn: 1 },
    { l: '↷', t: 'Redo', f: function () { ta.focus(); document.execCommand('redo'); }, fn: 1 },
    { l: '◀', t: 'Left', f: function () { moveCaret(-1); }, fn: 1 },
    { l: '▶', t: 'Right', f: function () { moveCaret(1); }, fn: 1 },
    { l: '▲', t: 'Up', f: function () { moveVert(-1); }, fn: 1 },
    { l: '▼', t: 'Down', f: function () { moveVert(1); }, fn: 1 },
    { l: '//', t: 'Comment', f: toggleComment, fn: 1 }
  ];
  '{ } ( ) [ ] < > / \\ " \' ` ; : = + - * _ ! & | # $ % ? . , ~ @ ^'.split(' ').forEach(function (c) {
    KEYS.push({ l: c, t: c, f: function () { insert(c); } });
  });

  (function buildKeys() {
    var host = $('#keys');
    KEYS.forEach(function (k, i) {
      var b = document.createElement('button');
      b.className = 'k' + (k.fn ? ' fn' : '');
      b.textContent = k.l;
      b.title = k.t;
      b.setAttribute('aria-label', k.t);
      b.dataset.i = i;
      host.appendChild(b);
    });
    // keep keyboard open: don't let the buttons steal focus from the editor
    host.addEventListener('mousedown', function (e) { e.preventDefault(); });
    host.addEventListener('click', function (e) {
      var b = e.target.closest('.k');
      if (b) KEYS[+b.dataset.i].f();
    });
  })();

  /* ================================================================
   * Find & replace
   * ============================================================== */
  var find = { q: '', cs: false, hits: [], i: -1 };
  var fq = $('#find-q'), fr = $('#find-r');

  function openFind() {
    $('#findbar').hidden = false;
    var sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    if (sel && sel.indexOf('\n') === -1) fq.value = sel;
    fq.focus();
    fq.select();
    refreshFind();
  }
  function closeFind() {
    $('#findbar').hidden = true;
    find.hits = []; find.i = -1;
    paintMatches();
    ta.focus();
  }

  function refreshFind() {
    find.q = fq.value;
    find.hits = [];
    var v = ta.value;
    if (find.q && !$('#findbar').hidden) {
      var hay = find.cs ? v : v.toLowerCase();
      var needle = find.cs ? find.q : find.q.toLowerCase();
      var from = 0, at;
      while ((at = hay.indexOf(needle, from)) !== -1 && find.hits.length < 3000) {
        find.hits.push(at);
        from = at + Math.max(1, needle.length);
      }
    }
    if (find.i >= find.hits.length) find.i = find.hits.length - 1;
    if (find.i < 0 && find.hits.length) find.i = 0;
    paintMatches();
  }

  function paintMatches() {
    var v = ta.value;
    if (!find.hits.length || $('#findbar').hidden) {
      ml.innerHTML = '';
      $('#find-count').textContent = find.q && !$('#findbar').hidden ? '0/0' : '';
      return;
    }
    var len = find.q.length, out = '', last = 0, esc = Highlighter.escape;
    for (var k = 0; k < find.hits.length; k++) {
      var at = find.hits[k];
      out += esc(v.slice(last, at)) + '<mark' + (k === find.i ? ' class="cur"' : '') + '>' +
        esc(v.substr(at, len)) + '</mark>';
      last = at + len;
    }
    out += esc(v.slice(last));
    if (v.charAt(v.length - 1) === '\n') out += ' ';
    ml.innerHTML = out;
    $('#find-count').textContent = (find.i + 1) + '/' + find.hits.length;
  }

  function charWidth() {
    var s = document.createElement('span');
    s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' +
      getComputedStyle(ta).font;
    s.textContent = 'MMMMMMMMMM';
    document.body.appendChild(s);
    var w = s.getBoundingClientRect().width / 10;
    s.remove();
    return w || 8;
  }

  function gotoHit(i) {
    if (!find.hits.length) return;
    find.i = (i + find.hits.length) % find.hits.length;
    var at = find.hits[find.i];
    ta.setSelectionRange(at, at + find.q.length);
    var before = ta.value.slice(0, at);
    var line = before.split('\n').length - 1;
    var col = at - (before.lastIndexOf('\n') + 1);
    var lh = parseFloat(getComputedStyle(ta).lineHeight) || 22;
    ta.scrollTop = Math.max(0, line * lh - ta.clientHeight / 3);
    var x = col * charWidth();
    if (x < ta.scrollLeft || x > ta.scrollLeft + ta.clientWidth - 60) {
      ta.scrollLeft = Math.max(0, x - ta.clientWidth / 2);
    }
    syncScroll();
    paintMatches();
  }

  function replaceOne() {
    if (find.i < 0 || !find.hits.length) return;
    var at = find.hits[find.i], idx = find.i;
    ta.setRangeText(fr.value, at, at + find.q.length, 'end');
    cur().content = ta.value;
    scheduleSave();
    paint();
    refreshFind();
    if (find.hits.length) gotoHit(Math.min(idx, find.hits.length - 1));
  }

  function replaceAll() {
    if (!find.q) return;
    var re = new RegExp(escapeRe(find.q), find.cs ? 'g' : 'gi');
    var n = 0, rep = fr.value;
    var out = ta.value.replace(re, function () { n++; return rep; });
    if (!n) { toast('Nothing to replace'); return; }
    ta.value = out;
    cur().content = out;
    scheduleSave();
    paint();
    refreshFind();
    toast('Replaced ' + n);
  }

  fq.addEventListener('input', function () { find.i = -1; refreshFind(); if (find.hits.length) gotoHit(0); });
  fq.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); gotoHit(find.i + (e.shiftKey ? -1 : 1)); } });
  $('#find-next').onclick = function () { gotoHit(find.i + 1); };
  $('#find-prev').onclick = function () { gotoHit(find.i - 1); };
  $('#find-close').onclick = closeFind;
  $('#find-case').onclick = function () {
    find.cs = !find.cs;
    this.classList.toggle('on', find.cs);
    refreshFind();
  };
  $('#rep-one').onclick = replaceOne;
  $('#rep-all').onclick = replaceAll;
  $('#btn-find').onclick = function () { $('#findbar').hidden ? openFind() : closeFind(); };

  /* ================================================================
   * Drawer (files + settings)
   * ============================================================== */
  function openDrawer() {
    renderFileList();
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#scrim').hidden = false;
  }
  function closeDrawer() {
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#scrim').hidden = true;
  }
  $('#btn-menu').onclick = openDrawer;
  $('#drawer-close').onclick = closeDrawer;
  $('#scrim').onclick = closeDrawer;

  tabsEl.addEventListener('click', function (e) {
    var x = e.target.closest('[data-close]');
    if (x) { closeTab(x.dataset.close); return; }
    var t = e.target.closest('.tab');
    if (t) setActive(t.dataset.id);
  });

  $('#filelist').addEventListener('click', function (e) {
    var li = e.target.closest('li');
    var btn = e.target.closest('[data-act]');
    if (!li || !btn) return;
    var id = li.dataset.id, act = btn.dataset.act;
    if (act === 'open') { setActive(id); closeDrawer(); }
    if (act === 'rename') renameFile(id);
    if (act === 'delete') deleteFile(id);
  });

  function validName(n) { return n && !/[\\/:*?"<>|]/.test(n); }

  async function newFile() {
    var name = await ask({ title: 'New file', text: 'Include the extension, e.g. app.js or page.html', input: true, value: 'untitled.html', ok: 'Create' });
    if (name === null) return;
    name = name.trim();
    if (!validName(name)) { toast('Invalid file name'); return; }
    rememberView();
    var f = addFile(name, '');
    state.active = f.id;
    state.open.push(f.id);
    loadActiveIntoEditor();
    saveNow();
    closeDrawer();
    ta.focus();
  }

  async function renameFile(id) {
    var f = byId(id);
    var name = await ask({ title: 'Rename file', input: true, value: f.name, ok: 'Rename' });
    if (name === null) return;
    name = name.trim();
    if (!validName(name)) { toast('Invalid file name'); return; }
    if (name !== f.name && state.files.some(function (x) { return x.name === name; })) { toast('That name already exists'); return; }
    f.name = name;
    saveNow();
    renderTabs();
    renderFileList();
    if (id === state.active) paint();
  }

  async function deleteFile(id) {
    var f = byId(id);
    var ok = await ask({ title: 'Delete "' + f.name + '"?', text: 'This cannot be undone.', ok: 'Delete', danger: true });
    if (!ok) return;
    rememberView();
    state.files = state.files.filter(function (x) { return x.id !== id; });
    state.open = state.open.filter(function (x) { return x !== id; });
    delete view[id];
    if (!state.files.length) {
      var n = addFile('untitled.txt', '');
      state.open = [n.id];
      state.active = n.id;
    } else if (id === state.active) {
      state.active = state.open[0] || state.files[0].id;
      if (state.open.indexOf(state.active) === -1) state.open.push(state.active);
    }
    loadActiveIntoEditor();
    saveNow();
  }

  $('#act-new').onclick = newFile;
  $('#act-open').onclick = function () { $('#file-input').click(); };
  $('#act-save').onclick = function () { closeDrawer(); exportFile(cur()); };

  $('#file-input').addEventListener('change', async function () {
    var list = Array.prototype.slice.call(this.files || []);
    this.value = '';
    if (!list.length) return;
    var added = 0, last = null;
    for (var i = 0; i < list.length; i++) {
      var file = list[i];
      if (file.size > 2 * 1024 * 1024) { toast(file.name + ' is too big (max 2 MB)'); continue; }
      var text = await file.text();
      if (text.indexOf('\u0000') !== -1) { toast(file.name + ' is not a text file'); continue; }
      last = addFile(file.name, text);
      added++;
    }
    if (last) {
      rememberView();
      state.active = last.id;
      state.open.push(last.id);
      loadActiveIntoEditor();
      saveNow();
      closeDrawer();
      toast('Opened ' + added + ' file' + (added > 1 ? 's' : ''));
    }
  });

  $('#fs-minus').onclick = function () { state.settings.fontSize = Math.max(10, state.settings.fontSize - 1); afterSettings(); };
  $('#fs-plus').onclick = function () { state.settings.fontSize = Math.min(26, state.settings.fontSize + 1); afterSettings(); };
  $('#tab-2').onclick = function () { state.settings.tabSize = 2; afterSettings(); };
  $('#tab-4').onclick = function () { state.settings.tabSize = 4; afterSettings(); };
  $('#theme-toggle').onclick = function () { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; afterSettings(); };
  $('#autoclose-toggle').onclick = function () { state.settings.autoClose = !state.settings.autoClose; afterSettings(); };
  $('#reset-project').onclick = async function () {
    var ok = await ask({ title: 'Reset to sample project?', text: 'All your files will be replaced by the 3 sample files.', ok: 'Reset', danger: true });
    if (!ok) return;
    var settings = state.settings;
    state = freshState();
    state.settings = settings;
    view = {};
    loadActiveIntoEditor();
    saveNow();
    closeDrawer();
  };
  function afterSettings() {
    applySettings();
    lastLines = -1;
    paint();
    syncScroll();
    saveNow();
  }

  /* ================================================================
   * Save / share
   * ============================================================== */
  async function exportFile(f) {
    var cap = window.Capacitor, P = cap && cap.Plugins;
    var native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
    if (native && P && P.Filesystem && P.Share) {
      try {
        var r = await P.Filesystem.writeFile({
          path: f.name, data: f.content, directory: 'CACHE', encoding: 'utf8', recursive: true
        });
        await P.Share.share({ title: f.name, url: r.uri, dialogTitle: 'Save or share ' + f.name });
        return;
      } catch (err) {
        if (/cancel/i.test(String(err && (err.message || err)))) return;
      }
    }
    var blob = new Blob([f.content], { type: 'text/plain' });
    try {
      var file = new File([blob], f.name, { type: 'text/plain' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: f.name });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    toast('Downloaded ' + f.name);
  }

  /* ================================================================
   * Run / preview
   * ============================================================== */
  var HOOK =
    '<script>(function(){function s(t,a){try{parent.postMessage({__pce:1,t:t,m:a.map(function(x){' +
    'try{return typeof x==="string"?x:(x instanceof Error?String(x):JSON.stringify(x,null,1))}catch(e){return String(x)}}).join(" ")},"*")}catch(e){}}' +
    '["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){s(k,[].slice.call(arguments));' +
    'try{o.apply(console,arguments)}catch(e){}}});' +
    'window.addEventListener("error",function(e){s("error",[e.message+(e.lineno?" (line "+e.lineno+")":"")])});' +
    'window.addEventListener("unhandledrejection",function(e){s("error",["Unhandled promise: "+e.reason])});})();<\/script>';

  function fileByName(n) {
    n = String(n).replace(/^\.?\//, '').split(/[?#]/)[0];
    return state.files.filter(function (f) { return f.name === n; })[0];
  }
  function safeScript(code) { return code.replace(/<\/script/gi, '<\\/script'); }
  function safeStyle(code) { return code.replace(/<\/style/gi, '<\\/style'); }

  function buildHtmlDoc(src) {
    var doc = src.replace(/<link\b[^>]*>/gi, function (m) {
      var h = /href\s*=\s*["']([^"']+)["']/i.exec(m);
      var f = h && fileByName(h[1]);
      if (f && /rel\s*=\s*["']?stylesheet/i.test(m)) return '<style>\n' + safeStyle(f.content) + '\n</style>';
      return m;
    });
    doc = doc.replace(/<script\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, function (m, a, src, b) {
      var f = fileByName(src);
      if (!f) return m;
      return '<script' + (a + b).replace(/\s+$/, '') + '>\n' + safeScript(f.content) + '\n<\/script>';
    });
    if (/<head[^>]*>/i.test(doc)) return doc.replace(/<head[^>]*>/i, function (m) { return m + HOOK; });
    return HOOK + doc;
  }

  function buildDoc(f) {
    var lang = langOf(f.name);
    if (lang === 'html') return { html: buildHtmlDoc(f.content), console: false };
    if (lang === 'css') {
      var page = state.files.filter(function (x) { return langOf(x.name) === 'html'; })[0];
      if (page) return { html: buildHtmlDoc(page.content), console: false, title: page.name };
      return {
        html: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
          safeStyle(f.content) + '</style><h1>Heading</h1><p>Paragraph with <a href="#">a link</a>.</p><button>Button</button>',
        console: false
      };
    }
    if (lang === 'js') {
      return {
        html: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          HOOK + '</head><body style="font-family:system-ui;padding:12px"><script>\n' + safeScript(f.content) + '\n<\/script></body></html>',
        console: true
      };
    }
    return null;
  }

  var logCount = 0;
  function clearLog() {
    logCount = 0;
    $('#pv-log').innerHTML = '<div class="empty">Console output appears here (console.log, errors…)</div>';
    $('#pv-count').textContent = '0';
  }
  function addLog(kind, msg) {
    var box = $('#pv-log');
    if (!logCount) box.innerHTML = '';
    logCount++;
    var d = document.createElement('div');
    d.className = kind;
    d.textContent = (kind === 'error' ? '✖ ' : kind === 'warn' ? '⚠ ' : '› ') + msg;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    $('#pv-count').textContent = String(logCount);
  }

  var previewFile = null;
  function runPreview() {
    var f = cur();
    var lang = langOf(f.name);
    if (lang === 'py') { toast('Python can’t run offline in this app yet'); return; }
    var d = buildDoc(f);
    if (!d) { toast('Preview works for HTML, CSS and JS files'); return; }
    previewFile = f;
    saveNow();
    clearLog();
    $('#pv-title').textContent = d.title || f.name;
    $('#pv-log').hidden = !d.console;
    $('#preview').hidden = false;
    $('#pv-frame').srcdoc = d.html;
  }
  function closePreview() {
    $('#preview').hidden = true;
    $('#pv-frame').srcdoc = '';
  }
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d.__pce || e.source !== $('#pv-frame').contentWindow) return;
    addLog(d.t, d.m);
  });
  $('#btn-run').onclick = runPreview;
  $('#pv-close').onclick = closePreview;
  $('#pv-reload').onclick = function () { if (previewFile) { closePreview(); runPreview(); } };
  $('#pv-console').onclick = function () { var l = $('#pv-log'); l.hidden = !l.hidden; };

  /* ================================================================
   * Update check (looks at the newest APK published on GitHub Releases)
   * ============================================================== */
  var REPO = 'BadalStudio/Cloudzen';   // <-- your GitHub "owner/repository"
  var BUILD = Number(window.APP_BUILD) || 0;
  $('#ver-label').textContent = BUILD ? 'Version #' + BUILD : 'Version (dev)';

  async function checkUpdate(silent) {
    if (!BUILD) { if (!silent) toast('Update check works in the installed app'); return; }
    try {
      var r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest',
        { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error('http ' + r.status);
      var j = await r.json();
      var n = parseInt(String(j.tag_name).replace(/\D/g, ''), 10) || 0;
      var asset = (j.assets || []).filter(function (x) { return /\.apk$/i.test(x.name); })[0];
      if (n > BUILD && asset) {
        var ok = await ask({ title: 'Update available', text: 'Version #' + n + ' is ready (you have #' + BUILD + '). Download and install it?', ok: 'Download' });
        if (ok) window.open(asset.browser_download_url, '_blank');
      } else if (!silent) {
        toast('You have the latest version');
      }
    } catch (e) {
      if (!silent) toast('Could not check for updates');
    }
  }
  $('#check-update').onclick = function () { checkUpdate(false); };

  /* ================================================================
   * Boot
   * ============================================================== */
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!$('#modal').hidden) return;
      if (!$('#preview').hidden) closePreview();
      else if ($('#drawer').classList.contains('open')) closeDrawer();
    }
  });
  window.addEventListener('pagehide', function () { rememberView(); saveNow(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveNow(); });

  applySettings();
  loadActiveIntoEditor();
  setTimeout(function () { checkUpdate(true); }, 4000);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) &&
      !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
