// Проверява, че всички 160 нива са коректни и решими.
// Стартиране: node kodovo-priklyuchenie/tests/validate.js
'use strict';
var Engine = require('../engine.js');
var Course = require('../levels.js');

var errors = 0, total = 0;
function fail(where, msg) { errors++; console.log('✗ ' + where + ': ' + msg); }

function allowed(m) {
  var ok = {};
  m.palette.forEach(function (p) { ok[p] = true; });
  if (ok.callA) ok.call = true;
  (m.conds || []).forEach(function (c) { ok['cond:' + c] = true; });
  return ok;
}

if (Course.MISSIONS.length !== 16) fail('курс', 'очаквам 16 мисии, има ' + Course.MISSIONS.length);

Course.MISSIONS.forEach(function (m) {
  if (m.levels.length !== 10) fail('мисия ' + m.id, 'очаквам 10 нива, има ' + m.levels.length);
  var ok = allowed(m);
  m.levels.forEach(function (L, li) {
    total++;
    var where = 'мисия ' + m.id + ', ниво ' + (li + 1);
    var lv;
    try { lv = Engine.compileLevel(m, li); } catch (e) { fail(where, e.message); return; }

    var kinds = Engine.usedKinds(lv.solution.main);
    Engine.usedKinds(lv.solution.A, kinds);
    Engine.usedKinds(lv.solution.B, kinds);
    Object.keys(kinds).forEach(function (k) {
      if (k === 'call') return;
      if (!ok[k]) fail(where, 'решението използва „' + k + '“, което липсва в палитрата');
    });

    lv.maps.forEach(function (map, vi) {
      var w2 = where + ' (карта ' + (vi + 1) + ')';
      if (map.w > Engine.MAX_W || map.h > Engine.MAX_H) fail(w2, 'картата е твърде голяма: ' + map.w + '×' + map.h);
      if (!Object.keys(map.stars).length) fail(w2, 'няма звезди');
      var r = Engine.runToEnd(lv.solution, map);
      if (!r.ok) fail(w2, 'решението не минава (' + r.reason + ')');
      if (lv.start) {
        var r2 = Engine.runToEnd(lv.start, map);
        if (r2.ok) fail(w2, 'началната „грешна“ програма всъщност работи');
      }
    });
    if (lv.maps.length > 1) {
      // Програмите с условия трябва да се различават реално по карти
      var sigs = lv.maps.map(function (mp) { return JSON.stringify(mp.cells) + JSON.stringify(mp.stars); });
      if (new Set(sigs).size !== sigs.length) fail(where, 'има еднакви карти');
      // Заучен маршрут за карта 1 не бива да решава всички карти
      var fixed = { main: Engine.parse(L.v[0]), A: [], B: [] };
      var all = lv.maps.every(function (mp) { return Engine.runToEnd(fixed, mp).ok; });
      if (all) fail(where, 'маршрутът на карта 1 решава всички карти — условието е излишно');
    }
  });
});

console.log('\nПроверени нива: ' + total + ', грешки: ' + errors);
process.exit(errors ? 1 : 0);
