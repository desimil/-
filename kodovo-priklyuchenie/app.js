/* Кодово приключение с Роби — интерфейс на играта. */
(function () {
  'use strict';

  var E = window.Engine;
  var MISSIONS = window.Course.MISSIONS;
  var LESSONS = window.LESSONS;
  var app = document.getElementById('app');

  var WORLDS = {
    forest: { name: 'Звездната гора', obst: ['🌳', '🪨', '🌲', '🌳'] },
    desert: { name: 'Пясъчните дюни', obst: ['🌵', '🪨', '🌴', '🌵'] },
    ice: { name: 'Ледените върхове', obst: ['🧊', '⛄', '🌲', '🧊'] },
    space: { name: 'Космическата станция', obst: ['🪨', '☄️', '🛰️', '🪐'] }
  };

  var COND_LABEL = {
    water: 'отпред има вода 🌊',
    block: 'отпред има препятствие',
    free: 'напред е свободно',
    lfree: 'отляво е свободно',
    rfree: 'отдясно е свободно',
    stars: 'има още звезди ⭐'
  };

  var PAL = {
    fwd: { label: '🦶 напред', cls: 'k-fwd', make: function () { return { t: 'fwd', n: 1 }; } },
    left: { label: '↺ наляво', cls: 'k-left', make: function () { return { t: 'left' }; } },
    right: { label: '↻ надясно', cls: 'k-right', make: function () { return { t: 'right' }; } },
    jump: { label: '🦘 скок', cls: 'k-jump', make: function () { return { t: 'jump' }; } },
    rep: { label: '🔁 повтори', cls: 'k-rep', make: function () { return { t: 'rep', n: 2, body: [] }; } },
    callA: { label: '🎵 функция А', cls: 'k-call', make: function () { return { t: 'call', f: 'A' }; } },
    callB: { label: '🎶 функция Б', cls: 'k-call', make: function () { return { t: 'call', f: 'B' }; } },
    'if': { label: '🤔 ако', cls: 'k-if', make: function (m) { return { t: 'if', c: m.conds[0], body: [], els: null }; } },
    ifelse: { label: '🔀 ако … иначе', cls: 'k-if', make: function (m) { return { t: 'if', c: m.conds[0], body: [], els: [] }; } },
    'while': { label: '⏳ докато', cls: 'k-while', make: function (m) { return { t: 'while', c: m.conds.indexOf('stars') >= 0 ? 'free' : m.conds[0], body: [] }; } }
  };

  var FAIL_TEXT = {
    out: 'Ой! Тук свършва картата. Провери посоката.',
    rock: 'Бум! Пред мен има препятствие. Трябва да го заобиколя.',
    water: 'Пляс! Паднах във водата. Може би трябваше да скоча?',
    highrock: 'Това препятствие е твърде високо за скок!',
    landrock: 'Не мога да се приземя върху препятствие.',
    loop: 'Програмата се върти твърде дълго. Дали няма безкраен цикъл?',
    deep: 'Функцията се вика сама безкрайно много пъти!'
  };

  // ---------- Запазване ----------
  var KEY = 'kodovo-priklyuchenie-v1';
  var save = { stars: {}, progs: {}, teacher: false };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) { var p = JSON.parse(raw); save.stars = p.stars || {}; save.progs = p.progs || {}; save.teacher = !!p.teacher; }
  } catch (e) { /* без запазване */ }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* няма място */ } }
  function lkey(mi, li) { return (mi + 1) + '-' + (li + 1); }
  function starsOf(mi, li) { return save.stars[lkey(mi, li)] || 0; }
  function missionStats(mi) {
    var done = 0, st = 0;
    for (var i = 0; i < 10; i++) { var s = starsOf(mi, i); if (s) done++; st += s; }
    return { done: done, stars: st };
  }
  function unlocked(mi, li) { return save.teacher || li === 0 || starsOf(mi, li - 1) > 0 || starsOf(mi, li) > 0; }

  // ---------- Помощни ----------
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function starStr(n, max) { var s = ''; for (var i = 0; i < (max || 3); i++) s += i < n ? '⭐' : '☆'; return s; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function setNav(which) {
    document.querySelectorAll('.nav button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.nav === which ? 'true' : 'false'); });
  }

  // ---------- Начален екран ----------
  function viewHome() {
    stopRun();
    setNav('home');
    app.innerHTML = '';
    var total = 0, done = 0;
    MISSIONS.forEach(function (m, mi) { var s = missionStats(mi); total += s.stars; done += s.done; });

    app.appendChild(h('section', { class: 'hero' }, [
      h('div', { class: 'face', 'aria-hidden': 'true', text: '🤖' }),
      h('div', {}, [
        h('h1', { text: 'Кодово приключение с Роби' }),
        h('p', { text: 'Курс по програмиране за 3. клас. Сглоби програма от блокове, за да помогнеш на робота Роби да събере звездите. 16 мисии по 10 нива — от първите стъпки до цикли, функции и условия.' })
      ]),
      h('div', { class: 'total' }, [
        h('div', { class: 'num', text: total + ' / 480 ⭐' }),
        h('div', { class: 'lbl', text: 'Минати нива: ' + done + ' от 160' }),
        h('div', { class: 'bar' }, [h('i', { style: 'width:' + (done / 160 * 100).toFixed(1) + '%' })])
      ])
    ]));

    app.appendChild(h('div', { class: 'howto' }, [
      h('div', {}, [h('b', { text: '1. Разгледай картата' }), 'Къде е Роби, накъде гледа стрелката и къде са звездите?']),
      h('div', {}, [h('b', { text: '2. Сглоби програма' }), 'Натискай цветните блокове. Числата в тях се сменят от падащите менюта.']),
      h('div', {}, [h('b', { text: '3. Натисни „Старт“' }), 'Събери всички звезди. По-кратка програма носи повече ⭐.'])
    ]));

    var groups = [['forest', 0, 4], ['desert', 4, 8], ['ice', 8, 12], ['space', 12, 16]];
    groups.forEach(function (g) {
      var sec = h('section', { class: 'world' }, [
        h('div', { class: 'world-h' }, [h('h2', { text: WORLDS[g[0]].name }), h('span', { text: 'Мисии ' + (g[1] + 1) + '–' + g[2] })])
      ]);
      var grid = h('div', { class: 'cards' });
      for (var mi = g[1]; mi < g[2]; mi++) grid.appendChild(missionCard(mi));
      sec.appendChild(grid);
      app.appendChild(sec);
    });
  }

  function missionCard(mi) {
    var m = MISSIONS[mi];
    var s = missionStats(mi);
    return h('button', { class: 'card', type: 'button', onclick: function () { go('mission', mi); } }, [
      h('div', { class: 'art w-' + m.world }, [h('span', { class: 'no', text: 'Мисия ' + m.id }), h('span', { 'aria-hidden': 'true', text: m.emoji })]),
      h('div', { class: 'meta' }, [
        h('b', { text: m.title }),
        h('small', { text: m.concept }),
        h('div', { class: 'prog' }, [h('span', { text: s.done + '/10 нива' }), h('span', { text: s.stars + '/30 ⭐' })])
      ])
    ]);
  }

  // ---------- Екран на мисия ----------
  function viewMission(mi) {
    stopRun();
    setNav('home');
    var m = MISSIONS[mi];
    app.innerHTML = '';
    app.appendChild(h('button', { class: 'back', type: 'button', onclick: function () { go('home'); }, text: '← Всички мисии' }));
    var chips = h('div', { class: 'chips' });
    m.palette.forEach(function (k) { chips.appendChild(h('span', { class: 'pal ' + PAL[k].cls, text: PAL[k].label })); });
    app.appendChild(h('section', { class: 'mhead' }, [
      h('div', { class: 'art w-' + m.world, 'aria-hidden': 'true', text: m.emoji }),
      h('div', {}, [
        h('div', { class: 'eyebrow', text: 'Мисия ' + m.id + ' · ' + m.concept }),
        h('h1', { text: m.title }),
        h('p', { text: m.intro }),
        chips
      ])
    ]));
    var grid = h('div', { class: 'levels' });
    for (var li = 0; li < 10; li++) {
      (function (li) {
        var st = starsOf(mi, li);
        var open = unlocked(mi, li);
        grid.appendChild(h('button', {
          class: 'lvl' + (st ? ' done' : '') + (open ? '' : ' locked'), type: 'button',
          'aria-label': 'Ниво ' + (li + 1) + (open ? '' : ' (заключено)'),
          onclick: function () { if (open) go('level', mi, li); }
        }, [h('b', { text: String(li + 1) }), h('span', { class: 'st', text: open ? starStr(st) : '🔒' })]));
      })(li);
    }
    app.appendChild(grid);
  }

  // ---------- Екран на ниво ----------
  var L = null; // текущото ниво

  function viewLevel(mi, li) {
    stopRun();
    setNav('home');
    var m = MISSIONS[mi];
    var lv = E.compileLevel(m, li);
    var saved = save.progs[lkey(mi, li)];
    var prog = saved ? clone(saved) : (lv.start ? clone(lv.start) : { main: [], A: [], B: [] });
    L = { mi: mi, li: li, m: m, lv: lv, prog: prog, active: prog.main, variant: 0, state: null, showCode: false };
    renderLevel();
  }

  function hasFn(f) { return L.m.palette.indexOf('call' + f) >= 0; }

  function renderLevel() {
    var m = L.m;
    app.innerHTML = '';
    app.appendChild(h('button', { class: 'back', type: 'button', onclick: function () { go('mission', L.mi); }, text: '← Мисия ' + m.id + ': ' + m.title }));

    var play = h('div', { class: 'play' });
    // Лява колона: карта
    var left = h('section', { class: 'panel', 'aria-label': 'Карта' });
    left.appendChild(h('div', { class: 'lhead' }, [
      h('h1', { text: 'Ниво ' + (L.li + 1) + ' от 10' }),
      h('span', { class: 'count', id: 'count' })
    ]));
    if (L.lv.maps.length > 1) {
      var tabs = h('div', { class: 'tabs' }, [h('span', { class: 'note', text: 'Програмата трябва да работи на:' })]);
      L.lv.maps.forEach(function (_, vi) {
        tabs.appendChild(h('button', { type: 'button', 'aria-pressed': vi === L.variant ? 'true' : 'false', onclick: function () { if (!running) { L.variant = vi; renderLevel(); } }, text: 'Карта ' + (vi + 1) }));
      });
      left.appendChild(tabs);
    }
    left.appendChild(h('div', { class: 'boardwrap' }, [h('div', { class: 'board th-' + m.world, id: 'board' })]));
    left.appendChild(h('div', { class: 'say' }, [
      h('span', { class: 'who', 'aria-hidden': 'true', text: '🤖' }),
      h('div', { class: 'bubble', id: 'bubble', 'aria-live': 'polite' })
    ]));
    var speed = h('select', { id: 'speed', 'aria-label': 'Скорост' }, [
      h('option', { value: '650', text: 'бавно' }), h('option', { value: '380', text: 'нормално' }), h('option', { value: '150', text: 'бързо' })
    ]);
    speed.value = String(speedMs);
    speed.addEventListener('change', function () { speedMs = +speed.value; });
    left.appendChild(h('div', { class: 'controls' }, [
      h('button', { class: 'btn run', type: 'button', id: 'run', onclick: runProgram, text: '▶ Старт' }),
      h('button', { class: 'btn', type: 'button', id: 'reset', onclick: function () { stopRun(); drawBoard(); say(introText()); }, text: '↺ Отначало' }),
      h('button', { class: 'btn', type: 'button', onclick: function () { say('💡 ' + (L.lv.hint || m.hint)); }, text: '💡 Подсказка' }),
      save.teacher ? h('button', { class: 'btn', type: 'button', onclick: showSolution, text: '🔑 Решение' }) : null,
      h('label', { class: 'speed', 'for': 'speed' }, ['Скорост', speed])
    ]));

    // Дясна колона: блокове
    var right = h('section', { class: 'panel', 'aria-label': 'Програма' });
    var pal = h('div', { class: 'palette', id: 'palette' });
    m.palette.forEach(function (k) {
      var b = h('button', { class: 'pal ' + PAL[k].cls, type: 'button', draggable: 'true', text: PAL[k].label, onclick: function () { addBlock(k); } });
      b.addEventListener('dragstart', function (ev) { ev.dataTransfer.setData('text/plain', k); });
      pal.appendChild(b);
    });
    right.appendChild(pal);
    right.appendChild(h('div', { class: 'progs', id: 'progs' }));
    right.appendChild(h('div', { class: 'controls' }, [
      h('button', { class: 'btn', type: 'button', onclick: clearProgram, text: '🗑 Изчисти' }),
      h('button', { class: 'btn', type: 'button', onclick: function () { L.showCode = !L.showCode; renderProgs(); }, text: '📜 Код' })
    ]));
    play.appendChild(left);
    play.appendChild(right);
    app.appendChild(play);

    drawBoard();
    renderProgs();
    say(introText());
  }

  function introText() {
    if (L.lv.start) return 'Тази програма има грешка 🐞. Пусни я и я поправи!';
    if (L.li === 0) return L.m.intro;
    if (L.lv.maps.length > 1) return 'Внимание: картите са ' + L.lv.maps.length + '. Една програма трябва да ги реши всичките!';
    var n = Object.keys(L.lv.maps[L.variant].stars).length;
    return 'Събери ' + (n === 1 ? 'звездата' : 'всички ' + n + ' звезди') + '! За 3 ⭐ използвай най-много ' + L.lv.best + ' блока.';
  }

  function say(text, kind) {
    var b = document.getElementById('bubble');
    if (!b) return;
    b.textContent = text;
    b.className = 'bubble' + (kind ? ' ' + kind : '');
  }

  // ---------- Карта ----------
  var cellPx = 48;
  function drawBoard(map) {
    map = map || L.lv.maps[L.variant];
    var board = document.getElementById('board');
    if (!board) return;
    var wrap = board.parentNode;
    var avail = Math.max(240, wrap.clientWidth || 480);
    cellPx = Math.max(26, Math.min(58, Math.floor(avail / map.w)));
    board.innerHTML = '';
    board.style.width = map.w * cellPx + 'px';
    board.style.height = map.h * cellPx + 'px';
    var obst = WORLDS[L.m.world].obst;
    var fs = Math.round(cellPx * 0.62) + 'px';
    for (var y = 0; y < map.h; y++) {
      for (var x = 0; x < map.w; x++) {
        var t = map.cells[y][x];
        var c = h('div', { class: 'cell ' + t + ((x + y) % 2 ? ' alt' : '') });
        c.style.cssText = 'left:' + x * cellPx + 'px;top:' + y * cellPx + 'px;width:' + cellPx + 'px;height:' + cellPx + 'px;font-size:' + fs;
        if (t === 'r') c.textContent = obst[map.deco[y][x]];
        if (t === 'w') c.textContent = map.deco[y][x] === 0 ? '🌊' : '';
        board.appendChild(c);
      }
    }
    Object.keys(map.stars).forEach(function (k) {
      var p = k.split(',').map(Number);
      var s = h('div', { class: 'star', 'data-k': k, text: '⭐' });
      s.style.cssText = 'left:' + p[0] * cellPx + 'px;top:' + p[1] * cellPx + 'px;width:' + cellPx + 'px;height:' + cellPx + 'px;font-size:' + Math.round(cellPx * 0.55) + 'px';
      board.appendChild(s);
    });
    var hero = h('div', { class: 'hero-bot', id: 'hero' }, [h('div', { class: 'dir', id: 'herodir' }), h('span', { class: 'em', text: '🤖' })]);
    hero.style.width = hero.style.height = cellPx + 'px';
    hero.querySelector('.em').style.fontSize = Math.round(cellPx * 0.66) + 'px';
    board.appendChild(hero);
    placeHero(map.start.x, map.start.y, map.start.d, true);
  }

  var heroTurns = 0; // натрупан ъгъл, за да се върти плавно
  function placeHero(x, y, d, instant) {
    var hero = document.getElementById('hero');
    if (!hero) return;
    if (instant) { heroTurns = d; hero.style.transition = 'none'; }
    else {
      var cur = ((heroTurns % 4) + 4) % 4;
      var diff = (d - cur + 4) % 4;
      heroTurns += diff === 3 ? -1 : diff;
    }
    hero.style.left = x * cellPx + 'px';
    hero.style.top = y * cellPx + 'px';
    document.getElementById('herodir').style.transform = 'rotate(' + heroTurns * 90 + 'deg)';
    if (instant) { void hero.offsetWidth; hero.style.transition = ''; }
  }
  function heroAnim(cls) {
    var hero = document.getElementById('hero');
    if (!hero) return;
    hero.classList.remove('hop', 'ouch');
    void hero.offsetWidth;
    hero.classList.add(cls);
  }

  // ---------- Редактор на програмата ----------
  var uid = 0;
  var nodeEls = new Map();

  function renderProgs() {
    var box = document.getElementById('progs');
    if (!box) return;
    if (!containsList(L.active)) L.active = L.prog.main;
    nodeEls = new Map();
    box.innerHTML = '';
    box.appendChild(h('div', {}, [h('h3', { text: '▶ Програма' }), slot(L.prog.main)]));
    if (hasFn('A')) box.appendChild(h('div', {}, [h('h3', {}, ['🎵 Функция А ', h('small', { text: 'стъпките, които прави блокът „функция А“' })]), slot(L.prog.A)]));
    if (hasFn('B')) box.appendChild(h('div', {}, [h('h3', {}, ['🎶 Функция Б ', h('small', { text: 'стъпките, които прави блокът „функция Б“' })]), slot(L.prog.B)]));
    if (L.showCode) box.appendChild(h('div', { class: 'code', text: codeText() }));
    var size = E.programSize(L.prog);
    var c = document.getElementById('count');
    if (c) c.textContent = 'Блокове: ' + size + ' · за ⭐⭐⭐ ≤ ' + L.lv.best;
    save.progs[lkey(L.mi, L.li)] = L.prog;
    persist();
  }

  function containsList(list) {
    var found = false;
    function walk(arr) {
      if (arr === list) found = true;
      arr.forEach(function (b) { if (b.body) walk(b.body); if (b.els) walk(b.els); });
    }
    walk(L.prog.main); walk(L.prog.A); walk(L.prog.B);
    return found;
  }

  function slot(list) {
    var el = h('div', { class: 'slot' + (list === L.active ? ' active' : ''), tabindex: '0', role: 'group' });
    el.addEventListener('click', function (ev) {
      if (running) return;
      if (ev.target === el || ev.target.classList.contains('here')) { ev.stopPropagation(); L.active = list; renderProgs(); }
    });
    el.addEventListener('keydown', function (ev) {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === el) { ev.preventDefault(); L.active = list; renderProgs(); }
    });
    el.addEventListener('dragover', function (ev) { ev.preventDefault(); ev.stopPropagation(); el.classList.add('over'); });
    el.addEventListener('dragleave', function () { el.classList.remove('over'); });
    el.addEventListener('drop', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      var k = ev.dataTransfer.getData('text/plain');
      if (PAL[k]) { L.active = list; addBlock(k); }
    });
    list.forEach(function (b, i) { el.appendChild(blockEl(b, list, i)); });
    el.appendChild(h('button', {
      class: 'here', type: 'button',
      text: list === L.active ? '➕ новите блокове идват тук' : (list.length ? '＋ добави тук' : '＋ празно — натисни, за да добавяш тук')
    }));
    return el;
  }

  function numSelect(val, from, to, onch) {
    var s = h('select', { 'aria-label': 'Число' });
    for (var i = from; i <= to; i++) s.appendChild(h('option', { value: String(i), text: String(i) }));
    s.value = String(val);
    s.addEventListener('change', function () { onch(+s.value); });
    s.addEventListener('click', function (e) { e.stopPropagation(); });
    return s;
  }
  function condSelect(b) {
    var s = h('select', { 'aria-label': 'Условие' });
    (L.m.conds || []).forEach(function (c) { s.appendChild(h('option', { value: c, text: COND_LABEL[c] })); });
    s.value = b.c;
    s.addEventListener('change', function () { b.c = s.value; renderProgs(); });
    s.addEventListener('click', function (e) { e.stopPropagation(); });
    return s;
  }

  function blockEl(b, list, i) {
    var kind = b.t === 'call' ? 'call' : b.t;
    var row = h('div', { class: 'row' });
    switch (b.t) {
      case 'fwd': row.appendChild(h('span', { class: 'lab', text: '🦶 напред' })); row.appendChild(numSelect(b.n, 1, 9, function (v) { b.n = v; renderProgs(); })); break;
      case 'left': row.appendChild(h('span', { class: 'lab', text: '↺ наляво' })); break;
      case 'right': row.appendChild(h('span', { class: 'lab', text: '↻ надясно' })); break;
      case 'jump': row.appendChild(h('span', { class: 'lab', text: '🦘 скок' })); break;
      case 'call': row.appendChild(h('span', { class: 'lab', text: b.f === 'A' ? '🎵 функция А' : '🎶 функция Б' })); break;
      case 'rep':
        row.appendChild(h('span', { class: 'lab', text: '🔁 повтори' }));
        row.appendChild(numSelect(b.n, 2, 12, function (v) { b.n = v; renderProgs(); }));
        row.appendChild(h('span', { class: 'lab', text: 'пъти' }));
        break;
      case 'if': row.appendChild(h('span', { class: 'lab', text: '🤔 ако' })); row.appendChild(condSelect(b)); break;
      case 'while': row.appendChild(h('span', { class: 'lab', text: '⏳ докато' })); row.appendChild(condSelect(b)); break;
    }
    function tool(txt, label, fn) {
      return h('button', { type: 'button', 'aria-label': label, title: label, text: txt, onclick: function (e) { e.stopPropagation(); if (!running) fn(); } });
    }
    row.appendChild(h('span', { class: 'tools' }, [
      tool('▲', 'Премести нагоре', function () { if (i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); renderProgs(); } }),
      tool('▼', 'Премести надолу', function () { if (i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); renderProgs(); } }),
      tool('✖', 'Изтрий блока', function () { list.splice(i, 1); renderProgs(); })
    ]));
    var el = h('div', { class: 'blk k-' + kind }, [row]);
    if (b.body) el.appendChild(h('div', { class: 'inner' }, [slot(b.body)]));
    if (b.els) {
      el.appendChild(h('div', { class: 'elselab', text: 'иначе' }));
      el.appendChild(h('div', { class: 'inner' }, [slot(b.els)]));
    }
    nodeEls.set(b, el);
    return el;
  }

  function addBlock(k) {
    if (running) return;
    var b = PAL[k].make(L.m);
    L.active.push(b);
    if (b.body) L.active = b.body;
    renderProgs();
  }

  function clearProgram() {
    if (running) return;
    L.prog = { main: [], A: [], B: [] };
    L.active = L.prog.main;
    renderProgs();
    drawBoard();
    say('Програмата е изчистена. Започни отначало!');
  }

  function showSolution() {
    if (running) return;
    L.prog = clone(L.lv.solution);
    L.active = L.prog.main;
    renderProgs();
    say('🔑 Това е най-краткото решение (' + L.lv.best + ' блока).');
  }

  function codeText() {
    var out = [];
    function line(d, s) { out.push(new Array(d + 1).join('    ') + s); }
    function walk(list, d) {
      if (!list.length) line(d, '(празно)');
      list.forEach(function (b) {
        switch (b.t) {
          case 'fwd': line(d, 'напред(' + b.n + ')'); break;
          case 'left': line(d, 'наляво()'); break;
          case 'right': line(d, 'надясно()'); break;
          case 'jump': line(d, 'скок()'); break;
          case 'call': line(d, 'функция_' + (b.f === 'A' ? 'А' : 'Б') + '()'); break;
          case 'rep': line(d, 'повтори ' + b.n + ' пъти:'); walk(b.body, d + 1); break;
          case 'if':
            line(d, 'ако ' + COND_LABEL[b.c].replace(/ [^\wа-я]+$/i, '') + ':'); walk(b.body, d + 1);
            if (b.els) { line(d, 'иначе:'); walk(b.els, d + 1); }
            break;
          case 'while': line(d, 'докато ' + COND_LABEL[b.c].replace(/ [^\wа-я]+$/i, '') + ':'); walk(b.body, d + 1); break;
        }
      });
    }
    if (hasFn('A') && L.prog.A.length) { out.push('функция_А:'); walk(L.prog.A, 1); out.push(''); }
    if (hasFn('B') && L.prog.B.length) { out.push('функция_Б:'); walk(L.prog.B, 1); out.push(''); }
    walk(L.prog.main, 0);
    return out.join('\n');
  }

  // ---------- Изпълнение ----------
  var running = false, runToken = 0, speedMs = 380;

  function stopRun() {
    running = false;
    runToken++;
    document.querySelectorAll('.blk.running, .blk.err').forEach(function (e) { e.classList.remove('running', 'err'); });
    var r = document.getElementById('run');
    if (r) r.disabled = false;
  }

  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function mark(node, cls) {
    document.querySelectorAll('.blk.running').forEach(function (e) { e.classList.remove('running'); });
    var el = node && nodeEls.get(node);
    if (el) el.classList.add(cls || 'running');
  }

  async function runProgram() {
    if (running) return;
    if (!E.programSize(L.prog)) { say('Първо добави блокове в програмата!', 'bad'); return; }
    stopRun();
    running = true;
    var token = runToken;
    document.getElementById('run').disabled = true;
    var maps = L.lv.maps;
    var order = maps.map(function (_, i) { return i; });
    // Започваме с картата, която ученикът гледа
    order.splice(order.indexOf(L.variant), 1); order.unshift(L.variant);

    for (var oi = 0; oi < order.length; oi++) {
      var vi = order[oi];
      if (maps.length > 1) {
        L.variant = vi;
        document.querySelectorAll('.tabs button').forEach(function (b, i) { b.setAttribute('aria-pressed', i === vi ? 'true' : 'false'); });
        say('Проверявам карта ' + (vi + 1) + '…');
      } else say('Изпълнявам…');
      drawBoard(maps[vi]);
      await wait(300);
      var res = await animateRun(maps[vi], token);
      if (token !== runToken) return;
      if (!res.ok) {
        var msg = res.reason === 'stars'
          ? 'Програмата свърши, но ' + (res.left === 1 ? 'остана 1 звезда' : 'останаха ' + res.left + ' звезди') + '.'
          : FAIL_TEXT[res.reason];
        if (maps.length > 1) msg = 'Карта ' + (vi + 1) + ': ' + msg;
        say(msg, 'bad');
        running = false;
        document.getElementById('run').disabled = false;
        return;
      }
      if (oi < order.length - 1) { say('Карта ' + (vi + 1) + ' ✓'); await wait(600); }
      if (token !== runToken) return;
    }
    running = false;
    document.getElementById('run').disabled = false;
    mark(null);
    win();
  }

  async function animateRun(map, token) {
    var gen = E.execute(L.prog, map);
    var lastNode = null;
    while (true) {
      var r;
      try { r = gen.next(); } catch (e) { return { ok: false, reason: 'loop' }; }
      if (token !== runToken) return { ok: false, reason: 'stopped' };
      if (r.done) {
        if (!r.value.ok && lastNode) mark(lastNode, 'err');
        return r.value;
      }
      var ev = r.value, s = ev.state;
      lastNode = ev.node;
      mark(ev.node);
      if (ev.type === 'think') { await wait(speedMs * 0.35); continue; }
      placeHero(s.x, s.y, s.d);
      if (ev.type === 'jump') heroAnim('hop');
      if (ev.type === 'bump' || ev.type === 'fall') heroAnim('ouch');
      if (ev.collected) {
        var st = document.querySelector('.star[data-k="' + s.x + ',' + s.y + '"]');
        if (st) st.classList.add('got');
      }
      await wait(speedMs);
    }
  }

  function win() {
    var size = E.programSize(L.prog);
    var best = L.lv.best;
    var stars = size <= best ? 3 : size <= best + 3 ? 2 : 1;
    var k = lkey(L.mi, L.li);
    save.stars[k] = Math.max(save.stars[k] || 0, stars);
    persist();
    say('Ура! Всички звезди са мои! 🎉', 'good');
    document.getElementById('modal-stars').textContent = starStr(stars);
    document.getElementById('modal-title').textContent = stars === 3 ? 'Отлично!' : stars === 2 ? 'Много добре!' : 'Браво, успя!';
    document.getElementById('modal-text').textContent = 'Твоята програма има ' + size + ' блока. ' +
      (stars === 3 ? 'Това е най-краткото решение!' : 'Може и с ' + best + ' — опитай да я съкратиш за повече звезди.');
    var last = L.li === 9;
    document.getElementById('modal-next').textContent = last ? (L.mi === 15 ? 'Към всички мисии 🏆' : 'Следваща мисия ➜') : 'Следващо ниво ➜';
    document.getElementById('modal').hidden = false;
    document.getElementById('modal-next').focus();
  }

  document.getElementById('modal-again').addEventListener('click', function () {
    document.getElementById('modal').hidden = true;
    drawBoard();
  });
  document.getElementById('modal-next').addEventListener('click', function () {
    document.getElementById('modal').hidden = true;
    if (L.li < 9) go('level', L.mi, L.li + 1);
    else if (L.mi < 15) go('mission', L.mi + 1);
    else go('home');
  });

  // ---------- Учителски ресурси ----------
  function viewTeacher() {
    stopRun();
    setNav('teacher');
    app.innerHTML = '';
    var wrap = h('div', { class: 'teach' });

    var teacherBox = h('input', { type: 'checkbox', id: 'teacher-mode' });
    teacherBox.checked = save.teacher;
    teacherBox.addEventListener('change', function () { save.teacher = teacherBox.checked; persist(); });
    var resetBtn = h('button', { class: 'btn', type: 'button', id: 'reset-progress', text: 'Изтрий прогреса на това устройство' });
    var confirmRow = h('span', { class: 'settings', hidden: true }, [
      h('span', { text: 'Сигурни ли сте? Всички звезди и програми ще изчезнат.' }),
      h('button', { class: 'btn', type: 'button', text: 'Да, изтрий', onclick: function () { save.stars = {}; save.progs = {}; persist(); viewTeacher(); } }),
      h('button', { class: 'btn', type: 'button', text: 'Отказ', onclick: function () { confirmRow.hidden = true; resetBtn.hidden = false; } })
    ]);
    resetBtn.addEventListener('click', function () { resetBtn.hidden = true; confirmRow.hidden = false; });

    wrap.appendChild(h('section', { class: 'intro' }, [
      h('div', { class: 'eyebrow', text: 'Учителски ресурси' }),
      h('h1', { text: 'Курс по програмиране за 3. клас' }),
      h('p', { text: '16 мисии × 10 нива = 160 задачи. Всяка мисия е за един учебен час от 40 минути и въвежда едно ново понятие. Учениците програмират с блокове, без да пишат текст, а бутонът „📜 Код“ показва програмата като текстов код.' }),
      h('p', { text: 'Звездите насърчават кратки програми: 3 ⭐ при най-краткото решение, 2 ⭐ при до 3 блока повече, 1 ⭐ за всяко вярно решение. Прогресът се пази в браузъра на устройството.' }),
      h('div', { class: 'settings' }, [
        h('label', { class: 'chip', 'for': 'teacher-mode' }, [teacherBox, 'Учителски режим: отключи всички нива и покажи бутон „🔑 Решение“']),
        resetBtn, confirmRow
      ])
    ]));

    var table = h('table', {}, [h('thead', {}, [h('tr', {}, [
      h('th', { text: '№' }), h('th', { text: 'Мисия' }), h('th', { text: 'Ново понятие' }), h('th', { text: 'Блокове' }), h('th', { text: 'Свят' })
    ])])]);
    var tb = h('tbody');
    MISSIONS.forEach(function (m) {
      tb.appendChild(h('tr', {}, [
        h('td', { class: 'n', text: String(m.id) }), h('td', { text: m.emoji + ' ' + m.title }), h('td', { text: m.concept }),
        h('td', { text: m.palette.map(function (k) { return PAL[k].label.replace(/^\S+ /, ''); }).join(', ') }),
        h('td', { text: WORLDS[m.world].name })
      ]));
    });
    table.appendChild(tb);
    wrap.appendChild(h('section', { class: 'intro' }, [h('h2', { text: 'Структура на курса' }), h('div', { class: 'tablewrap' }, [table])]));

    var plans = h('div', { class: 'plans' }, [h('h2', { text: 'Планове на уроците' })]);
    MISSIONS.forEach(function (m, mi) {
      var Ls = LESSONS[mi];
      var list = function (arr) { return h('ul', {}, arr.map(function (x) { return h('li', { text: x }); })); };
      plans.appendChild(h('details', { class: 'plan' }, [
        h('summary', {}, [h('span', { 'aria-hidden': 'true', text: m.emoji }), 'Урок ' + m.id + '. ' + m.title, h('span', { class: 'tag', text: m.concept })]),
        h('div', { class: 'plan-body' }, [
          h('div', {}, [h('h4', { text: 'Цели' }), list(Ls.goals)]),
          h('div', {}, [h('h4', { text: 'Нови понятия' }), h('p', { text: Ls.terms.join(' · ') })]),
          h('div', {}, [h('h4', { text: 'Загрявка без компютър · 8 мин' }), h('p', { text: Ls.warmup })]),
          h('div', {}, [h('h4', { text: 'Въвеждане · 7 мин' }), h('p', { text: m.intro })]),
          h('div', {}, [h('h4', { text: 'Игра · 20 мин' }), h('p', { text: Ls.play })]),
          h('div', {}, [h('h4', { text: 'Обсъждане · 5 мин' }), list(Ls.discuss)]),
          h('div', {}, [h('h4', { text: 'Връзка с живота' }), h('p', { text: Ls.life })]),
          h('div', {}, [h('h4', { text: 'Ход на урока' }), h('div', { class: 'timeline' }, [h('span', { text: 'Загрявка 8′' }), h('span', { text: 'Въвеждане 7′' }), h('span', { text: 'Игра 20′' }), h('span', { text: 'Обсъждане 5′' })]),
            h('p', { style: 'margin-top:8px' }, [h('button', { class: 'btn', type: 'button', text: 'Отвори мисия ' + m.id + ' ➜', onclick: function () { go('mission', mi); } })])])
        ])
      ]));
    });
    wrap.appendChild(plans);
    app.appendChild(wrap);
  }

  // ---------- Навигация ----------
  function go(view, a, b) {
    document.getElementById('modal').hidden = true;
    if (view === 'home') viewHome();
    else if (view === 'mission') viewMission(a);
    else if (view === 'level') viewLevel(a, b);
    else if (view === 'teacher') viewTeacher();
    window.scrollTo(0, 0);
  }
  document.getElementById('brand').addEventListener('click', function () { go('home'); });
  document.querySelectorAll('.nav button').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.nav); }); });

  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (L && document.getElementById('board') && !running) drawBoard(); }, 150);
  });

  if (location.hash === '#teacher') go('teacher'); else go('home');
})();
