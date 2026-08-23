// ScopeKit — Plan features & scope for micro-SaaS products
// Global‑first: i18n EN/PT‑BR, offline‑first PWA, localStorage persistence

const i18n = {
  en: {
    title: 'ScopeKit',
    subtitle: 'Plan features & scope for micro‑SaaS products',
    currency: 'USD',
    localeToggle: 'PT‑BR',
    plan: 'Plan',
    pricing: 'Pricing',
    addFeature: 'Add feature',
    remove: 'Remove',
    features: 'Features',
    save: 'Save',
    export: 'Export',
    import: 'Import',
    noFeatures: 'No features yet. Add one above!',
    saved: 'Saved to localStorage',
    loaded: 'Loaded from localStorage'
  },
  'pt-BR': {
    title: 'ScopeKit',
    subtitle: 'Planeje recursos e escopo para produtos SaaS micro',
    currency: 'BRL',
    localeToggle: 'EN',
    plan: 'Plano',
    pricing: 'Preço',
    addFeature: 'Adicionar recurso',
    remove: 'Remover',
    features: 'Recursos',
    save: 'Salvar',
    export: 'Exportar',
    import: 'Importar',
    noFeatures: 'Nenhum recurso ainda. Adicione uma acima!',
    saved: 'Salvo no localStorage',
    loaded: 'Carregado do localStorage'
  }
};

let currentLocale = 'en';
const PROJECTS_KEY = 'scopekit_projects';

function i18nSet(locale) {
  currentLocale = locale;
  updateUI();
}

function i18nGet(key) {
  return i18n[currentLocale][key] || i18n.en[key] || key;
}

function updateUI() {
  document.title = i18nGet('title');
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <header class="header">
        <h1>${i18nGet('title')}</h1>
        <p>${i18nGet('subtitle')}</p>
        <button id="localeBtn" class="locale-btn">${i18nGet('localeToggle')}</button>
      </header>
      <main class="main">
        <section class="features-section">
          <h2>${i18nGet('features')}</h2>
          <input type="text" id="newFeature" placeholder="${i18nGet('addFeature')}" />
          <button id="addFeatureBtn" class="add-btn">${i18nGet('addFeature')}</button>
          <ul id="featureList" class="feature-list"></ul>
          <div id="emptyState" class="empty-state">${i18nGet('noFeatures')}</div>
        </section>
      </main>
      <footer class="footer">
        <small>Built by @chr-z — ${new Date().getFullYear()}</small>
      </footer>
    `;
    bindEvents();
  }
}

function bindEvents() {
  const addFeatureBtn = document.getElementById('addFeatureBtn');
  const newFeatureInput = document.getElementById('newFeature');
  const featureList = document.getElementById('featureList');
  const emptyState = document.getElementById('emptyState');

  function renderFeatures() {
    const features = getFeatures();
    featureList.innerHTML = '';
    if (features.length === 0) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      features.forEach((feature, idx) => {
        const li = document.createElement('li');
        li.className = 'feature-item';
        li.innerHTML = `
          <span class="feature-name">${feature.name}</span>
          <span class="feature-desc">${feature.desc || ''}</span>
          <button class="remove-btn" data-index="${idx}">×</button>
        `;
        featureList.appendChild(li);
      });
    }
  }

  function getFeatures() {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  function setFeatures(features) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(features));
    renderFeatures();
    alert(i18nGet('saved'));
  }

  if (addFeatureBtn) {
    addFeatureBtn.addEventListener('click', () => {
      const text = newFeatureInput.value.trim();
      if (!text) return;
      const features = getFeatures();
      features.push({ name: text, desc: '' });
      setFeatures(features);
      newFeatureInput.value = '';
    });
  }

  // Remove feature
  featureList.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-btn');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index);
    const features = getFeatures();
    features.splice(idx, 1);
    setFeatures(features);
  });

  // Initial render
  renderFeatures();
}

// PWA register
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/scopekit/service-worker.js')
      .then(registration => {
        console.log('SW registered:', registration.scope);
      })
      .catch(registrationError => {
        console.error('SW registration failed:', registrationError);
      });
  });
}

updateUI();