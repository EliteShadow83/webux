const pageLayouts = {
  standard: 'Standard',
  centered: 'Centered content',
  sidebar: 'Sidebar navigation',
  landing: 'Landing page'
};

const adminSections = [
  { id: 'overview', label: 'Site overview', icon: '⌂' },
  { id: 'content', label: 'Content Management', icon: '✎' },
  { id: 'media', label: 'Media Library', icon: '🖼' },
  { id: 'theme', label: 'Theme', icon: '🎨' },
  { id: 'users', label: 'User Management', icon: '👥' },
  { id: 'navigation', label: 'Navigation Builder', icon: '☰' },
  { id: 'plugins', label: 'Plugins', icon: '⚙' }
];

const state = {
  site: null,
  auth: { authenticated: false, username: null },
  view: window.location.pathname.startsWith('/admin') ? 'admin' : 'site',
  adminSection: 'overview',
  selectedPageId: null,
  selectedUserId: null,
  notice: '',
  error: '',
  cart: loadCart()
};

const sectionDefaults = {
  hero: {
    type: 'hero',
    eyebrow: 'Featured',
    headline: 'Create something memorable',
    body: 'Customize this hero section with copy and inline button tokens like [[button:Contact us|/contact|secondary]].',
    buttonLabel: 'Learn more',
    buttonUrl: '#'
  },
  text: {
    type: 'text',
    headline: 'Rich text section',
    body: 'Use text blocks for announcements, product details, and inline action buttons. Example: [[button:Get a quote|/quote|primary]]'
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
  },
  pluginContent: {
    type: 'pluginContent',
    headline: 'Featured content',
    plugin: 'blog',
    mode: 'feed',
    category: '',
    selectedIds: []
  }
};

const api = {
  session: () => request('/api/session'),
  login: (credentials) => request('/api/login', { method: 'POST', body: credentials }),
  logout: () => request('/api/logout', { method: 'POST' }),
  site: () => request('/api/site'),
  updateSettings: (settings) => request('/api/settings', { method: 'PUT', body: settings }),
  createPage: (page) => request('/api/pages', { method: 'POST', body: page }),
  updatePage: (page) => request(`/api/pages/${page.id}`, { method: 'PUT', body: page }),
  deletePage: (id) => fetch(`/api/pages/${id}`, { method: 'DELETE' }),
  createUser: (user) => request('/api/users', { method: 'POST', body: user }),
  updateUser: (user) => request(`/api/users/${user.id}`, { method: 'PUT', body: user }),
  updateNavigation: (items) => request('/api/navigation', { method: 'PUT', body: items }),
  updatePlugins: (plugins) => request('/api/plugins', { method: 'PUT', body: plugins }),
  updatePluginData: (pluginData) => request('/api/plugin-data', { method: 'PUT', body: pluginData }),
  uploadMedia: (formData) => fetch('/api/media', { method: 'POST', body: formData }).then((response) => {
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    return response.json();
  })
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || `Request failed: ${response.status}`);
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
  syncDocumentTitle();
  const root = document.querySelector('#root');
  root.className = '';
  root.innerHTML = `
    <div style="--primary:${state.site.settings.primaryColor};--accent:${state.site.settings.accentColor};font-family:${escapeHtml(state.site.settings.fontFamily)}">
      ${renderHeader()}
      ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ''}
      ${state.error ? `<div class="notice error">${escapeHtml(state.error)}</div>` : ''}
      ${state.view === 'admin' ? renderAdminGate() : renderPublicSite()}
    </div>`;
  bindNavigation();
  if (state.view === 'admin') bindAdmin();
}

function renderHeader() {
  const settings = state.site.settings;
  return `
    ${settings.headerBannerEnabled ? `<a class="header-banner" style="background:${escapeHtml(settings.headerBannerBackground)};color:${escapeHtml(settings.headerBannerTextColor)}" href="${escapeHtml(settings.headerBannerUrl || '#')}">${escapeHtml(settings.headerBannerText)}</a>` : ''}
    <header class="topbar">
      <a class="brand" href="/" data-view="site"><span class="logo">◈</span><span>${escapeHtml(settings.siteName)}</span></a>
      <nav>
        <button class="${state.view === 'site' ? 'active' : ''}" data-view="site">👁 Preview</button>
        <button class="${state.view === 'admin' ? 'active' : ''}" data-view="admin">▦ ${escapeHtml(settings.headerCtaLabel || 'Admin')}</button>
        ${state.auth.authenticated ? '<button data-logout>Log out</button>' : ''}
      </nav>
    </header>`;
}

function renderAdminGate() {
  if (!state.auth.authenticated) {
    return `
      <main class="login-shell">
        <form class="login-card" data-login-form>
          <h1>Admin login</h1>
          <p>Sign in to edit pages, upload media, users, navigation, plugins, and theme settings.</p>
          <label>Username<input name="username" autocomplete="username" value="admin" /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" placeholder="Default: admin123" /></label>
          <button class="primary-action" type="submit">Log in</button>
        </form>
      </main>`;
  }
  return renderAdmin();
}

function renderAdmin() {
  return `
    <main class="admin-layout">
      <aside class="admin-nav">
        <strong>Admin</strong>
        ${adminSections.map((section) => `<button class="${state.adminSection === section.id ? 'selected' : ''}" data-admin-section="${section.id}"><span>${section.icon}</span>${section.label}</button>`).join('')}
        ${renderEnabledPluginNav()}
        ${renderEnabledPluginPages()}
      </aside>
      <section class="admin-workspace">${renderAdminSection()}</section>
    </main>`;
}

function renderEnabledPluginNav() {
  const enabledPlugins = state.site.plugins.filter((plugin) => plugin.enabled);
  if (!enabledPlugins.length) return '';
  return `<div class="admin-nav-group"><span>Plugin settings</span>${enabledPlugins.map((plugin) => `<button class="${state.adminSection === `plugin-settings:${plugin.id}` ? 'selected' : ''}" data-admin-section="plugin-settings:${plugin.id}"><span>▣</span>${escapeHtml(plugin.name)} Settings</button>`).join('')}</div>`;
}

function renderEnabledPluginPages() {
  const pages = getEnabledPluginPages();
  if (!pages.length) return '';
  return `<div class="admin-nav-group"><span>Plugin pages</span>${pages.map((page) => `<button class="${state.adminSection === `plugin-page:${page.pluginId}:${page.pageId}` ? 'selected' : ''}" data-admin-section="plugin-page:${page.pluginId}:${page.pageId}"><span>${page.icon}</span>${escapeHtml(page.label)}</button>`).join('')}</div>`;
}

function renderAdminSection() {
  if (state.adminSection.startsWith('plugin-page:')) {
    const [, pluginId, pageId] = state.adminSection.split(':');
    return renderPluginFeaturePage(pluginId, pageId);
  }
  if (state.adminSection.startsWith('plugin-settings:')) return renderPluginSettingsPage(state.adminSection.split(':')[1]);
  if (state.adminSection === 'content') return renderContentManagement();
  if (state.adminSection === 'media') return renderMediaLibrary(true);
  if (state.adminSection === 'theme') return renderThemeEditor(true);
  if (state.adminSection === 'users') return renderUserManagement();
  if (state.adminSection === 'navigation') return renderNavigationBuilder();
  if (state.adminSection === 'plugins') return renderPlugins();
  return renderSiteOverview();
}

function renderSiteOverview() {
  const publishedPages = state.site.pages.filter((page) => page.status === 'published').length;
  const activePlugins = state.site.plugins.filter((plugin) => plugin.enabled).length;
  const visibleNavItems = state.site.navigation.filter((item) => item.visible).length;
  return `
    <div class="admin-section-header"><div><h1>Site overview</h1><p>Review site health and jump into common management areas.</p></div></div>
    <div class="overview-grid">
      ${statCard('Pages', state.site.pages.length, `${publishedPages} published`)}
      ${statCard('Media items', state.site.media.length, 'Uploaded assets')}
      ${statCard('Users', state.site.users.length, 'Admin accounts')}
      ${statCard('Navigation', visibleNavItems, 'Visible links')}
      ${statCard('Plugins', activePlugins, 'Enabled plugins')}
    </div>
    <div class="quick-actions">
      <button data-admin-section="content">Edit content</button>
      <button data-admin-section="media">Upload media</button>
      <button data-admin-section="navigation">Build navigation</button>
      <button data-admin-section="users">Manage users</button>
    </div>`;
}

function statCard(label, value, detail) {
  return `<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`;
}

function renderContentManagement() {
  const selectedPage = getSelectedPage();
  return `
    <div class="content-shell">
      <aside class="content-list panel-card">
        <div class="panel-header"><h2>Content Management</h2><button class="icon-button" data-create-page title="Create page">＋</button></div>
        <div class="page-list">
          ${state.site.pages.map((page) => `
            <button class="${page.id === selectedPage?.id ? 'selected' : ''}" data-select-page="${page.id}">
              <span>${escapeHtml(page.title)}</span><small>/${escapeHtml(page.slug)} · ${escapeHtml(page.status)} · ${escapeHtml(pageLayouts[page.layout] || pageLayouts.standard)}</small>
            </button>`).join('')}
        </div>
      </aside>
      ${selectedPage ? renderPageEditor(selectedPage) : '<section class="empty-state">Create a page to begin.</section>'}
    </div>`;
}

function renderThemeEditor(fullPage = false) {
  const settings = state.site.settings;
  return `
    ${fullPage ? '<div class="admin-section-header"><div><h1>Theme</h1><p>Customize brand settings, header CTA, and the announcement banner.</p></div></div>' : ''}
    <section class="theme-editor panel-card">
      <h3>🎨 Theme & header</h3>
      <label>Site name<input data-setting="siteName" value="${escapeHtml(settings.siteName)}" /></label>
      <label>Tagline<input data-setting="tagline" value="${escapeHtml(settings.tagline)}" /></label>
      <label>Header CTA label<input data-setting="headerCtaLabel" value="${escapeHtml(settings.headerCtaLabel)}" /></label>
      <label>Header CTA URL<input data-setting="headerCtaUrl" value="${escapeHtml(settings.headerCtaUrl)}" /></label>
      <label class="checkbox-label"><input type="checkbox" data-setting-checkbox="headerBannerEnabled" ${settings.headerBannerEnabled ? 'checked' : ''} /> Show header banner</label>
      <label>Banner text<input data-setting="headerBannerText" value="${escapeHtml(settings.headerBannerText)}" /></label>
      <label>Banner URL<input data-setting="headerBannerUrl" value="${escapeHtml(settings.headerBannerUrl)}" /></label>
      <div class="color-grid">
        <label>Primary<input type="color" data-setting="primaryColor" value="${escapeHtml(settings.primaryColor)}" /></label>
        <label>Accent<input type="color" data-setting="accentColor" value="${escapeHtml(settings.accentColor)}" /></label>
        <label>Banner bg<input type="color" data-setting="headerBannerBackground" value="${escapeHtml(settings.headerBannerBackground)}" /></label>
        <label>Banner text<input type="color" data-setting="headerBannerTextColor" value="${escapeHtml(settings.headerBannerTextColor)}" /></label>
      </div>
      <button class="primary-action" data-save-theme>💾 Save theme</button>
    </section>`;
}

function renderMediaLibrary(fullPage = false) {
  return `
    ${fullPage ? '<div class="admin-section-header"><div><h1>Media Library</h1><p>Upload media and copy URLs for galleries and page content.</p></div></div>' : ''}
    <section class="media-library panel-card">
      <h3>🖼 Media</h3>
      <label>Upload image or file<input type="file" data-media-upload /></label>
      <p class="hint">Uploaded files are stored in <code>/public/uploads</code> and can be inserted into gallery fields.</p>
      <div class="media-grid library-grid">
        ${(state.site.media || []).map((item) => `
          <button class="media-card" data-copy-media="${escapeHtml(item.url)}" title="Click to copy URL">
            ${item.type?.startsWith('image/') ? `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}" />` : '<span class="file-chip">FILE</span>'}
            <small>${escapeHtml(item.name)}</small>
          </button>`).join('')}
      </div>
    </section>`;
}

function renderUserManagement() {
  const selectedUser = getSelectedUser();
  return `
    <div class="admin-section-header"><div><h1>User Management</h1><p>Create, view, and edit admin users.</p></div><button class="primary-action" data-create-user>＋ New user</button></div>
    <div class="manager-grid">
      <aside class="panel-card item-list">
        ${state.site.users.map((user) => `<button class="${user.id === selectedUser?.id ? 'selected' : ''}" data-select-user="${user.id}"><span>${escapeHtml(user.name)}</span><small>${escapeHtml(user.username)} · ${escapeHtml(user.role)} · ${escapeHtml(user.status)}</small></button>`).join('')}
      </aside>
      ${selectedUser ? renderUserEditor(selectedUser) : '<section class="empty-state">Create a user to begin.</section>'}
    </div>`;
}

function renderUserEditor(user) {
  return `
    <section class="panel-card user-editor">
      <h2>${escapeHtml(user.name)}</h2>
      <div class="meta-grid">
        <label>Name<input data-user-field="name" value="${escapeHtml(user.name)}" /></label>
        <label>Username<input data-user-field="username" value="${escapeHtml(user.username)}" /></label>
        <label>Email<input data-user-field="email" value="${escapeHtml(user.email)}" /></label>
        <label>Role<select data-user-field="role">${['Administrator', 'Editor', 'Author', 'Viewer'].map((role) => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select></label>
        <label>Status<select data-user-field="status"><option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option><option value="disabled" ${user.status === 'disabled' ? 'selected' : ''}>Disabled</option></select></label>
        <label>New password<input data-user-field="password" type="password" placeholder="Leave blank to keep current" /></label>
      </div>
      <button class="primary-action" data-save-user>💾 Save user</button>
    </section>`;
}

function renderNavigationBuilder() {
  return `
    <div class="admin-section-header"><div><h1>Navigation Builder</h1><p>Create and edit links shown in the public navigation strip.</p></div><button class="primary-action" data-add-nav>＋ Add link</button></div>
    <section class="panel-card nav-builder">
      ${(state.site.navigation || []).map((item, index) => `
        <article class="nav-row">
          <label>Label<input data-nav-label="${index}" value="${escapeHtml(item.label)}" /></label>
          <label>URL<input data-nav-url="${index}" value="${escapeHtml(item.url)}" /></label>
          <label class="checkbox-label"><input type="checkbox" data-nav-visible="${index}" ${item.visible ? 'checked' : ''} /> Visible</label>
          <button class="text-button" data-remove-nav="${index}">Remove</button>
        </article>`).join('')}
      <button class="primary-action" data-save-nav>💾 Save navigation</button>
    </section>`;
}

function renderPlugins() {
  return `
    <div class="admin-section-header"><div><h1>Plugins</h1><p>Enable or disable built-in extension placeholders.</p></div></div>
    <section class="plugins-grid">
      ${state.site.plugins.map((plugin, index) => `
        <article class="plugin-card panel-card">
          <div><h2>${escapeHtml(plugin.name)}</h2><p>${escapeHtml(plugin.description)}</p>${renderPluginFeatures(plugin, index)}</div>
          <label class="checkbox-label"><input type="checkbox" data-plugin-enabled="${index}" ${plugin.enabled ? 'checked' : ''} /> Enabled</label>
        </article>`).join('')}
    </section>
    <button class="primary-action" data-save-plugins>💾 Save plugins</button>`;
}

function renderPluginFeatures(plugin, pluginIndex) {
  if (plugin.id !== 'ecommerce' || !Array.isArray(plugin.features)) return '';
  return `<div class="plugin-features"><strong>Ecommerce features</strong>${plugin.features.map((feature, featureIndex) => `
    <label class="checkbox-label"><input type="checkbox" data-plugin-feature="${pluginIndex}:${featureIndex}" ${feature.enabled ? 'checked' : ''} /> ${escapeHtml(feature.name)}</label>`).join('')}</div>`;
}

function renderPluginSettingsPage(pluginId) {
  const plugin = state.site.plugins.find((candidate) => candidate.id === pluginId);
  if (!plugin || !plugin.enabled) return '<section class="empty-state">Enable this plugin to manage its settings.</section>';

  return `
    <div class="admin-section-header"><div><h1>${escapeHtml(plugin.name)} Settings</h1><p>Configure settings for the enabled ${escapeHtml(plugin.name)} plugin.</p></div><button class="primary-action" data-save-plugin-settings>💾 Save settings</button></div>
    <section class="panel-card plugin-settings-card">
      ${renderPluginSettingsFields(plugin)}
    </section>`;
}

function renderPluginSettingsFields(plugin) {
  if (plugin.id === 'forms') {
    return `
      <label>Recipient email<input data-plugin-setting="recipientEmail" value="${escapeHtml(plugin.settings?.recipientEmail)}" /></label>
      <label>Success message<textarea data-plugin-setting="successMessage">${escapeHtml(plugin.settings?.successMessage)}</textarea></label>`;
  }
  if (plugin.id === 'analytics') {
    return `
      <label>Provider<input data-plugin-setting="provider" value="${escapeHtml(plugin.settings?.provider)}" /></label>
      <label>Measurement ID<input data-plugin-setting="measurementId" value="${escapeHtml(plugin.settings?.measurementId)}" placeholder="G-XXXXXXXXXX" /></label>`;
  }
  if (plugin.id === 'blog') {
    return `
      <label>Posts per page<input data-plugin-setting="postsPerPage" type="number" min="1" value="${escapeHtml(plugin.settings?.postsPerPage)}" /></label>
      <label class="checkbox-label"><input type="checkbox" data-plugin-setting-checkbox="showAuthors" ${plugin.settings?.showAuthors ? 'checked' : ''} /> Show authors</label>`;
  }
  if (plugin.id === 'payments') {
    return `
      <label>Currency<input data-plugin-setting="currency" value="${escapeHtml(plugin.settings?.currency)}" /></label>
      <label class="checkbox-label"><input type="checkbox" data-plugin-setting-checkbox="testMode" ${plugin.settings?.testMode ? 'checked' : ''} /> Test mode</label>`;
  }
  if (plugin.id === 'ecommerce') {
    return `
      <label>Store name<input data-plugin-setting="storeName" value="${escapeHtml(plugin.settings?.storeName)}" /></label>
      <label>Default shipping zone<input data-plugin-setting="defaultShippingZone" value="${escapeHtml(plugin.settings?.defaultShippingZone)}" /></label>
      <label class="checkbox-label"><input type="checkbox" data-plugin-setting-checkbox="inventoryAlerts" ${plugin.settings?.inventoryAlerts ? 'checked' : ''} /> Inventory alerts</label>
      <div class="plugin-features settings-features"><strong>Ecommerce modules</strong>${(plugin.features || []).map((feature, featureIndex) => `
        <label class="checkbox-label"><input type="checkbox" data-plugin-settings-feature="${featureIndex}" ${feature.enabled ? 'checked' : ''} /> ${escapeHtml(feature.name)}</label>`).join('')}</div>`;
  }
  return '<p class="hint">No settings are available for this plugin yet.</p>';
}

function getEnabledPluginPages() {
  const pages = [];
  const enabled = (id) => state.site.plugins.find((plugin) => plugin.id === id && plugin.enabled);
  if (enabled('forms')) pages.push({ pluginId: 'forms', pageId: 'forms', label: 'Forms', icon: '▤' });
  if (enabled('analytics')) pages.push({ pluginId: 'analytics', pageId: 'dashboards', label: 'Analytics Dashboard', icon: '◷' });
  if (enabled('blog')) pages.push({ pluginId: 'blog', pageId: 'posts', label: 'Blog Posts', icon: '✎' });
  if (enabled('payments')) pages.push({ pluginId: 'payments', pageId: 'links', label: 'Payment Links', icon: '$' });

  const ecommerce = enabled('ecommerce');
  if (ecommerce) {
    (ecommerce.features || []).filter((feature) => feature.enabled).forEach((feature) => {
      const labels = { products: 'Products', inventory: 'Inventory', orders: 'Orders', coupons: 'Coupons', shipping: 'Shipping' };
      pages.push({ pluginId: 'ecommerce', pageId: feature.id, label: labels[feature.id] || feature.name, icon: '◼' });
    });
  }

  return pages;
}

function getPluginPageConfig(pluginId, pageId) {
  const configs = {
    forms: {
      forms: { title: 'Forms', description: 'Build forms and route submissions.', collection: 'forms', addLabel: 'New form', fields: [['name', 'Name'], ['fields', 'Fields'], ['destination', 'Destination']], defaults: { name: 'New form', fields: 'Name, Email', destination: 'hello@example.com' } }
    },
    analytics: {
      dashboards: { title: 'Analytics Dashboard', description: 'Track metrics surfaced by your analytics plugin.', collection: 'dashboards', addLabel: 'New metric', fields: [['metric', 'Metric'], ['value', 'Value'], ['period', 'Period']], defaults: { metric: 'New metric', value: '0', period: 'Today' } }
    },
    blog: {
      posts: { title: 'Blog Posts', description: 'Create and manage blog posts.', collection: 'posts', addLabel: 'New post', fields: [['title', 'Title'], ['slug', 'Slug'], ['author', 'Author'], ['status', 'Status']], defaults: { title: 'New post', slug: 'new-post', author: 'Site Administrator', status: 'draft' } }
    },
    payments: {
      links: { title: 'Payment Links', description: 'Create reusable payment links.', collection: 'links', addLabel: 'New payment link', fields: [['name', 'Name'], ['amount', 'Amount'], ['currency', 'Currency'], ['status', 'Status']], defaults: { name: 'New payment link', amount: '0.00', currency: 'USD', status: 'active' } }
    },
    ecommerce: {
      products: { title: 'Products', description: 'Create and edit products for your storefront.', collection: 'products', addLabel: 'New product', fields: [['name', 'Name'], ['sku', 'SKU'], ['price', 'Price'], ['status', 'Status'], ['category', 'Category'], ['description', 'Description'], ['image', 'Image URL']], defaults: { name: 'New product', sku: 'SKU-001', price: '0.00', status: 'active', category: '', description: '', image: '' } },
      inventory: { title: 'Inventory', description: 'Track stock levels and reorder thresholds.', collection: 'inventory', addLabel: 'New inventory row', fields: [['sku', 'SKU'], ['location', 'Location'], ['quantity', 'Quantity'], ['threshold', 'Threshold'], ['description', 'Description'], ['image', 'Image URL']], defaults: { sku: 'SKU-001', location: 'Main warehouse', quantity: '0', threshold: '0', description: '', image: '' } },
      orders: { title: 'Orders', description: 'View and update customer orders.', collection: 'orders', addLabel: 'New order', fields: [['orderNumber', 'Order #'], ['customer', 'Customer'], ['total', 'Total'], ['status', 'Status']], defaults: { orderNumber: '#1002', customer: 'New customer', total: '0.00', status: 'pending' } },
      coupons: { title: 'Coupons', description: 'Create discounts and coupon codes.', collection: 'coupons', addLabel: 'New coupon', fields: [['code', 'Code'], ['discount', 'Discount'], ['status', 'Status'], ['expires', 'Expires']], defaults: { code: 'SAVE10', discount: '10%', status: 'active', expires: '2026-12-31' } },
      shipping: { title: 'Shipping', description: 'Configure shipping zones, methods, and rates.', collection: 'shipping', addLabel: 'New shipping method', fields: [['zone', 'Zone'], ['method', 'Method'], ['rate', 'Rate'], ['status', 'Status']], defaults: { zone: 'Domestic', method: 'Standard', rate: '0.00', status: 'active' } }
    }
  };
  return configs[pluginId]?.[pageId];
}

function renderPluginFeaturePage(pluginId, pageId) {
  const config = getPluginPageConfig(pluginId, pageId);
  if (!config) return '<section class="empty-state">Plugin page not found.</section>';
  const pluginData = state.site.pluginData?.[pluginId] || {};
  const items = pluginData[config.collection] || [];

  return `
    <div class="admin-section-header"><div><h1>${escapeHtml(config.title)}</h1><p>${escapeHtml(config.description)}</p></div><div class="toolbar-actions"><button class="primary-action" data-plugin-data-add="${pluginId}:${pageId}">＋ ${escapeHtml(config.addLabel)}</button><button class="primary-action" data-save-plugin-data>💾 Save page</button></div></div>
    <section class="panel-card plugin-data-page">
      ${items.map((item, itemIndex) => `
        <article class="plugin-data-row">
          ${config.fields.map(([field, label]) => `<label>${escapeHtml(label)}<input data-plugin-data-field="${pluginId}:${config.collection}:${itemIndex}:${field}" value="${escapeHtml(item[field])}" /></label>`).join('')}
          <button class="text-button" data-plugin-data-remove="${pluginId}:${config.collection}:${itemIndex}">Remove</button>
        </article>`).join('') || '<p class="hint">No records yet. Add one to get started.</p>'}
    </section>`;
}

function renderPageEditor(page) {
  return `
    <section class="editor-grid">
      <div class="editor-panel">
        <div class="editor-toolbar">
          <div><h1>${escapeHtml(page.title)}</h1><p>Use <code>[[button:Label|/url|primary]]</code> or <code>[[button:Label|/url|secondary]]</code> in text fields to add inline buttons.</p></div>
          <div class="toolbar-actions"><button class="danger" data-delete-page="${page.id}">🗑 Delete</button><button class="primary-action" data-save-page>💾 Save page</button></div>
        </div>
        <div class="meta-grid">
          <label>Title<input data-page-field="title" value="${escapeHtml(page.title)}" /></label>
          <label>Slug<input data-page-field="slug" value="${escapeHtml(page.slug)}" /></label>
          <label>Status<select data-page-field="status"><option value="published" ${page.status === 'published' ? 'selected' : ''}>Published</option><option value="draft" ${page.status === 'draft' ? 'selected' : ''}>Draft</option></select></label>
          <label>Layout<select data-page-field="layout">${Object.entries(pageLayouts).map(([value, label]) => `<option value="${value}" ${normalizeLayout(page.layout) === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
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
      ${'body' in section ? field(index, 'body', section.body, 'Body', true) + `<button class="text-button" data-insert-button="${index}">Insert button token</button>` : ''}
      ${'buttonLabel' in section ? field(index, 'buttonLabel', section.buttonLabel, 'Button label') : ''}
      ${'buttonUrl' in section ? field(index, 'buttonUrl', section.buttonUrl, 'Button URL') : ''}
      ${section.type === 'features' ? renderFeatureEditor(section, index) : ''}
      ${section.type === 'gallery' ? renderGalleryEditor(section, index) : ''}
      ${section.type === 'pluginContent' ? renderPluginContentEditor(section, index) : ''}
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

function renderPluginContentEditor(section, sectionIndex) {
  const items = getPluginContentItems(section.plugin);
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))];
  return `<div class="nested-editor"><span>Plugin content</span>
    <label>Content source<select data-plugin-content-field="${sectionIndex}:plugin"><option value="blog" ${section.plugin === 'blog' ? 'selected' : ''}>Blog posts</option><option value="ecommerce" ${section.plugin === 'ecommerce' ? 'selected' : ''}>Products</option></select></label>
    <label>Display mode<select data-plugin-content-field="${sectionIndex}:mode"><option value="feed" ${section.mode === 'feed' ? 'selected' : ''}>Feed</option><option value="category" ${section.mode === 'category' ? 'selected' : ''}>Category</option><option value="specific" ${section.mode === 'specific' ? 'selected' : ''}>Specific items</option></select></label>
    <label>Category<select data-plugin-content-field="${sectionIndex}:category"><option value="">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}" ${section.category === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select></label>
    <div class="plugin-picker">${items.map((item) => `<label class="checkbox-label"><input type="checkbox" data-plugin-content-item="${sectionIndex}:${escapeHtml(item.id)}" ${(section.selectedIds || []).includes(item.id) ? 'checked' : ''} /> ${escapeHtml(item.title || item.name)}</label>`).join('') || '<p class="hint">No plugin records yet. Add posts or products from plugin pages.</p>'}</div>
  </div>`;
}

function getPluginContentItems(plugin) {
  if (plugin === 'ecommerce') return state.site.pluginData?.ecommerce?.products || [];
  return state.site.pluginData?.blog?.posts || [];
}

function renderGalleryEditor(section, sectionIndex) {
  return `<div class="nested-editor"><span>Image URLs</span>${(section.images || []).map((image, imageIndex) => `<input data-gallery-image="${sectionIndex}:${imageIndex}" value="${escapeHtml(image)}" />`).join('')}<button data-add-image="${sectionIndex}">Add image from media</button></div>`;
}

function renderPublicSite() {
  const slug = getSlugFromLocation();
  if (slug === 'cart') return renderCartPage();
  if (slug === 'checkout') return renderCheckoutPage();
  if (slug.startsWith('products/')) return renderProductPage(slug.split('/')[1]);
  const page = state.site.pages.find((candidate) => candidate.slug === slug && candidate.status === 'published') || state.site.pages.find((candidate) => candidate.slug === 'home') || state.site.pages[0];
  const navigation = getPublicNavigation();
  return `
    <main>
      <section class="site-hero-strip"><p>${escapeHtml(state.site.settings.siteName)}</p><div>${navigation.map((item) => `<a href="${escapeHtml(item.url)}">${escapeHtml(item.label)}</a>`).join('')}</div></section>
      ${page ? renderPage(page) : '<div class="empty-state">No published pages yet.</div>'}
    </main>`;
}

function getPublicNavigation() {
  const navigation = (state.site.navigation || []).filter((item) => item.visible);
  return isEcommerceEnabled() && !navigation.some((item) => item.url === '/cart')
    ? [...navigation, { id: 'nav-cart', label: `Cart (${getCartCount()})`, url: '/cart', visible: true }, { id: 'nav-checkout', label: 'Checkout', url: '/checkout', visible: true }]
    : navigation;
}

function renderCartPage() {
  const cartItems = state.cart.map((item) => ({ ...item, product: getPluginContentItems('ecommerce').find((product) => product.id === item.id) })).filter((item) => item.product);
  const total = cartItems.reduce((sum, item) => sum + Number(item.product.price || 0) * item.quantity, 0).toFixed(2);
  return `<main>
    <section class="site-hero-strip"><p>${escapeHtml(state.site.settings.siteName)}</p><div>${getPublicNavigation().map((item) => `<a href="${escapeHtml(item.url)}">${escapeHtml(item.label)}</a>`).join('')}</div></section>
    <section class="block cart-page"><h1>Cart</h1>${cartItems.length ? `<div class="cart-list">${cartItems.map((item) => `<article class="cart-row">${item.product.image ? `<img src="${escapeHtml(item.product.image)}" alt="${escapeHtml(item.product.name)}" />` : ''}<div><h2>${escapeHtml(item.product.name)}</h2><p>${escapeHtml(item.product.sku)} · $${escapeHtml(item.product.price)}</p><label class="quantity-control">Qty <input type="number" min="1" data-cart-qty="${escapeHtml(item.id)}" value="${item.quantity}" /></label></div><button class="text-button" data-cart-remove="${escapeHtml(item.id)}">Remove</button></article>`).join('')}</div><div class="cart-total"><strong>Total: $${total}</strong><a class="primary-action" href="/checkout">Checkout</a></div>` : '<p class="hint">Your cart is empty.</p>'}</section>
  </main>`;
}

function renderProductPage(productId) {
  const product = getPluginContentItems('ecommerce').find((item) => item.id === productId || item.sku === productId);
  if (!product) return `<main><section class="block empty-state">Product not found.</section></main>`;
  return `<main>
    <section class="site-hero-strip"><p>${escapeHtml(state.site.settings.siteName)}</p><div>${getPublicNavigation().map((item) => `<a href="${escapeHtml(item.url)}">${escapeHtml(item.label)}</a>`).join('')}</div></section>
    <section class="block product-page"><div>${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />` : ''}</div><div><p class="eyebrow">${escapeHtml(product.category || 'Product')}</p><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description || '')}</p><strong>$${escapeHtml(product.price)}</strong><label class="quantity-control">Qty <input type="number" min="1" data-product-qty="${escapeHtml(product.id)}" value="1" /></label><button class="primary-action" data-add-cart="${escapeHtml(product.id)}">Add to cart</button></div></section>
  </main>`;
}

function renderCheckoutPage() {
  const payments = state.site.plugins.find((plugin) => plugin.id === 'payments');
  const cartItems = state.cart.map((item) => ({ ...item, product: getPluginContentItems('ecommerce').find((product) => product.id === item.id) })).filter((item) => item.product);
  const total = cartItems.reduce((sum, item) => sum + Number(item.product.price || 0) * item.quantity, 0).toFixed(2);
  return `<main>
    <section class="site-hero-strip"><p>${escapeHtml(state.site.settings.siteName)}</p><div>${getPublicNavigation().map((item) => `<a href="${escapeHtml(item.url)}">${escapeHtml(item.label)}</a>`).join('')}</div></section>
    <section class="block checkout-page"><h1>Checkout</h1>${payments?.enabled ? `<p>Payments plugin enabled · Currency ${escapeHtml(payments.settings?.currency || 'USD')} · ${payments.settings?.testMode ? 'Test mode' : 'Live mode'}</p>` : '<p class="hint">Enable the Payments plugin to process checkout.</p>'}<div class="cart-list">${cartItems.map((item) => `<article class="cart-row"><div><h2>${escapeHtml(item.product.name)}</h2><p>Qty ${item.quantity} · $${escapeHtml(item.product.price)}</p></div></article>`).join('') || '<p class="hint">Your cart is empty.</p>'}</div><div class="cart-total"><strong>Total: $${total}</strong><button class="primary-action" ${payments?.enabled && cartItems.length ? '' : 'disabled'}>Place order</button></div></section>
  </main>`;
}

function renderPage(page) {
  const layout = normalizeLayout(page.layout);
  const sidebar = layout === 'sidebar' ? renderPageSidebar(page) : '';
  return `<article class="page-renderer layout-${layout}">${sidebar}<div class="layout-content">${page.sections.map(renderSection).join('')}</div></article>`;
}

function normalizeLayout(layout) {
  return Object.prototype.hasOwnProperty.call(pageLayouts, layout) ? layout : 'standard';
}

function renderPageSidebar(page) {
  const links = page.sections
    .map((section, index) => section.headline ? `<a href="#section-${escapeHtml(section.id || index)}">${escapeHtml(section.headline)}</a>` : '')
    .join('');
  return `<aside class="layout-sidebar-nav"><strong>${escapeHtml(page.title)}</strong>${links}</aside>`;
}

function renderSection(section) {
  if (section.type === 'hero') return `<section id="section-${escapeHtml(section.id || 'hero')}" class="block hero-block"><p class="eyebrow">${escapeHtml(section.eyebrow)}</p><h1>${escapeHtml(section.headline)}</h1>${renderRichText(section.body)}<a class="button" href="${escapeHtml(section.buttonUrl)}">${escapeHtml(section.buttonLabel)}</a></section>`;
  if (section.type === 'features') return `<section id="section-${escapeHtml(section.id || 'features')}" class="block"><h2>${escapeHtml(section.headline)}</h2><div class="feature-grid">${(section.items || []).map((item) => `<div class="feature"><h3>${escapeHtml(item.title)}</h3>${renderRichText(item.body)}</div>`).join('')}</div></section>`;
  if (section.type === 'gallery') return `<section id="section-${escapeHtml(section.id || 'gallery')}" class="block"><h2>${escapeHtml(section.headline)}</h2><div class="gallery">${(section.images || []).map((image, index) => `<img src="${escapeHtml(image)}" alt="${escapeHtml(section.headline || 'Gallery')} ${index + 1}" />`).join('')}</div></section>`;
  if (section.type === 'cta') return `<section id="section-${escapeHtml(section.id || 'cta')}" class="block cta-block"><h2>${escapeHtml(section.headline)}</h2>${renderRichText(section.body)}<a class="button" href="${escapeHtml(section.buttonUrl)}">${escapeHtml(section.buttonLabel)}</a></section>`;
  if (section.type === 'pluginContent') return renderPluginContentSection(section);
  return `<section id="section-${escapeHtml(section.id || 'text')}" class="block text-block"><h2>${escapeHtml(section.headline)}</h2>${renderRichText(section.body)}</section>`;
}

function renderPluginContentSection(section) {
  const items = getFilteredPluginItems(section);
  const isProducts = section.plugin === 'ecommerce';
  return `<section id="section-${escapeHtml(section.id || 'plugin-content')}" class="block plugin-content-block"><h2>${escapeHtml(section.headline)}</h2><div class="plugin-content-grid">${items.map((item) => `
    <article class="plugin-content-card">${isProducts && item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />` : ''}<h3>${isProducts ? `<a href="/products/${escapeHtml(item.id)}">${escapeHtml(item.name)}</a>` : escapeHtml(item.title || item.name)}</h3>${isProducts ? `<p>SKU: ${escapeHtml(item.sku)} · $${escapeHtml(item.price)}</p>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}${isEcommerceEnabled() ? `<label class="quantity-control">Qty <input type="number" min="1" data-product-qty="${escapeHtml(item.id)}" value="1" /></label><button class="primary-action" data-add-cart="${escapeHtml(item.id)}">Add to cart</button>` : ''}` : `<p>${escapeHtml(item.author)} · ${escapeHtml(item.status)}</p>`}${item.category ? `<small>${escapeHtml(item.category)}</small>` : ''}</article>`).join('') || '<p class="hint">No matching content found.</p>'}</div></section>`;
}

function isEcommerceEnabled() {
  return Boolean(state.site.plugins.find((plugin) => plugin.id === 'ecommerce' && plugin.enabled));
}

function getCartCount() {
  return state.cart.reduce((sum, item) => sum + item.quantity, 0);
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem('webux_cart') || '[]');
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem('webux_cart', JSON.stringify(state.cart));
}

function getFilteredPluginItems(section) {
  let items = getPluginContentItems(section.plugin);
  if (section.mode === 'category' && section.category) items = items.filter((item) => item.category === section.category);
  if (section.mode === 'specific') items = items.filter((item) => (section.selectedIds || []).includes(item.id));
  return items;
}

function renderRichText(text = '') {
  const tokenPattern = /\[\[button:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]\]/g;
  let html = '';
  let cursor = 0;
  for (const match of text.matchAll(tokenPattern)) {
    html += escapeHtml(text.slice(cursor, match.index)).replaceAll('\n', '<br />');
    const variant = match[3] === 'secondary' ? 'secondary' : 'primary';
    html += `<a class="inline-button ${variant}" href="${escapeHtml(match[2])}">${escapeHtml(match[1])}</a>`;
    cursor = match.index + match[0].length;
  }
  html += escapeHtml(text.slice(cursor)).replaceAll('\n', '<br />');
  return `<p>${html}</p>`;
}

function bindNavigation() {
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    state.view = button.dataset.view;
    window.history.pushState({}, '', state.view === 'admin' ? '/admin' : '/');
    render();
  }));
  document.querySelector('[data-logout]')?.addEventListener('click', logout);
  document.querySelectorAll('[data-add-cart]').forEach((button) => button.addEventListener('click', () => addToCart(button.dataset.addCart)));
  document.querySelectorAll('[data-cart-remove]').forEach((button) => button.addEventListener('click', () => removeFromCart(button.dataset.cartRemove)));
  document.querySelectorAll('[data-cart-qty]').forEach((input) => input.addEventListener('change', () => updateCartQuantity(input.dataset.cartQty, input.value)));
}

function bindAdmin() {
  if (!state.auth.authenticated) {
    document.querySelector('[data-login-form]')?.addEventListener('submit', login);
    return;
  }

  document.querySelectorAll('[data-admin-section]').forEach((button) => button.addEventListener('click', () => {
    state.adminSection = button.dataset.adminSection;
    render();
  }));

  if (state.adminSection === 'content') bindContentManagement();
  if (state.adminSection === 'theme') bindTheme();
  if (state.adminSection === 'media') bindMedia();
  if (state.adminSection === 'users') bindUsers();
  if (state.adminSection === 'navigation') bindNavigationBuilder();
  if (state.adminSection === 'plugins') bindPlugins();
  if (state.adminSection.startsWith('plugin-settings:')) bindPluginSettings();
  if (state.adminSection.startsWith('plugin-page:')) bindPluginFeaturePage();
}

function bindContentManagement() {
  const selectedPage = getSelectedPage();
  document.querySelector('[data-create-page]')?.addEventListener('click', createPage);
  document.querySelector('[data-save-page]')?.addEventListener('click', savePage);
  document.querySelector(`[data-delete-page="${selectedPage?.id}"]`)?.addEventListener('click', () => deletePage(selectedPage.id));
  document.querySelectorAll('[data-select-page]').forEach((button) => button.addEventListener('click', () => { state.selectedPageId = button.dataset.selectPage; render(); }));
  document.querySelectorAll('[data-page-field]').forEach((input) => input.addEventListener('input', () => { selectedPage[input.dataset.pageField] = input.value; render(); }));
  document.querySelectorAll('[data-section-field]').forEach((input) => input.addEventListener('input', () => { selectedPage.sections[Number(input.dataset.sectionIndex)][input.dataset.sectionField] = input.value; render(); }));
  document.querySelectorAll('[data-insert-button]').forEach((button) => button.addEventListener('click', () => { const section = selectedPage.sections[Number(button.dataset.insertButton)]; section.body = `${section.body || ''} [[button:Button label|/target-url|primary]]`; render(); }));
  document.querySelectorAll('[data-add-section]').forEach((button) => button.addEventListener('click', () => { selectedPage.sections.push({ ...structuredClone(sectionDefaults[button.dataset.addSection]), id: `section-${Date.now()}` }); render(); }));
  document.querySelectorAll('[data-remove-section]').forEach((button) => button.addEventListener('click', () => { selectedPage.sections.splice(Number(button.dataset.removeSection), 1); render(); }));
  document.querySelectorAll('[data-feature-title]').forEach((input) => input.addEventListener('input', () => updateFeature(input, 'title')));
  document.querySelectorAll('[data-feature-body]').forEach((input) => input.addEventListener('input', () => updateFeature(input, 'body')));
  document.querySelectorAll('[data-add-feature]').forEach((button) => button.addEventListener('click', () => { selectedPage.sections[Number(button.dataset.addFeature)].items.push({ title: 'New feature', body: 'Describe this feature. [[button:Learn more|/learn|secondary]]' }); render(); }));
  document.querySelectorAll('[data-gallery-image]').forEach((input) => input.addEventListener('input', () => { const [sectionIndex, imageIndex] = input.dataset.galleryImage.split(':').map(Number); selectedPage.sections[sectionIndex].images[imageIndex] = input.value; render(); }));
  document.querySelectorAll('[data-add-image]').forEach((button) => button.addEventListener('click', () => { selectedPage.sections[Number(button.dataset.addImage)].images.push(state.site.media?.[0]?.url || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=80'); render(); }));
  document.querySelectorAll('[data-plugin-content-field]').forEach((input) => input.addEventListener('change', () => {
    const [sectionIndex, field] = input.dataset.pluginContentField.split(':');
    const section = selectedPage.sections[Number(sectionIndex)];
    section[field] = input.value;
    if (field === 'plugin') { section.category = ''; section.selectedIds = []; }
    render();
  }));
  document.querySelectorAll('[data-plugin-content-item]').forEach((input) => input.addEventListener('change', () => {
    const [sectionIndex, itemId] = input.dataset.pluginContentItem.split(':');
    const section = selectedPage.sections[Number(sectionIndex)];
    section.selectedIds = section.selectedIds || [];
    section.selectedIds = input.checked ? [...new Set([...section.selectedIds, itemId])] : section.selectedIds.filter((id) => id !== itemId);
  }));
}

function bindTheme() {
  document.querySelector('[data-save-theme]')?.addEventListener('click', saveTheme);
}

function bindMedia() {
  document.querySelector('[data-media-upload]')?.addEventListener('change', uploadMedia);
  document.querySelectorAll('[data-copy-media]').forEach((button) => button.addEventListener('click', () => navigator.clipboard?.writeText(button.dataset.copyMedia).then(() => showNotice('Media URL copied'))));
}

function bindUsers() {
  document.querySelector('[data-create-user]')?.addEventListener('click', createUser);
  document.querySelector('[data-save-user]')?.addEventListener('click', saveUser);
  document.querySelectorAll('[data-select-user]').forEach((button) => button.addEventListener('click', () => { state.selectedUserId = button.dataset.selectUser; render(); }));
  document.querySelectorAll('[data-user-field]').forEach((input) => input.addEventListener('input', () => {
    const user = getSelectedUser();
    if (input.dataset.userField !== 'password' || input.value) user[input.dataset.userField] = input.value;
  }));
}

function bindNavigationBuilder() {
  document.querySelector('[data-add-nav]')?.addEventListener('click', () => { state.site.navigation.push({ id: `nav-${Date.now()}`, label: 'New link', url: '/', visible: true }); render(); });
  document.querySelector('[data-save-nav]')?.addEventListener('click', saveNavigation);
  document.querySelectorAll('[data-nav-label]').forEach((input) => input.addEventListener('input', () => { state.site.navigation[Number(input.dataset.navLabel)].label = input.value; }));
  document.querySelectorAll('[data-nav-url]').forEach((input) => input.addEventListener('input', () => { state.site.navigation[Number(input.dataset.navUrl)].url = input.value; }));
  document.querySelectorAll('[data-nav-visible]').forEach((input) => input.addEventListener('change', () => { state.site.navigation[Number(input.dataset.navVisible)].visible = input.checked; }));
  document.querySelectorAll('[data-remove-nav]').forEach((button) => button.addEventListener('click', () => { state.site.navigation.splice(Number(button.dataset.removeNav), 1); render(); }));
}

function bindPluginFeaturePage() {
  document.querySelector('[data-save-plugin-data]')?.addEventListener('click', savePluginData);
  document.querySelector('[data-plugin-data-add]')?.addEventListener('click', (event) => {
    const [pluginId, pageId] = event.currentTarget.dataset.pluginDataAdd.split(':');
    const config = getPluginPageConfig(pluginId, pageId);
    const collection = ensurePluginCollection(pluginId, config.collection);
    collection.push({ id: `${config.collection}-${Date.now()}`, ...config.defaults });
    render();
  });
  document.querySelectorAll('[data-plugin-data-remove]').forEach((button) => button.addEventListener('click', () => {
    const [pluginId, collectionName, itemIndex] = button.dataset.pluginDataRemove.split(':');
    ensurePluginCollection(pluginId, collectionName).splice(Number(itemIndex), 1);
    render();
  }));
  document.querySelectorAll('[data-plugin-data-field]').forEach((input) => input.addEventListener('input', () => {
    const [pluginId, collectionName, itemIndex, field] = input.dataset.pluginDataField.split(':');
    ensurePluginCollection(pluginId, collectionName)[Number(itemIndex)][field] = input.value;
  }));
}

function ensurePluginCollection(pluginId, collectionName) {
  state.site.pluginData = state.site.pluginData || {};
  state.site.pluginData[pluginId] = state.site.pluginData[pluginId] || {};
  state.site.pluginData[pluginId][collectionName] = state.site.pluginData[pluginId][collectionName] || [];
  return state.site.pluginData[pluginId][collectionName];
}

function bindPluginSettings() {
  const pluginId = state.adminSection.split(':')[1];
  const plugin = state.site.plugins.find((candidate) => candidate.id === pluginId);
  if (!plugin) return;

  document.querySelectorAll('[data-plugin-setting]').forEach((input) => input.addEventListener('input', () => {
    plugin.settings = { ...(plugin.settings || {}), [input.dataset.pluginSetting]: input.value };
  }));
  document.querySelectorAll('[data-plugin-setting-checkbox]').forEach((input) => input.addEventListener('change', () => {
    plugin.settings = { ...(plugin.settings || {}), [input.dataset.pluginSettingCheckbox]: input.checked };
  }));
  document.querySelectorAll('[data-plugin-settings-feature]').forEach((input) => input.addEventListener('change', () => {
    plugin.features[Number(input.dataset.pluginSettingsFeature)].enabled = input.checked;
  }));
  document.querySelector('[data-save-plugin-settings]')?.addEventListener('click', savePlugins);
}

function bindPlugins() {
  document.querySelectorAll('[data-plugin-enabled]').forEach((input) => input.addEventListener('change', () => { state.site.plugins[Number(input.dataset.pluginEnabled)].enabled = input.checked; }));
  document.querySelectorAll('[data-plugin-feature]').forEach((input) => input.addEventListener('change', () => {
    const [pluginIndex, featureIndex] = input.dataset.pluginFeature.split(':').map(Number);
    state.site.plugins[pluginIndex].features[featureIndex].enabled = input.checked;
  }));
  document.querySelector('[data-save-plugins]')?.addEventListener('click', savePlugins);
}

function getSelectedPage() {
  return state.site.pages.find((page) => page.id === state.selectedPageId) || state.site.pages[0];
}

function getSelectedUser() {
  return state.site.users.find((user) => user.id === state.selectedUserId) || state.site.users[0];
}

function getSlugFromLocation() {
  const slug = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
  return slug && slug !== 'admin' ? slug : 'home';
}

function syncDocumentTitle() {
  document.title = state.site?.settings?.siteName || 'WebUX CMS';
}

function showNotice(message) {
  state.notice = message;
  state.error = '';
  render();
  setTimeout(() => { state.notice = ''; render(); }, 2200);
}

function showError(message) {
  state.error = message;
  render();
  setTimeout(() => { state.error = ''; render(); }, 3000);
}

function addToCart(productId) {
  const quantity = Math.max(1, Number(document.querySelector(`[data-product-qty="${CSS.escape(productId)}"]`)?.value || 1));
  const existing = state.cart.find((item) => item.id === productId);
  if (existing) existing.quantity += quantity;
  else state.cart.push({ id: productId, quantity });
  saveCart();
  showNotice('Added to cart');
}

function updateCartQuantity(productId, quantity) {
  const item = state.cart.find((candidate) => candidate.id === productId);
  if (item) item.quantity = Math.max(1, Number(quantity || 1));
  saveCart();
  render();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.id !== productId);
  saveCart();
  render();
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    state.auth = await api.login({ username: form.get('username'), password: form.get('password') });
    showNotice('Logged in');
  } catch (error) {
    showError(error.message);
  }
}

async function logout() {
  state.auth = await api.logout();
  showNotice('Logged out');
}

async function createPage() {
  const page = await api.createPage({ title: 'New landing page', status: 'draft', layout: 'landing', sections: [sectionDefaults.hero] });
  state.site.pages.push(page);
  state.site.navigation.push({ id: `nav-${Date.now()}`, label: page.title, url: `/${page.slug}`, visible: false });
  state.selectedPageId = page.id;
  state.adminSection = 'content';
  showNotice('Draft page created');
}

async function saveTheme() {
  const settings = { ...state.site.settings };
  document.querySelectorAll('[data-setting]').forEach((input) => { settings[input.dataset.setting] = input.value; });
  document.querySelectorAll('[data-setting-checkbox]').forEach((input) => { settings[input.dataset.settingCheckbox] = input.checked; });
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

async function uploadMedia(event) {
  const [file] = event.target.files;
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const media = await api.uploadMedia(formData);
    state.site.media = [media, ...(state.site.media || [])];
    showNotice('Media uploaded');
  } catch (error) {
    showError(error.message);
  }
}

async function createUser() {
  const user = await api.createUser({ username: `user-${Date.now()}`, name: 'New user', email: '', role: 'Editor', password: 'changeme', status: 'active' });
  state.site.users.push(user);
  state.selectedUserId = user.id;
  showNotice('User created');
}

async function saveUser() {
  const user = getSelectedUser();
  const passwordInput = document.querySelector('[data-user-field="password"]');
  const payload = { ...user };
  if (passwordInput?.value) payload.password = passwordInput.value;
  const savedUser = await api.updateUser(payload);
  state.site.users = state.site.users.map((candidate) => candidate.id === savedUser.id ? savedUser : candidate);
  state.selectedUserId = savedUser.id;
  showNotice('User saved');
}

async function saveNavigation() {
  state.site.navigation = await api.updateNavigation(state.site.navigation);
  showNotice('Navigation saved');
}

async function savePlugins() {
  state.site.plugins = await api.updatePlugins(state.site.plugins);
  showNotice('Plugin settings saved');
}

async function savePluginData() {
  state.site.pluginData = await api.updatePluginData(state.site.pluginData || {});
  showNotice('Plugin page saved');
}

function updateFeature(input, fieldName) {
  const page = getSelectedPage();
  const datasetValue = fieldName === 'title' ? input.dataset.featureTitle : input.dataset.featureBody;
  const [sectionIndex, itemIndex] = datasetValue.split(':').map(Number);
  page.sections[sectionIndex].items[itemIndex][fieldName] = input.value;
  render();
}

Promise.all([api.site(), api.session()]).then(([site, auth]) => {
  state.site = site;
  state.auth = auth;
  state.selectedPageId = site.pages[0]?.id;
  state.selectedUserId = site.users[0]?.id;
  render();
}).catch((error) => {
  document.querySelector('#root').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
