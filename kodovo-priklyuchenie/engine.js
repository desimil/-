/*
 * Кодово приключение с Роби — двигател на играта.
 * Съдържа: парсер на кратък запис на програми, генератор на карти,
 * интерпретатор на програми и броене на блокове.
 * Работи както в браузъра (window.Engine), така и в Node (за тестове).
 */
(function (root) {
  'use strict';

  // Посоки: 0 = север (нагоре), 1 = изток (надясно), 2 = юг (надолу), 3 = запад (наляво)
  var DX = [0, 1, 0, -1];
  var DY = [-1, 0, 1, 0];
  var DIR_LETTER = { N: 0, E: 1, S: 2, W: 3 };
  var MAX_W = 11, MAX_H = 11;
  var STEP_LIMIT = 600;

  // ---------- Парсер на кратък запис ----------
  // F3 = напред 3, L = наляво, R = надясно, J = скок, A/B = функция,
  // 4( ... ) = повтори 4 пъти, ?w( ... ) = ако, ?w( ... ):( ... ) = ако/иначе,
  // *f( ... ) = докато. Условия: w вода, b препятствие, f свободно напред,
  // l свободно отляво, r свободно отдясно, s има звезди.
  var COND_CODES = { w: 'water', b: 'block', f: 'free', l: 'lfree', r: 'rfree', s: 'stars' };

  function parse(src) {
    var s = src || '';
    var i = 0;
    function ws() { while (i < s.length && /\s/.test(s[i])) i++; }
    function seq() {
      var out = [];
      ws();
      while (i < s.length && s[i] !== ')') { out.push(item()); ws(); }
      return out;
    }
    function expect(ch) {
      ws();
      if (s[i] !== ch) throw new Error('Очаквах "' + ch + '" в "' + src + '" на позиция ' + i);
      i++;
    }
    function body() { expect('('); var b = seq(); expect(')'); return b; }
    function item() {
      var c = s[i];
      if (c === 'F') { i++; var n = num(); return { t: 'fwd', n: n || 1 }; }
      if (c === 'L') { i++; return { t: 'left' }; }
      if (c === 'R') { i++; return { t: 'right' }; }
      if (c === 'J') { i++; return { t: 'jump' }; }
      if (c === 'A' || c === 'B') { i++; return { t: 'call', f: c }; }
      if (c === '?' || c === '*') {
        i++;
        var cond = COND_CODES[s[i]];
        if (!cond) throw new Error('Непознато условие "' + s[i] + '" в "' + src + '"');
        i++;
        var b = body();
        if (c === '*') return { t: 'while', c: cond, body: b };
        var node = { t: 'if', c: cond, body: b, els: null };
        ws();
        if (s[i] === ':') { i++; node.els = body(); }
        return node;
      }
      if (/[0-9]/.test(c)) { var k = num(); return { t: 'rep', n: k, body: body() }; }
      throw new Error('Непознат символ "' + c + '" в "' + src + '" на позиция ' + i);
    }
    function num() {
      var st = i;
      while (i < s.length && /[0-9]/.test(s[i])) i++;
      return st === i ? 0 : parseInt(s.slice(st, i), 10);
    }
    var res = seq();
    if (i !== s.length) throw new Error('Излишна ")" в "' + src + '"');
    return res;
  }

  // ---------- Броене на блокове ----------
  function countBlocks(list) {
    var n = 0;
    (list || []).forEach(function (b) {
      n += 1;
      if (b.body) n += countBlocks(b.body);
      if (b.els) n += countBlocks(b.els);
    });
    return n;
  }
  function programSize(prog) {
    return countBlocks(prog.main) + countBlocks(prog.A) + countBlocks(prog.B);
  }

  // Кои видове блокове използва програмата (за проверка спрямо палитрата)
  function usedKinds(list, acc) {
    acc = acc || {};
    (list || []).forEach(function (b) {
      var k = b.t;
      if (b.t === 'call') k = 'call' + b.f;
      if (b.t === 'if' && b.els) k = 'ifelse';
      acc[k] = true;
      if (b.c) acc['cond:' + b.c] = true;
      usedKinds(b.body, acc);
      usedKinds(b.els, acc);
    });
    return acc;
  }

  // ---------- Генератор на случайни числа (детерминиран) ----------
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Генератор на карти ----------
  // Картата се „рисува“, като се проследи маршрутът на дадена програма:
  // клетките по пътя са трева, прескочените клетки са вода, звездите са
  // в края на всяко движение. Останалите клетки се запълват с препятствия.
  function buildMap(traceSrc, opts) {
    opts = opts || {};
    var prog = { main: parse(traceSrc), A: parse(opts.A || ''), B: parse(opts.B || '') };
    var d = DIR_LETTER[opts.dir || 'E'];
    var x = 0, y = 0;
    var kind = {};      // "x,y" -> 'p' (път) | 'w' (вода)
    var stars = {};
    var order = [];
    var starMode = opts.stars || 'ends';
    kind['0,0'] = 'p';
    var depth = 0;

    function key(a, b) { return a + ',' + b; }
    function mark(a, b, k) {
      var kk = key(a, b);
      if (kind[kk] && kind[kk] !== k) throw new Error('Конфликт в клетка ' + kk + ' при "' + traceSrc + '"');
      kind[kk] = k;
    }
    function star(a, b) {
      if (a === 0 && b === 0) return;
      var kk = key(a, b);
      if (!stars[kk]) { stars[kk] = true; order.push(kk); }
    }
    function run(list) {
      if (++depth > 30) throw new Error('Твърде дълбока рекурсия при генериране');
      list.forEach(function (b) {
        switch (b.t) {
          case 'fwd':
            for (var i = 0; i < b.n; i++) {
              x += DX[d]; y += DY[d]; mark(x, y, 'p');
              if (starMode === 'all') star(x, y);
            }
            if (starMode === 'ends') star(x, y);
            break;
          case 'jump':
            mark(x + DX[d], y + DY[d], 'w');
            x += 2 * DX[d]; y += 2 * DY[d]; mark(x, y, 'p');
            if (starMode !== 'last') star(x, y);
            break;
          case 'left': d = (d + 3) % 4; break;
          case 'right': d = (d + 1) % 4; break;
          case 'rep': for (var r = 0; r < b.n; r++) run(b.body); break;
          case 'call': run(prog[b.f]); break;
          default: throw new Error('Пътят за карта не може да съдържа условия: ' + traceSrc);
        }
      });
      depth--;
    }
    run(prog.main);
    if (starMode === 'last') star(x, y);

    var keys = Object.keys(kind);
    var minX = 0, maxX = 0, minY = 0, maxY = 0;
    keys.forEach(function (k) {
      var p = k.split(',').map(Number);
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    });
    var pw = maxX - minX + 1, ph = maxY - minY + 1;
    var w = Math.max(pw + 2, opts.minW || 5);
    var h = Math.max(ph + 2, opts.minH || 4);
    var ox = Math.floor((w - pw) / 2) - minX;
    var oy = Math.floor((h - ph) / 2) - minY;

    var rand = rng(opts.seed || 1);
    var fill = opts.fill == null ? 0.3 : opts.fill;
    var waterFill = opts.waterFill == null ? 0.06 : opts.waterFill;
    var cells = [], deco = [];
    for (var yy = 0; yy < h; yy++) {
      cells.push([]); deco.push([]);
      for (var xx = 0; xx < w; xx++) {
        var k2 = key(xx - ox, yy - oy);
        var t = 'g';
        var r1 = rand(), r2 = rand();
        if (kind[k2] === 'w') t = 'w';
        else if (!kind[k2]) {
          if (r1 < fill) t = 'r';
          else if (r1 < fill + waterFill) t = 'w';
        }
        cells[yy].push(t);
        deco[yy].push(Math.floor(r2 * 4));
      }
    }
    var st = {};
    order.forEach(function (k3) {
      var p = k3.split(',').map(Number);
      st[(p[0] + ox) + ',' + (p[1] + oy)] = true;
    });
    return { w: w, h: h, cells: cells, deco: deco, stars: st, start: { x: ox, y: oy, d: DIR_LETTER[opts.dir || 'E'] } };
  }

  // ---------- Интерпретатор ----------
  function cellAt(map, x, y) {
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return 'out';
    return map.cells[y][x];
  }

  function newState(map) {
    var s = { x: map.start.x, y: map.start.y, d: map.start.d, stars: {}, left: 0, steps: 0 };
    Object.keys(map.stars).forEach(function (k) { s.stars[k] = true; s.left++; });
    return s;
  }

  function testCond(c, map, s) {
    function ahead(dd) { return cellAt(map, s.x + DX[dd], s.y + DY[dd]); }
    switch (c) {
      case 'water': return ahead(s.d) === 'w';
      case 'block': var a = ahead(s.d); return a === 'r' || a === 'out';
      case 'free': return ahead(s.d) === 'g';
      case 'lfree': return ahead((s.d + 3) % 4) === 'g';
      case 'rfree': return ahead((s.d + 1) % 4) === 'g';
      case 'stars': return s.left > 0;
    }
    return false;
  }

  function Stop(result) { this.result = result; }

  // Генератор: подава събитие при всяко действие, за да може UI да анимира.
  function* execute(prog, map, state) {
    var s = state || newState(map);
    var depth = 0;

    function collect() {
      var k = s.x + ',' + s.y;
      if (s.stars[k]) { delete s.stars[k]; s.left--; return true; }
      return false;
    }
    function tick() {
      if (++s.steps > STEP_LIMIT) throw new Stop({ ok: false, reason: 'loop' });
    }
    function* run(list) {
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        switch (b.t) {
          case 'fwd':
            for (var k = 0; k < b.n; k++) {
              tick();
              var nx = s.x + DX[s.d], ny = s.y + DY[s.d];
              var c = cellAt(map, nx, ny);
              if (c === 'out') { yield { type: 'bump', node: b, state: s }; throw new Stop({ ok: false, reason: 'out' }); }
              if (c === 'r') { yield { type: 'bump', node: b, state: s }; throw new Stop({ ok: false, reason: 'rock' }); }
              s.x = nx; s.y = ny;
              if (c === 'w') { yield { type: 'fall', node: b, state: s }; throw new Stop({ ok: false, reason: 'water' }); }
              var got = collect();
              yield { type: 'move', node: b, state: s, collected: got };
              if (s.left === 0) throw new Stop({ ok: true });
            }
            break;
          case 'jump':
            tick();
            var ox1 = s.x + DX[s.d], oy1 = s.y + DY[s.d];
            var lx = s.x + 2 * DX[s.d], ly = s.y + 2 * DY[s.d];
            var over = cellAt(map, ox1, oy1);
            var land = cellAt(map, lx, ly);
            if (over === 'r' || over === 'out') { yield { type: 'bump', node: b, state: s }; throw new Stop({ ok: false, reason: 'highrock' }); }
            if (land === 'out') { yield { type: 'bump', node: b, state: s }; throw new Stop({ ok: false, reason: 'out' }); }
            if (land === 'r') { yield { type: 'bump', node: b, state: s }; throw new Stop({ ok: false, reason: 'landrock' }); }
            s.x = lx; s.y = ly;
            if (land === 'w') { yield { type: 'fall', node: b, state: s, jump: true }; throw new Stop({ ok: false, reason: 'water' }); }
            var got2 = collect();
            yield { type: 'jump', node: b, state: s, collected: got2 };
            if (s.left === 0) throw new Stop({ ok: true });
            break;
          case 'left':
            tick(); s.d = (s.d + 3) % 4; yield { type: 'turn', node: b, state: s }; break;
          case 'right':
            tick(); s.d = (s.d + 1) % 4; yield { type: 'turn', node: b, state: s }; break;
          case 'rep':
            for (var r = 0; r < b.n; r++) { yield { type: 'think', node: b, state: s }; yield* run(b.body); }
            break;
          case 'call':
            if (++depth > 25) throw new Stop({ ok: false, reason: 'deep' });
            yield { type: 'think', node: b, state: s };
            yield* run(prog[b.f] || []);
            depth--;
            break;
          case 'if':
            tick();
            var yes = testCond(b.c, map, s);
            yield { type: 'think', node: b, state: s, cond: yes };
            if (yes) yield* run(b.body);
            else if (b.els) yield* run(b.els);
            break;
          case 'while':
            while (true) {
              tick();
              var ok = testCond(b.c, map, s);
              yield { type: 'think', node: b, state: s, cond: ok };
              if (!ok) break;
              yield* run(b.body);
            }
            break;
        }
      }
    }

    try {
      yield* run(prog.main || []);
    } catch (e) {
      if (e instanceof Stop) return e.result;
      throw e;
    }
    if (s.left === 0) return { ok: true };
    return { ok: false, reason: 'stars', left: s.left };
  }

  function runToEnd(prog, map) {
    var g = execute(prog, map);
    var r = g.next();
    while (!r.done) r = g.next();
    return r.value;
  }

  // ---------- Сглобяване на ниво ----------
  function compileLevel(mission, li) {
    var L = mission.levels[li];
    var traces = L.v || [L.s];
    var maps = traces.map(function (tr, vi) {
      return buildMap(tr, {
        dir: L.dir, stars: L.stars, fill: L.fill != null ? L.fill : mission.fill,
        waterFill: L.waterFill != null ? L.waterFill : mission.waterFill,
        A: L.v ? '' : L.A, B: L.v ? '' : L.B,
        seed: mission.id * 1000 + li * 37 + vi * 7 + 11
      });
    });
    var sol = { main: parse(L.s), A: parse(L.A || ''), B: parse(L.B || '') };
    var start = L.st ? { main: parse(L.st), A: parse(L.stA || ''), B: parse(L.stB || '') } : null;
    return { maps: maps, solution: sol, best: programSize(sol), start: start, hint: L.h || '' };
  }

  var Engine = {
    DX: DX, DY: DY, parse: parse, buildMap: buildMap, execute: execute, runToEnd: runToEnd,
    newState: newState, testCond: testCond, countBlocks: countBlocks, programSize: programSize,
    usedKinds: usedKinds, compileLevel: compileLevel, MAX_W: MAX_W, MAX_H: MAX_H
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(this);
