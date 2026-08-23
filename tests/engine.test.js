import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFeature, validateScope, priorityScore, rankFeatures, moscowCounts,
  scopeSummary, buildTimeline, cutlineForBudget, exportPayload, importScope,
  toggleDone, removeFeature, formatMoney, formatHours, parseISODate,
  shareEncode, shareDecode, demoScope, ScopeKitError,
} from '../js/engine.js';

const F = (over = {}) => ({
  id: 'x', name: 'Feature', type: 'should', estimate: 5, value: 5, risk: 'low',
  done: false, ...over,
});

test('normalizeFeature clamps, defaults and keeps ids', () => {
  const f = normalizeFeature({
    id: 'keep', name: 'A'.repeat(200), type: 'MUST', estimate: -4,
    value: '9.75', risk: 'HIGH', done: 1,
  });
  assert.equal(f.id, 'keep');
  assert.equal(f.name.length, 120);          // name truncated
  assert.equal(f.type, 'must');              // case-normalized
  assert.equal(f.risk, 'high');
  assert.equal(f.estimate, 0);               // negative -> 0
  assert.equal(f.value, 9.75);               // numeric strings accepted
  assert.equal(f.done, true);
});

test('validateScope reports every invalid field with i18n keys + params', () => {
  const problems = validateScope([
    { name: '', type: 'maybe', estimate: -1, value: -2, risk: 'wild' },
    { name: 'ok feature', type: 'must', estimate: 1 },
    null,
  ]);
  const keys = problems.map((p) => p.key);
  assert.ok(keys.includes('err.nameRequired'));
  assert.ok(keys.filter((k) => k === 'err.badType').length >= 1);
  assert.ok(keys.includes('err.negative'));
  assert.ok(keys.filter((k) => k === 'err.negative').length >= 2);
  assert.ok(keys.includes('err.badRisk'));
  assert.deepEqual(problems[0].params, {});        // name problem carries no params
  assert.equal(validateScope([F()]).length, 0);   // valid input -> no problems
});

test('priorityScore exact math with risk factor', () => {
  assert.equal(priorityScore({ estimate: 4, value: 10, risk: 'low' }), 3.13);   // 10*1.25/4
  assert.equal(priorityScore({ estimate: 4, value: 10, risk: 'medium' }), 2.5); // 10/4
  assert.equal(priorityScore({ estimate: 4, value: 10, risk: 'high' }), 1.88);  // 10*.75/4
});

test('rankFeatures: MoSCoW first, score second, stable on ties', () => {
  const ranked = rankFeatures([
    F({ id: 'c1', type: 'could', estimate: 1, value: 9 }),
    F({ id: 'm-low', type: 'must', estimate: 10, value: 1 }),
    F({ id: 's-high', type: 'should', estimate: 1, value: 9 }),
    F({ id: 'wont', type: 'wont' }),
    F({ id: 'must-tie-a', type: 'must', estimate: 2, value: 6 }),
    F({ id: 'must-tie-b', type: 'must', estimate: 2, value: 6 }),
  ]);
  assert.deepEqual(ranked.map((f) => f.id),
    // MoSCoW rank, then score desc (must-tie pair 3.75 > m-low 0.125), input order breaks ties
    ['must-tie-a', 'must-tie-b', 'm-low', 's-high', 'c1', 'wont']);
});

test('moscowCounts totals and percentages', () => {
  const m = moscowCounts([
    F({ type: 'must' }), F({ type: 'must' }), F({ type: 'should' }), F({ type: 'wont' }),
  ]);
  assert.equal(m.total, 4);
  assert.equal(m.counts.must, 2);
  assert.equal(m.mustPct, 50);
  assert.equal(m.shouldPct, 25);
  assert.equal(m.couldPct, 0);
  assert.equal(m.wontPct, 25);
  assert.equal(moscowCounts([]).mustPct, 0);   // empty scope -> no NaN
});

test('scopeSummary cost math and progress', () => {
  const s = scopeSummary([
    F({ estimate: 8, done: true }), F({ estimate: 12 }), F({ estimate: 5 }),
  ], 50, { currency: 'BRL' });
  assert.equal(s.totalEstimate, 25);
  assert.equal(s.doneEstimate, 8);
  assert.equal(s.remainingEstimate, 17);
  assert.equal(s.estimatedCost, 1250);
  assert.equal(s.remainingCost, 850);
  assert.equal(s.progressPct, 32);
  assert.equal(s.currency, 'BRL');
  assert.equal(scopeSummary([], 99).progressPct, 0);
});

test('buildTimeline skips weekends and sequences features', () => {
  const t = buildTimeline(
    [F({ id: 'a', estimate: 9 }), F({ id: 'b', estimate: 3 })],
    { startDate: '2026-08-24', hoursPerDay: 4 },   // Monday
  );
  assert.equal(t.totalDays, 4);                    // ceil(9/4)=3 + ceil(3/4)=1
  // b ranks first inside 'should' (higher bang-per-buck)
  assert.equal(t.items[0].id, 'b');
  assert.equal(t.items[0].start, '2026-08-24');    // Mon
  assert.equal(t.items[0].end, '2026-08-24');      // 3h fits in one day
  assert.equal(t.items[1].id, 'a');
  assert.equal(t.items[1].start, '2026-08-25');    // Tue
  assert.equal(t.items[1].end, '2026-08-27');      // 9h -> 3d
  assert.equal(t.endISO, '2026-08-27');

  const w = buildTimeline([F({ estimate: 2 })], { startDate: '2026-08-22', hoursPerDay: 8 });
  assert.equal(w.items[0].start, '2026-08-24');    // Sat -> next Monday
});

test('cutlineForBudget greedy fill in priority order', () => {
  const feats = [
    F({ id: 'big', type: 'must', estimate: 7 }),
    F({ id: 'small', type: 'should', estimate: 2 }),
    F({ id: 'huge', type: 'should', estimate: 20 }),
  ];
  const c = cutlineForBudget(feats, 10);
  assert.deepEqual(c.selected, ['big', 'small']);
  assert.deepEqual(c.deferred, ['huge']);
  assert.equal(c.usedHours, 9);
  assert.equal(cutlineForBudget(feats, 0).selected.length, 0);
});

test('exportPayload normalizes and importScope migrates v1 -> v2', () => {
  const payload = exportPayload({
    name: 'X', rate: '40', currency: 'brl',
    features: [{ name: 'A', estimate: '3.5', value: 8 }],
  });
  assert.equal(payload.app, 'scopekit');
  assert.equal(payload.version, 2);
  assert.equal(payload.rate, 40);
  assert.equal(payload.currency, 'brl'.toUpperCase());
  assert.equal(payload.features[0].estimate, 3.5);
  assert.ok(/^[A-Za-z]/.test(payload.features[0].id));

  const v1 = JSON.stringify({
    app: 'scopekit', version: 1, name: 'legacy',
    features: [
      { id: '1', name: 'Old', type: 'must', estimate: '6', value: '7' },
    ],
  });
  const migrated = importScope(v1);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.features[0].estimate, 6);   // string coerced
  assert.equal(migrated.features[0].value, 7);
  assert.equal(migrated.features[0].risk, 'low');   // default filled
});

test('importScope rejects junk with typed error', () => {
  assert.throws(() => importScope('not json'), ScopeKitError);
  assert.throws(() => importScope('{"app":"other"}'), ScopeKitError);
  try {
    importScope('{}');
    assert.fail('should have thrown');
  } catch (e) {
    assert.equal(e.code, 'err.invalidFormat');     // i18n-ready error codes
  }
});

test('toggleDone / removeFeature are pure (no input mutation)', () => {
  const list = [F({ id: 'p1', done: false }), F({ id: 'p2' })];
  const after = toggleDone(list, 'p1');
  assert.equal(list[0].done, false);               // original untouched
  assert.equal(after.find((f) => f.id === 'p1').done, true);
  const fewer = removeFeature(list, 'p1');
  assert.equal(list.length, 2);
  assert.deepEqual(fewer.map((f) => f.id), ['p2']);
});

test('formatMoney uses Intl per locale/currency', () => {
  assert.equal(formatMoney(1250, 'USD', 'en-US'), '$1,250.00');
  assert.equal(formatMoney(1250, 'BRL', 'pt-BR').replace('\u00a0', ' '), 'R$ 1.250,00');
  assert.match(formatMoney(1250, 'EUR', 'de-DE'), /1\.250,00\s*€$/);
  assert.equal(formatMoney(-3, 'USD', 'en-US'), '-$3.00');
});

test('formatHours humanizes into days+hours', () => {
  assert.equal(formatHours(0), '0h');
  assert.equal(formatHours(5.5), '5.5h');
  assert.equal(formatHours(19, 8), '2d 3h');
  assert.equal(formatHours(16, 8), '2d');
  assert.equal(formatHours(100, 6), '16d 4h');   // 100 = 16*6 + 4
});

test('parseISODate validates strictly (no JS date rollover)', () => {
  assert.equal(parseISODate('2026-02-30'), null);          // Feb 30 rolls over
  assert.equal(parseISODate('2026-13-01'), null);
  assert.equal(parseISODate('26-01-01'), null);
  assert.equal(parseISODate(null), null);
  assert.equal(parseISODate('2026-02-28').getMonth(), 1);
});

test('share round-trip is UTF-8 safe both ways', () => {
  const payload = demoScope();
  payload.name = 'Escopo ñão çedilha 日本語 🚀';
  const encoded = shareEncode(payload);
  assert.ok(!encoded.includes('+') && !encoded.includes('/') && !encoded.includes('='));
  const decoded = shareDecode(encoded);
  assert.equal(decoded.name, payload.name);
  assert.equal(decoded.features.length, payload.features.length);
  assert.equal(shareDecode('!!!garbage!!!'), null);
});

test('demo data is valid out of the box (<60s first experience)', () => {
  const demo = demoScope();
  assert.equal(validateScope(demo.features).length, 0);
  assert.ok(demo.features.length >= 8);
  assert.equal(demo.features.filter((f) => !f.done && f.type !== 'wont').length >= 4, true);
  const t = buildTimeline(demo.features, demo);
  assert.ok(t.totalDays > 0);
});
