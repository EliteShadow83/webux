const state = {
  site: null,
  view: window.location.pathname.startsWith('/admin') ? 'admin' : 'site',
  selectedPageId: null,
  notice: ''
};

const sectionDefaults = {
  hero: {
    type: 'hero',
    eyebrow: 'Featured',
    headline: 'Create something memorable',
    body: 'Customize this hero section with your own story, calls to action, and links.',
    buttonLabel: 'Learn more',
    buttonUrl: '#'
  },
  text: {
    type: 'text',
    headline: 'Rich text section',
    body: 'Use text blocks for announcements, landing page copy, documentation, or product details.'
  },
  features: {
    type: 'features',
    headline: 'Feature highlights',
    items: [
      { title: 'Flexible', body: 'Add, remove, and reorder sections.' },
      { title: 'Fast', body: 'A lightweight API keeps your content portable.' },
      { title: 'Brandable', body: 'Tune colors and type from global settings.' }
    ]
  },
  gallery: {
    type: 'gallery',
    headline: 'Image gallery',
    images: [
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80'
    ]
  },
  cta: {
    type: 'cta',
    headline: 'Invite visitors to act',
    body: 'Link this CTA to a signup page, contact form, checkout, or another page.',
    buttonLabel: 'Get started',
    buttonUrl: '#'
  }
};

const api = {
  site: () => request('/api/site'),
  updateSettings: (settings) => request('/api/settings', { method: 'PUT', body: settings }),
  createPage: (page) => request('/api/pages', { method: 'POST', body: page }),
  updatePage: (page) => request(`/api/pages/${page.id}`, { method: 'PUT', body: page }),
  deletePage: (id) => fetch(`/api/pages/${id}`, { method: 'DELETE' })
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render() {
  if (!state.site) return;
  const root = document.querySelector('#root');
  root.className = '';
  root.innerHTML = `
    <div style="--primary:${state.site.settings.primaryColor};--accent:${state.site.settings.accentColor};font-family:${escapeHtml(state.site.settings.fontFamily)}">
      <header class="topbar">
        <a class="brand" href="/" data-view="site"><span class="logo">◈</span><span>${escapeHtml(state.site.settings.siteName)}</span></a>
        <nav>
          <button class="${state.view === 'site' ? 'active' : ''}" data-view="site">👁 Preview</button>
          <button class="${state.view === 'admin' ? 'active' : ''}" data-view="admin">▦ Admin</button>
        </nav>
      </header>
      ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ''}
      ${state.view === 'admin' ? renderAdmin() : renderPublicSite()}
    </div>`;
  bindNavigation();
  if (state.view === 'admin') bindAdmin();
}

function renderAdmin() {
  const selectedPage = getSelectedPage();
  return `
    <main class="admin-shell">
      <aside class="sidebar">
        <div class="panel-header"><h2>Pages</h2><button class="icon-button" data-create-page title="Create page">＋</button></div>
        <div class="page-list">
          ${state.site.pages.map((page) => `
            <button class="${page.id === selectedPage?.id ? 'selected' : ''}" data-select-page="${page.id}">
              <span>${escapeHtml(page.title)}</span><small>/${escapeHtml(page.slug)} · ${escapeHtml(page.status)}</small>
            </button>`).join('')}
        </div>
        ${renderThemeEditor()}
      </aside>
      ${selectedPage ? renderPageEditor(selectedPage) : '<section class="empty-state">Create a page to begin.</section>'}
    </main>`;
}

function renderThemeEditor() {
  const settings = state.site.settings;
  return `
    <section class="theme-editor">
      <h3>🎨 Theme</h3>
      <label>Site name<input data-setting="siteName" value="${escapeHtml(settings.siteName)}" /></label>
      <label>Tagline<input data-setting="tagline" value="${escapeHtml(settings.tagline)}" /></label>
      <div class="color-grid">
        <label>Primary<input type="color" data-setting="primaryColor" value="${escapeHtml(settings.primaryColor)}" /></label>
        <label>Accent<input type="color" data-setting="accentColor" value="${escapeHtml(settings.accentColor)}" /></label>
      </div>
      <button class="primary-action" data-save-theme>💾 Save theme</button>
    </section>`;
}

function renderPageEditor(page) {
  return `
    <section class="editor-grid">
      <div class="editor-panel">
        <div class="editor-toolbar">
          <div><h1>${escapeHtml(page.title)}</h1><p>Build pages from editable blocks, then preview before publishing.</p></div>
          <div class="toolbar-actions"><button class="danger" data-delete-page="${page.id}">🗑 Delete</button><button class="primary-action" data-save-page>💾 Save page</button></div>
        </div>
        <div class="meta-grid">
          <label>Title<input data-page-field="title" value="${escapeHtml(page.title)}" /></label>
          <label>Slug<input data-page-field="slug" value="${escapeHtml(page.slug)}" /></label>
          <label>Status<select data-page-field="status"><option value="published" ${page.status === 'published' ? 'selected' : ''}>Published</option><option value="draft" ${page.status === 'draft' ? 'selected' : ''}>Draft</option></select></label>
        </div>
        <div class="section-adder">${Object.keys(sectionDefaults).map((type) => `<button data-add-section="${type}">＋ ${type}</button>`).join('')}</div>
        <div class="sections-editor">${page.sections.map((section, index) => renderSectionEditor(section, index)).join('')}</div>
      </div>
      <div class="preview-panel"><span class="preview-label">Live preview</span>${renderPage(page)}</div>
    </section>`;
}

function renderSectionEditor(section, index) {
  return `
    <article class="section-card">
      <div class="section-card-header"><strong>${escapeHtml(section.type)}</strong><button class="text-button" data-remove-section="${index}">Remove</button></div>
      ${'eyebrow' in section ? field(index, 'eyebrow', section.eyebrow, 'Eyebrow') : ''}
      ${'headline' in section ? field(index, 'headline', section.headline, 'Headline') : ''}
      ${'body' in section ? field(index, 'body', section.body, 'Body', true) : ''}
      ${'buttonLabel' in section ? field(index, 'buttonLabel', section.buttonLabel, 'Button label') : ''}
      ${'buttonUrl' in section ? field(index, 'buttonUrl', section.buttonUrl, 'Button URL') : ''}
      ${section.type === 'features' ? renderFeatureEditor(section, index) : ''}
      ${section.type === 'gallery' ? renderGalleryEditor(section, index) : ''}
    </article>`;
}

function field(index, name, value, label, textarea = false) {
  return `<label>${label}${textarea ? `<textarea data-section-index="${index}" data-section-field="${name}">${escapeHtml(value)}</textarea>` : `<input data-section-index="${index}" data-section-field="${name}" value="${escapeHtml(value)}" />`}</label>`;
}

function renderFeatureEditor(section, sectionIndex) {
  return `<div class="nested-editor"><span>Features</span>${(section.items || []).map((item, itemIndex) => `
    <div class="feature-fields"><input data-feature-title="${sectionIndex}:${itemIndex}" value="${escapeHtml(item.title)}" /><textarea data-feature-body="${sectionIndex}:${itemIndex}">${escapeHtml(item.body)}</textarea></div>`).join('')}
    <button data-add-feature="${sectionIndex}">Add feature</button></div>`;
}

function renderGalleryEditor(section, sectionIndex) {
  return `<div class="nested-editor"><span>Image URLs</span>${(section.images || []).map((image, imageIndex) => `<input data-gallery-image="${sectionIndex}:${imageIndex}" value="${escapeHtml(image)}" />`).join('')}<button data-add-image="${sectionIndex}">Add image</button></div>`;
}

function renderPublicSite() {
  const slug = getSlugFromLocation();
  const page = state.site.pages.find((candidate) => candidate.slug === slug && candidate.status === 'published') || state.site.pages.find((candidate) => candidate.slug === 'home') || state.site.pages[0];
  const publishedPages = state.site.pages.filter((candidate) => candidate.status === 'published');
  return `
    <main>
      <section class="site-hero-strip"><p>${escapeHtml(state.site.settings.tagline)}</p><div>${publishedPages.map((publishedPage) => `<a href="/${escapeHtml(publishedPage.slug)}">${escapeHtml(publishedPage.title)}</a>`).join('')}</div></section>
      ${page ? renderPage(page) : '<div class="empty-state">No published pages yet.</div>'}
    </main>`;
}

function renderPage(page) {
  return `<article class="page-renderer">${page.sections.map(renderSection).join('')}</article>`;
}

function renderSection(section) {
  if (section.type === 'hero') return `<section class="block hero-block"><p class="eyebrow">${escapeHtml(section.eyebrow)}</p><h1>${escapeHtml(section.headline)}</h1><p>${escapeHtml(section.body)}</p><a class="button" href="${escapeHtml(section.buttonUrl)}">${escapeHtml(section.buttonLabel)}</a></section>`;
  if (section.type === 'features') return `<section class="block"><h2>${escapeHtml(section.headline)}</h2><div class="feature-grid">${(section.items || []).map((item) => `<div class="feature"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div>`).join('')}</div></section>`;
  if (section.type === 'gallery') return `<section class="block"><h2>${escapeHtml(section.headline)}</h2><div class="gallery">${(section.images || []).map((image, index) => `<img src="${escapeHtml(image)}" alt="${escapeHtml(section.headline || 'Gallery')} ${index + 1}" />`).join('')}</div></section>`;
  if (section.type === 'cta') return `<section class="block cta-block"><h2>${escapeHtml(section.headline)}</h2><p>${escapeHtml(section.body)}</p><a class="button" href="${escapeHtml(section.buttonUrl)}">${escapeHtml(section.buttonLabel)}</a></section>`;
  return `<section class="block text-block"><h2>${escapeHtml(section.headline)}</h2><p>${escapeHtml(section.body)}</p></section>`;
}

function bindNavigation() {
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    state.view = button.dataset.view;
    window.history.pushState({}, '', state.view === 'admin' ? '/admin' : '/');
    render();
  }));
}

function bindAdmin() {
  const selectedPage = getSelectedPage();
  document.querySelector('[data-create-page]')?.addEventListener('click', createPage);
  document.querySelector('[data-save-theme]')?.addEventListener('click', saveTheme);
  document.querySelector('[data-save-page]')?.addEventListener('click', savePage);
  document.querySelector(`[data-delete-page="${selectedPage?.id}"]`)?.addEventListener('click', () => deletePage(selectedPage.id));
  document.querySelectorAll('[data-select-page]').forEach((button) => button.addEventListener('click', () => { state.selectedPageId = button.dataset.selectPage; render(); }));
  document.querySelectorAll('[data-page-field]').forEach((input) => input.addEventListener('input', () => { selectedPage[input.dataset.pageField] = input.value; render(); }));
  document.querySelectorAll('[data-section-field]').forEach((input) => input.addEventListener('input', () => { selectedPage.sections[Number(input.dataset.sectionIndex)][input.dataset.sectionField] = input.value; render(); }));
  document.querySelectorAll('[data-add-section]').forEach((button) => button.addEventListener('click', () => { selectedPage.sections.push({ ...structuredClone(sectionDefaults[button.dataset.addSection]), id: `section-${Date.now()}` }); render(); }));
  document.querySelectorAll('[data-remove-section]').forEach((button) => button.addEventListener('click', () => { selectedPage.sections.splice(Number(button.dataset.removeSection), 1); render(); }));
  document.querySelectorAll('[data-feature-title]').forEach((input) => input.addEventListener('input', () => updateFeature(input, 'title')));
  document.querySelectorAll('[data-feature-body]').forEach((input) => input.addEventListener('input', () => updateFeature(input, 'body')));
  document.querySelectorAll('[data-add-feature]').forEach((button) => button.addEventListener('click', () => { selectedPage.sections[Number(button.dataset.addFeature)].items.push({ title: 'New feature', body: 'Describe this feature.' }); render(); }));
  document.querySelectorAll('[data-gallery-image]').forEach((input) => input.addEventListener('input', () => { const [sectionIndex, imageIndex] = input.dataset.galleryImage.split(':').map(Number); selectedPage.sections[sectionIndex].images[imageIndex] = input.value; render(); }));
  document.querySelectorAll('[data-add-image]').forEach((button) => button.addEventListener('click', () => { selectedPage.sections[Number(button.dataset.addImage)].images.push('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80'); render(); }));
}

function getSelectedPage() {
  return state.site.pages.find((page) => page.id === state.selectedPageId) || state.site.pages[0];
}

function getSlugFromLocation() {
  const slug = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  return slug && slug !== 'admin' ? slug : 'home';
}

function showNotice(message) {
  state.notice = message;
  render();
  setTimeout(() => { state.notice = ''; render(); }, 2200);
}

async function createPage() {
  const page = await api.createPage({ title: 'New landing page', status: 'draft', sections: [sectionDefaults.hero] });
  state.site.pages.push(page);
  state.selectedPageId = page.id;
  showNotice('Draft page created');
}

async function saveTheme() {
  const settings = { ...state.site.settings };
  document.querySelectorAll('[data-setting]').forEach((input) => { settings[input.dataset.setting] = input.value; });
  state.site.settings = await api.updateSettings(settings);
  showNotice('Theme settings saved');
}

async function savePage() {
  const page = getSelectedPage();
  const savedPage = await api.updatePage(page);
  state.site.pages = state.site.pages.map((candidate) => candidate.id === savedPage.id ? savedPage : candidate);
  state.selectedPageId = savedPage.id;
  showNotice('Page saved');
}

async function deletePage(id) {
  await api.deletePage(id);
  state.site.pages = state.site.pages.filter((page) => page.id !== id);
  state.selectedPageId = state.site.pages[0]?.id;
  showNotice('Page deleted');
}

function updateFeature(input, fieldName) {
  const page = getSelectedPage();
  const datasetValue = fieldName === 'title' ? input.dataset.featureTitle : input.dataset.featureBody;
  const [sectionIndex, itemIndex] = datasetValue.split(':').map(Number);
  page.sections[sectionIndex].items[itemIndex][fieldName] = input.value;
  render();
}

api.site().then((site) => {
  state.site = site;
  state.selectedPageId = site.pages[0]?.id;
  render();
}).catch((error) => {
  document.querySelector('#root').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
