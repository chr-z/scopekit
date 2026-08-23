/* ScopeKit — scope planning engine (zero dependencies).
   Pure functions only: same input => same output. All dates ISO YYYY-MM-DD. */

export class ScopeKitError extends Error {
  constructor(code, params) {
    super(code);
    this.name = 'ScopeKitError';
    this.code = code;
    this.params = params || {};
  }
}

const TYPES = ['must', 'should', 'could', 'wont'];
const RISKS = ['low', 'medium', 'high'];
const TYPE_RANK = { must: 0, should: 1, could: 2, wont: 3 };
const RISK_FACTOR = { low: 1.25, medium: 1, high: 0.75 };
export const EXPORT_VERSION = 2;

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clampNum = (v, min, max) => Math.min(max, Math.max(min, num(v, min)));
const round2 = (n) => Math.round(n * 100) / 100;

let idCounter = 0;
export function genId() {
  idCounter += 1;
  return 'f' + Date.now().toString(36) + idCounter.toString(36) +
    Math.floor(Math.random() * 1296).toString(36);
}

/* ---------- normalization & validation ---------- */

export function normalizeFeature(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const type = String(raw.type || 'should').toLowerCase();
  const risk = String(raw.risk || 'low').toLowerCase();
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : genId(),
    name: String(raw.name || '').slice(0, 120),
    type: TYPES.includes(type) ? type : 'should',
    estimate: round2(clampNum(num(raw.estimate, 0), 0, 10000)),
    value: round2(clampNum(num(raw.value, 0), 0, 100)),
    risk: RISKS.includes(risk) ? risk : 'low',
    done: Boolean(raw.done),
  };
}

export function validateScope(features) {
  const problems = [];
  (Array.isArray(features) ? features : []).forEach((f, i) => {
    if (!f || typeof f !== 'object') {
      problems.push({ index: i, key: 'err.invalidFeature', params: {} });
      return;
    }
    if (!String(f.name || '').trim())
      problems.push({ index: i, key: 'err.nameRequired', params: {} });
    if (!TYPES.includes(String(f.type || '').toLowerCase()))
      problems.push({ index: i, key: 'err.badType', params: { value: f && f.type } });
    if (!(num(f.estimate, -1) >= 0))
      problems.push({ index: i, key: 'err.negative', params: { field: 'estimate' } });
    if (!(num(f.value, -1) >= 0))
      problems.push({ index: i, key: 'err.negative', params: { field: 'value' } });
    if (!RISKS.includes(String(f.risk || '').toLowerCase()))
      problems.push({ index: i, key: 'err.badRisk', params: { value: f && f.risk } });
  });
  return problems;
}

/* ---------- prioritization ---------- */

/** Bang-per-buck with risk discount: (value * riskFactor) / effort. */
export function priorityScore(f) {
  const effort = Math.max(num(f.estimate, 0), 0.5);
  const rf = RISK_FACTOR[f.risk] ?? 1;
  return round2((num(f.value, 0) * rf) / effort);
}

/** MoSCoW first (wont always last), then score desc; input order breaks ties. */
export function rankFeatures(features) {
  return (features || [])
    .map((f, i) => ({ f, i }))
    .sort((a, b) =>
      (TYPE_RANK[a.f.type] - TYPE_RANK[b.f.type]) ||
      (priorityScore(b.f) - priorityScore(a.f)) ||
      (a.i - b.i))
    .map((x) => x.f);
}

export function moscowCounts(features) {
  const counts = { must: 0, should: 0, could: 0, wont: 0 };
  for (const f of features || []) {
    if (counts[f.type] !== undefined) counts[f.type] += 1;
  }
  const total = features ? features.length : 0;
  const pct = (n) => (total ? round2((n / total) * 100) : 0);
  return {
    counts, total,
    mustPct: pct(counts.must), shouldPct: pct(counts.should),
    couldPct: pct(counts.could), wontPct: pct(counts.wont),
  };
}

/* ---------- cost & progress ---------- */

export function scopeSummary(features, hourlyRate, opts = {}) {
  const rate = Math.max(0, num(hourlyRate, 0));
  const list = Array.isArray(features) ? features : [];
  const totalEstimate = round2(list.reduce((s, f) => s + num(f.estimate, 0), 0));
  const doneEstimate = round2(list.filter((f) => f.done)
    .reduce((s, f) => s + num(f.estimate, 0), 0));
  const remainingEstimate = round2(totalEstimate - doneEstimate);
  return {
    totalEstimate, doneEstimate, remainingEstimate,
    featureCount: list.length,
    doneCount: list.filter((f) => f.done).length,
    progressPct: totalEstimate > 0 ? round2((doneEstimate / totalEstimate) * 100) : 0,
    estimatedCost: round2(totalEstimate * rate),
    remainingCost: round2(remainingEstimate * rate),
    currency: opts.currency || 'USD',
  };
}

/* ---------- timeline (sequential, working days only) ---------- */

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

export function parseISODate(iso) {
  if (typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

const pad2 = (n) => String(n).padStart(2, '0');

export function formatDateISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO() {
  return formatDateISO(new Date());
}

export function buildTimeline(features, opts = {}) {
  const hoursPerDay = clampNum(opts.hoursPerDay ?? 4, 0.5, 16);
  let cursor = parseISODate(opts.startDate) || parseISODate(todayISO());
  while (isWeekend(cursor)) cursor.setDate(cursor.getDate() + 1);

  const pending = rankFeatures(features || []).filter(
    (f) => !f.done && num(f.estimate, 0) > 0);
  const items = [];
  for (const f of pending) {
    const days = Math.max(1, Math.ceil(f.estimate / hoursPerDay));
    let left = days, startD = null, endD = null;
    while (left > 0) {
      if (!isWeekend(cursor)) {
        if (!startD) startD = new Date(cursor);
        endD = new Date(cursor);
        left -= 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    items.push({ id: f.id, name: f.name, days, start: formatDateISO(startD), end: formatDateISO(endD) });
  }
  return {
    items,
    totalDays: items.reduce((s, it) => s + it.days, 0),
    endISO: items.length ? items[items.length - 1].end : formatDateISO(cursor),
    hoursPerDay,
  };
}

/* ---------- budget cut line (greedy fill by rank) ---------- */

export function cutlineForBudget(features, budgetHours) {
  const budget = Math.max(0, num(budgetHours, 0));
  const selected = [], deferred = [];
  let used = 0;
  for (const f of rankFeatures(features || []).filter((f) => !f.done)) {
    const est = num(f.estimate, 0);
    if (used + est <= budget + 1e-9) {
      selected.push(f.id);
      used = round2(used + est);
    } else {
      deferred.push(f.id);
    }
  }
  return { selected, deferred, usedHours: used, budgetHours: budget };
}

/* ---------- persistence: export / import / migration ---------- */

export function exportPayload(state) {
  return {
    app: 'scopekit',
    version: EXPORT_VERSION,
    name: String(state && state.name || ''),
    currency: String((state && state.currency) || 'USD').toUpperCase(),
    rate: num(state && state.rate, 0),
    hoursPerDay: clampNum((state && state.hoursPerDay) ?? 4, 0.5, 16),
    startDate: typeof state.startDate === 'string' && parseISODate(state.startDate)
      ? state.startDate : todayISO(),
    features: (state && Array.isArray(state.features) ? state.features : [])
      .map(normalizeFeature),
  };
}

export function importScope(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); }
    catch { throw new ScopeKitError('err.invalidJSON'); }
  }
  if (!obj || typeof obj !== 'object' || obj.app !== 'scopekit' ||
      !Array.isArray(obj.features)) {
    throw new ScopeKitError('err.invalidFormat');
  }
  // v1 -> v2 migration: coerce legacy string numbers, default missing fields.
  const migrated = obj.version === 1
    ? obj.features.map((f) => ({
        ...f,
        estimate: num(f.estimate, 0),
        value: num(f.value, 0),
        risk: f.risk || 'low',
        type: String(f.type || 'should').toLowerCase(),
        done: Boolean(f.done),
      }))
    : obj.features;
  return exportPayload({ ...obj, features: migrated });
}

/* ---------- pure list helpers ---------- */

export function toggleDone(features, id) {
  return (features || []).map((f) => (f.id === id ? { ...f, done: !f.done } : f));
}

export function removeFeature(features, id) {
  return (features || []).filter((f) => f.id !== id);
}

/* ---------- formatting ---------- */

export function formatMoney(amount, currency = 'USD', locale = 'en-US') {
  const value = round2(num(amount, 0));
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency })
      .format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatHours(hours, dayLength = 8) {
  const dl = dayLength > 0 ? dayLength : 8;
  const n = round2(num(hours, 0));
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  let d = Math.floor(abs / dl);
  let r = Math.round((abs - d * dl) * 4) / 4;
  if (r >= dl) { d += 1; r = 0; }
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (r > 0 || d === 0) parts.push(`${parseFloat(r.toFixed(2))}h`);
  return sign + parts.join(' ');
}

/* ---------- share links (UTF-8-safe base64url) ---------- */

export function shareEncode(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function shareDecode(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return importScope(json); // validates shape, migrates v1
  } catch {
    return null;
  }
}

/* ---------- demo data (<60s first experience) ---------- */

export function demoScope() {
  return exportPayload({
    name: 'My micro-SaaS',
    currency: 'USD',
    rate: 60,
    hoursPerDay: 4,
    features: [
      { name: 'OAuth login', type: 'must', estimate: 12, value: 9, risk: 'medium' },
      { name: 'PDF export', type: 'must', estimate: 8, value: 8, risk: 'low' },
      { name: 'Onboarding checklist', type: 'should', estimate: 6, value: 7, risk: 'low' },
      { name: 'Dark mode', type: 'could', estimate: 3, value: 4, risk: 'low' },
      { name: 'Team sharing', type: 'should', estimate: 20, value: 8, risk: 'high' },
      { name: 'CSV import', type: 'could', estimate: 5, value: 5, risk: 'medium' },
      { name: 'Email digests', type: 'wont', estimate: 16, value: 3, risk: 'high' },
      { name: 'Mobile polish', type: 'could', estimate: 4, value: 6, risk: 'low', done: true },
    ],
  });
}
