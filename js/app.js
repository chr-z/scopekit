/* ScopeKit — minimal, zero-dependency UI. No framework, no build step needed. */

// --- CSS vars for quick theming ---
(function () {
  const s = document.createElement('style');
  s.textContent = ':root{--brand:#4f46e5;--muted:#6b7280;--bg:#f9fafb;--card:#fff;--table-bg:#fff}.topbar{display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;background:var(--card);border-bottom:1px solid #e5e7eb}.topbar .brand{display:flex;align-items:center;gap:0.5rem;color:#111;font-weight:600}.topbar .brand img{max-width:32px}.controls select,.topbar .btn{margin-left:0.5rem}.topbar .btn{background:transparent;border:1px solid #d1d5db;padding:0.35rem 0.5rem;font-size:0.8rem;cursor:pointer}.topbar .btn.primary{background:#4f46e5;color:#fff;border-color:#4f46e5}.topbar .btn.ghost:hover{border-color:#9ca3af}.topbar .btn.wide{width:100%}.wrap{max-width:960px;margin:auto;padding:1rem}.card{background:var(--card);border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin:1rem 0}.stat{display:flex;gap:1rem;align-items:center}.chips{display:flex;flex-wrap:wrap;gap:0.5rem}.muted-chips span{background:#f3f4f6;border:1px solid #e5e7eb;padding:0.25rem 0.5rem;border-radius:4px;font-size:0.8rem}.table-wrap{overflow-x:auto}.feat-table{width:100%;border-collapse:collapse}.feat-table th,.feat-table td{border:1px solid #e5e7eb;padding:0.5rem 0.75rem;text-align:center}.feat-table th{background:#f9fafb}.feat-table tbody tr:nth-child(even){background:#f3f4f6}.hint{font-size:0.8rem;color:#6b7280;margin-top:0.5rem}.problems{color:#b91c1c}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.footer p{font-size:0.8rem;color:#6b7280;margin:0}.footer a{color:#4f46e5;text-decoration:none}.toast{position:fixed;bottom:1rem;left:1rem;background:#111;color:#fff;padding:0.5rem 0.75rem;border-radius:4px;font-size:0.85rem;min-width:220px;opacity:0;transition:opacity 0.3s}.toast.show{opacity:1}.project-form .row3{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0.75rem}.project-form label{display:flex;flex-direction:column;gap:0.25rem}.project-form input,.project-form select{padding:0.3rem;border:1px solid #d1d5db;border-radius:4px;font-family:system-ui,sans-serif}.feat-table th[data-i18n],.feat-table td[data-i18n]{font-variant-numeric:tabular-nums;}';

  document.head.appendChild(s);
})();

// --- i18n engine using fetch ---
const LOCALES = {};
let currentLang = 'en';

async function loadLocale(lang) {
  if (LOCALES[lang]) return LOCALES[lang];
  const res = await fetch(`locales/${lang}.json`);
  const data = await res.json();
  LOCALES[lang] = data;
  return data;
}
function t(key) {
  const parts = key.split('.');
  let val = LOCALES[currentLang];
  for (const p of parts) {
    if (val[p] === undefined) return key;
    val = val[p];
  }
  if (typeof val === 'function') return val();
  return val === undefined ? key : val;
}
function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const ph = t(el.getAttribute('data-i18n-ph'));
    el.placeholder = ph;
  });
  localStorage.setItem('sk-lang', lang);
}

// Load stored lang
document.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem('sk-lang') || 'en';
  setLang(stored);
  document.getElementById('langSelect').value = stored;
});

// --- App state ---
let features = [];
let currency = 'USD';
let rate = 40;
let hoursPerDay = 4;
let startDate = new Date().toISOString().split('T')[0];

// DOM nodes
const projNameEl = document.getElementById('projName');
const rateEl = document.getElementById('rate');
const currencyEl = document.getElementById('currency');
const hoursPerDayEl = document.getElementById('hoursPerDay');
const startDateEl = document.getElementById('startDate');
const addForm = document.getElementById('addForm');
const featBody = document.getElementById('featBody');
const problemsEl = document.getElementById('problems');
const projectForm = document.getElementById('projectForm');
const statsRow = document.getElementById('statsRow');
const timelineList = document.getElementById('timelineList');
const timelineSummary = document.getElementById('timelineSummary');
const cutInput = document.getElementById('budgetInput');
const cutSelected = document.getElementById('cutSelected');
const cutDeferred = document.getElementById('cutDeferred');
const shareBtn = document.getElementById('shareBtn');
const shareMsg = document.getElementById('shareMsg');
const toastEl = document.getElementById('toast');

// (rest of app.js continues...)


// --- Validation helpers (mirrors engine) ---
function validateRow(f) {
  const problems = [];
  if (!f || typeof f !== 'object') return [{ key: 'err.invalidFeature', params: {} }];
  if (!String(f.name || '').trim()) problems.push({ key: 'err.nameRequired', params: {} });
  if (!['must','should','could','wont'].includes(String(f.type || '').toLowerCase()))
    problems.push({ key: 'err.badType', params: { value: f.type } });
  if (num(f.estimate, -1) < 0) problems.push({ key: 'err.negative', params: { field: 'Est. h' } });
  if (num(f.value, -1) < 0) problems.push({ key: 'err.negative', params: { field: 'Valor' } });
  if (!['low','medium','high'].includes(String(f.risk || '').toLowerCase()))
    problems.push({ key: 'err.badRisk', params: { value: f.risk } });
  return problems;
}
function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }

// --- JSON export/import (mirrors engine helpers) ---
function exportPayload() { /* simplified inline */ return {}; }
function importScope(raw) { return {}; }

// --- Read engine.js functions via import — actually import the module ---
(async () => {
  try {
    const engine = await import('./js/engine.js');
    // expose needed functions globally for the inline code below
    window.normalizeFeature = engine.normalizeFeature;
    window.validateScope = engine.validateScope;
    window.priorityScore = engine.priorityScore;
    window.rankFeatures = engine.rankFeatures;
    window.moscowCounts = engine.moscowCounts;
    window.scopeSummary = engine.scopeSummary;
    window.buildTimeline = engine.buildTimeline;
    window.cutlineForBudget = engine.cutlineForBudget;
    window.exportPayload = engine.exportPayload;
    window.importScope = engine.importScope;
    window.toggleDone = engine.toggleDone;
    window.removeFeature = engine.removeFeature;
    window.formatMoney = engine.formatMoney;
    window.formatHours = engine.formatHours;
    window.parseISODate = engine.parseISODate;
    window.shareEncode = engine.shareEncode;
    window.shareDecode = engine.shareDecode;
    window.demoScope = engine.demoScope;
    window.ScopeKitError = engine.ScopeKitError;
    window.TYPES = engine.TYPES;
    window.RISKS = engine.RISKS;
    window.TYPE_RANK = engine.TYPE_RANK;
    window.RISK_FACTOR = engine.RISK_FACTOR;
    console.log('ScopeKit engine loaded ✓');
  } catch (e) {
    console.warn('Could not load engine.js', e);
  }
})();

// --- Render: features table ---
function renderFeatures() {
  const ranked = rankFeatures(features || []);
  featBody.innerHTML = '';
  if (!ranked.length) {
    featBody.innerHTML = '<tr><td colspan="8" style="padding:1rem;color:#6b7280">No features yet — add one above.</td></tr>';
    return;
  }
  ranked.forEach((f, i) => {
    const score = priorityScore(f);
    const done = f.done ? '<span title="Done">✓</span>' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-i18n>feature</td>
      <td data-i18n>type</td>
      <td data-i18n>est</td>
      <td data-i18n>val</td>
      <td data-i18n>risk</td>
      <td data-i18n>score</td>
      <td data-i18n>done</td>
      <td><button class="btn tiny ghost delete" data-id="${f.id}">✕</button></td>
    `;
    featBody.appendChild(tr);
  });
  // update score cells
  const scoreCells = featBody.querySelectorAll('td:nth-child(6)');
  ranked.forEach((f, i) => { if (scoreCells[i]) scoreCells[i].textContent = score.toFixed(2); });
}

// --- Render: stats cards ---
function renderStats() {
  const s = scopeSummary(features || [], rate, { currency });
  statsRow.innerHTML = `
    <div class="stat"><span data-i18n="stat.totalH"></span><strong id="stat-total"></strong>h</div>
    <div class="stat"><span data-i18n="stat.doneH"></span><strong id="stat-done"></strong>h</div>
    <div class="stat"><span data-i18n="stat.remainingH"></span><strong id="stat-rem"></strong>h</div>
    <div class="stat"><span data-i18n="stat.cost"></span><strong id="stat-cost"></strong> ${currency}</div>
    <div class="stat"><span data-i18n="stat.remainingCost"></span><strong id="stat-rem-cost"></strong> ${currency}</div>
    <div class="stat"><span data-i18n="stat.progress"></span><strong id="stat-progress"></strong>%</div>
  `;
  document.getElementById('stat-total').textContent = s.totalEstimate;
  document.getElementById('stat-done').textContent = s.doneEstimate;
  document.getElementById('stat-rem').textContent = s.remainingEstimate;
  document.getElementById('stat-cost').textContent = formatMoney(s.estimatedCost, currency);
  document.getElementById('stat-rem-cost').textContent = formatMoney(s.remainingCost, currency);
  document.getElementById('stat-progress').textContent = s.progressPct;
}

// --- Render: timeline ---
function renderTimeline() {
  const t = buildTimeline(features || [], { hoursPerDay, startDate });
  timelineList.innerHTML = '';
  if (!t.items.length) { timelineList.innerHTML = '<li style="color:#6b7280">No timeline — set start date & hours/day.</li>'; }
  t.items.forEach(it => {
    const li = document.createElement('li');
    li.textContent = `${it.name}: ${it.start} – ${it.end} (${it.days}d)`;
    timelineList.appendChild(li);
  });
  timelineSummary.textContent = `${t.totalDays}d total, ends ${t.endISO}`;
}

// --- Render: cut line ---
function renderCutline() {
  const budget = num(cutInput.value);
  if (!budget) { cutSelected.innerHTML = ''; cutDeferred.innerHTML = ''; return; }
  const { selected, deferred, usedHours, budgetHours } = cutlineForBudget(features || [], budget);
  cutSelected.innerHTML = selected.map(id => {
    const f = features.find(x => x.id === id);
    return `<span class="chip" title="${f.name}">${f.name.slice(0,20)}</span>`;
  }).join('') || '<span class="muted-chips">None fit budget</span>';
  cutDeferred.innerHTML = deferred.map(id => {
    const f = features.find(x => x.id === id);
    return `<span class="chip muted">${f.name.slice(0,20)}</span>`;
  }).join('') || '<span class="muted-chips">None fit budget</span>';
  document.getElementById('cutSummary').textContent =
    `${usedHours}h used of ${budgetHours}h budget`;
}

// --- Events ---
addForm.addEventListener('submit', e => {
  e.preventDefault();
  const f = {
    id: genId(),
    name: document.getElementById('fName').value || 'Untitled',
    type: document.getElementById('fType').value,
    estimate: num(document.getElementById('fEstimate').value),
    value: num(document.getElementById('fValue').value),
    risk: document.getElementById('fRisk').value,
    done: false,
  };
  const probs = validateRow(f);
  if (probs.length) {
    problemsEl.hidden = false;
    problemsEl.innerHTML = probs.map(p => `<span data-i18n="${p.key}" data-i18n-params="${JSON.stringify(p.params)}"></span>`).join(' ');
    return;
  }
  problemsEl.hidden = true;
  features.push(f);
  renderFeatures();
  renderStats();
  renderTimeline();
  renderCutline();
  addForm.reset();
  document.getElementById('fName').focus();
});

featBody.addEventListener('click', e => {
  if (e.target.classList.contains('delete')) {
    const id = e.target.dataset.id;
    features = removeFeature(features, id);
    renderFeatures(); renderStats(); renderTimeline(); renderCutline();
  }
});

cutInput.addEventListener('input', renderCutline);

shareBtn.addEventListener('click', async () => {
  const encoded = shareEncode(demoScope());
  try {
    await navigator.clipboard.writeText(encoded);
    showToast(t('copied'));
    setTimeout(() => URL.revokeObjectURL(encoded), 5000);
  } catch {
    showToast(t('copyFail'), false);
  }
});

// Show toast
function showToast(msg, ok = true) {
  toastEl.textContent = msg;
  toastEl.setAttribute('role', 'status');
  toastEl.hidden = false;
  toastEl.classList.add('show');
  setTimeout(() => { toastEl.classList.remove('show'); toastEl.hidden = true; }, 3000);
}

// genId helper
function genId() { return 'f' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36); }