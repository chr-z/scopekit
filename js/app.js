// ScopeKit — zero-dependency UI. Imports engine.js for all business logic.
import {
  formatMoney, formatHours, toggleDone, removeFeature, normalizeFeature,
  validateScope, priorityScore, rankFeatures, moscowCounts, scopeSummary,
  buildTimeline, cutlineForBudget, exportPayload as engineExportPayload,
  importScope as engineImportScope, shareEncode, shareDecode, demoScope,
  ScopeKitError, genId as engineGenId
} from './engine.js';

// --- i18n setup ---
const LOCALES = {};
let currentLang = 'en';

async function loadLocale(lang) {
  if (LOCALES[lang]) return LOCALES[lang];
  const res = await fetch('locales/' + lang + '.json');
  const data = await res.json();
  LOCALES[lang] = data;
  return data;
}

function t(key) {
  const parts = key.split('.');
  let val = LOCALES[currentLang];
  if (val === undefined) val = LOCALES.en;
  for (const p of parts) {
    if (val[p] === undefined) return key;
    val = val[p];
  }
  return typeof val === 'function' ? val() : val;
}

function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });
  localStorage.setItem('sk-lang', lang);
}

document.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem('sk-lang') || 'en';
  setLang(stored);
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = stored;
});

// --- App state ---
let features = [];
let currency = 'USD';
let rate = 40;
let hoursPerDay = 4;
let startDate = new Date().toISOString().split('T')[0];

// DOM refs
const addForm = document.getElementById('addForm');
const featBody = document.getElementById('featBody');
const problemsEl = document.getElementById('problems');
const statsRow = document.getElementById('statsRow');
const timelineList = document.getElementById('timelineList');
const timelineSummary = document.getElementById('timelineSummary');
const cutInput = document.getElementById('budgetInput');
const cutSelected = document.getElementById('cutSelected');
const cutDeferred = document.getElementById('cutDeferred');
const shareBtn = document.getElementById('shareBtn');
const toastEl = document.getElementById('toast');
const demoBtn = document.getElementById('demoBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

function showToast(msg, ok = true) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  toastEl.classList.add('show');
  setTimeout(() => { toastEl.classList.remove('show'); toastEl.hidden = true; }, 3000);
}

// --- Validation ---
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

// --- Render: features table ---
function renderFeatures() {
  const ranked = rankFeatures(features || []);
  featBody.innerHTML = '';
  if (!ranked.length) {
    featBody.innerHTML = '<tr><td colspan="8" style="padding:1rem;color:#6b7280">No features yet — add one above.</td></tr>';
    return;
  }
  ranked.forEach((f) => {
    const score = priorityScore(f);
    const done = f.done ? '✓' : '';
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + f.name + '</td><td>' + f.type + '</td><td>' + f.estimate + '</td><td>' + f.value + '</td><td>' + f.risk + '</td><td class="score-pill">' + score.toFixed(2) + '</td><td>' + done + '</td><td><button class="btn tiny ghost delete" data-id="' + f.id + '">✕</button></td>';
    featBody.appendChild(tr);
  });
}

// --- Render: stats cards ---
function renderStats() {
  const s = scopeSummary(features || [], rate, { currency });
  statsRow.innerHTML = '<div class="stat"><span data-i18n="stat.totalH"></span><strong id="stat-total"></strong>h</div>' +
    '<div class="stat"><span data-i18n="stat.doneH"></span><strong id="stat-done"></strong>h</div>' +
    '<div class="stat"><span data-i18n="stat.remainingH"></span><strong id="stat-rem"></strong>h</div>' +
    '<div class="stat"><span data-i18n="stat.cost"></span><strong id="stat-cost"></strong> ' + currency + '</div>' +
    '<div class="stat"><span data-i18n="stat.remainingCost"></span><strong id="stat-rem-cost"></strong> ' + currency + '</div>' +
    '<div class="stat"><span data-i18n="stat.progress"></span><strong id="stat-progress"></strong>%</div>';
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
  if (!t.items.length) {
    timelineList.innerHTML = '<li style="color:#6b7280">No timeline — set start date & hours/day.</li>';
    return;
  }
  t.items.forEach(it => {
    const li = document.createElement('li');
    li.textContent = it.name + ': ' + it.start + ' – ' + it.end + ' (' + it.days + 'd)';
    timelineList.appendChild(li);
  });
  timelineSummary.textContent = t.totalDays + 'd total, ends ' + t.endISO;
}

// --- Render: cut line ---
function renderCutline() {
  const budget = num(cutInput.value);
  if (!budget) { cutSelected.innerHTML = ''; cutDeferred.innerHTML = ''; return; }
  const { selected, deferred, usedHours, budgetHours } = cutlineForBudget(features || [], budget);
  cutSelected.innerHTML = selected.map(id => '<span class="chip" title="' + features.find(x=>x.id==id)?.name + '">' + (features.find(x=>x.id==id)?.name||'').slice(0,20) + '</span>').join('') || '<span class="muted-chips">None fit budget</span>';
  cutDeferred.innerHTML = deferred.map(id => '<span class="chip muted">' + (features.find(x=>x.id==id)?.name||'').slice(0,20) + '</span>').join('') || '<span class="muted-chips">None fit budget</span>';
  document.getElementById('cutSummary').textContent = usedHours + 'h used of ' + budgetHours + 'h budget';
}

// --- Events ---
addForm.addEventListener('submit', e => {
  e.preventDefault();
  const f = {
    id: 'f' + Math.random().toString(36).slice(2, 11),
    name: document.getElementById('fName').value || 'Untitled',
    type: document.getElementById('fType').value,
    estimate: num(document.getElementById('fEstimate').value),
    value: num(document.getElementById('fValue').value),
    risk: document.getElementById('fRisk').value,
    done: false
  };
  const probs = validateRow(f);
  if (probs.length) {
    problemsEl.hidden = false;
    problemsEl.innerHTML = probs.map(p => '<span data-i18n="' + p.key + '">' + p.key + '</span>').join(' ');
    return;
  }
  problemsEl.hidden = true;
  features.push(f);
  renderFeatures(); renderStats(); renderTimeline(); renderCutline();
  addForm.reset(); document.getElementById('fName').focus();
});

featBody.addEventListener('click', e => {
  if (e.target.classList.contains('delete')) {
    features = removeFeature(features, e.target.dataset.id);
    renderFeatures(); renderStats(); renderTimeline(); renderCutline();
  }
});

cutInput.addEventListener('input', renderCutline);

// Demo
demoBtn.addEventListener('click', async () => {
  try {
    const demo = await demoScope();
    features = demo.features;
    renderFeatures(); renderStats(); renderTimeline(); renderCutline();
    showToast('Demo loaded ✓');
  } catch (e) { showToast('Error loading demo', false); }
});

// Export
exportBtn.addEventListener('click', async () => {
  try {
    const state = { name: '', rate, hoursPerDay, startDate, currency, features };
    const payload = { ...state, features: features.map(normalizeFeature) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    await navigator.clipboard.writeText(url);
    showToast('Export ready');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) { showToast('Export failed', false); }
});

// Import
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const result = await engineImportScope(ev.target.result);
      features = result.features;
      renderFeatures(); renderStats(); renderTimeline(); renderCutline();
      showToast('Scope imported ✓');
    } catch (err) { showToast(err.message || 'Import failed', false); }
  };
  reader.readAsText(file);
});

// Share link
shareBtn.addEventListener('click', async () => {
  try {
    const d = demoScope();
    const encoded = shareEncode(d);
    await navigator.clipboard.writeText(encoded);
    showToast('Copied ✓');
  } catch { showToast("Couldn't copy", false); }
});