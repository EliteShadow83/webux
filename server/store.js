import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'site.json');

const defaultSettings = {
  siteName: 'WebUX Studio',
  tagline: 'Build beautiful pages without code',
  primaryColor: '#6d5dfc',
  accentColor: '#18b892',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  headerBannerEnabled: true,
  headerBannerText: 'New: edit pages, upload media, and publish without code.',
  headerBannerUrl: '/admin',
  headerBannerBackground: '#111827',
  headerBannerTextColor: '#ffffff',
  headerCtaLabel: 'Admin',
  headerCtaUrl: '/admin'
};

const defaultUsers = [
  {
    id: 'user-admin',
    username: 'admin',
    name: 'Site Administrator',
    email: 'admin@example.com',
    role: 'Administrator',
    password: 'admin123',
    status: 'active'
  }
];

const ecommerceFeatures = [
  { id: 'products', name: 'Products', enabled: true },
  { id: 'inventory', name: 'Inventory', enabled: true },
  { id: 'orders', name: 'Orders', enabled: true },
  { id: 'coupons', name: 'Coupons', enabled: true },
  { id: 'shipping', name: 'Shipping', enabled: true }
];

const defaultPlugins = [
  { id: 'forms', name: 'Forms', description: 'Build and embed lead capture, contact, and signup forms.', enabled: false },
  { id: 'analytics', name: 'Analytics', description: 'Track page views, visitor behavior, and conversions.', enabled: false },
  { id: 'blog', name: 'Blog', description: 'Publish articles, updates, categories, and author content.', enabled: false },
  { id: 'payments', name: 'Payments', description: 'Accept one-time payments, invoices, and donation-style checkouts.', enabled: false },
  {
    id: 'ecommerce',
    name: 'Ecommerce',
    description: 'Manage products, inventory, orders, coupons, and shipping workflows.',
    enabled: false,
    features: ecommerceFeatures
  }
];

const allowedLayouts = new Set(['standard', 'centered', 'sidebar', 'landing']);
const allowedRoles = new Set(['Administrator', 'Editor', 'Author', 'Viewer']);

const defaultSite = {
  settings: defaultSettings,
  pages: [],
  media: [],
  users: defaultUsers,
  navigation: [],
  plugins: defaultPlugins
};

export async function readSite() {
  try {
    const contents = await fs.readFile(DATA_FILE, 'utf8');
    return normalizeSite(JSON.parse(contents));
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeSite(defaultSite);
      return defaultSite;
    }
    throw error;
  }
}

export async function writeSite(site) {
  const normalizedSite = normalizeSite(site);
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(normalizedSite, null, 2));
  return normalizedSite;
}

export function normalizeSite(site) {
  const pages = Array.isArray(site.pages)
    ? site.pages.map((page) => ({ layout: 'standard', ...page, layout: allowedLayouts.has(page.layout) ? page.layout : 'standard' }))
    : [];

  return {
    settings: { ...defaultSettings, ...(site.settings || {}) },
    pages,
    media: Array.isArray(site.media) ? site.media : [],
    users: Array.isArray(site.users) && site.users.length ? site.users.map(sanitizeUser) : defaultUsers,
    navigation: Array.isArray(site.navigation) && site.navigation.length ? site.navigation.map(sanitizeNavigationItem) : pages.map((page) => ({ id: createId('nav'), label: page.title, url: `/${page.slug}`, visible: page.status === 'published' })),
    plugins: mergePlugins(site.plugins)
  };
}

export function createSlug(title = 'new-page') {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'new-page';
}

export function createId(prefix = 'page') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureUniqueSlug(pages, slug, currentId) {
  const base = createSlug(slug);
  let candidate = base;
  let count = 2;

  while (pages.some((page) => page.slug === candidate && page.id !== currentId)) {
    candidate = `${base}-${count}`;
    count += 1;
  }

  return candidate;
}

export function sanitizePage(input, existingPages = [], existingPage = {}) {
  const id = existingPage.id || input.id || createId('page');
  const title = String(input.title || existingPage.title || 'Untitled page').trim();
  const slug = ensureUniqueSlug(existingPages, input.slug || title, id);
  const status = input.status === 'draft' ? 'draft' : 'published';
  const layout = allowedLayouts.has(input.layout) ? input.layout : allowedLayouts.has(existingPage.layout) ? existingPage.layout : 'standard';
  const sections = Array.isArray(input.sections) ? input.sections : existingPage.sections || [];

  return {
    id,
    title,
    slug,
    status,
    layout,
    updatedAt: new Date().toISOString(),
    sections: sections.map((section, index) => ({
      id: section.id || createId(`section-${index + 1}`),
      type: section.type || 'text',
      ...section
    }))
  };
}

export function sanitizeUser(input = {}, existingUser = {}) {
  const username = String(input.username || existingUser.username || 'new-user').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  return {
    id: existingUser.id || input.id || createId('user'),
    username,
    name: String(input.name || existingUser.name || username || 'New user').trim(),
    email: String(input.email || existingUser.email || '').trim(),
    role: allowedRoles.has(input.role) ? input.role : allowedRoles.has(existingUser.role) ? existingUser.role : 'Editor',
    password: String(input.password || existingUser.password || 'changeme'),
    status: input.status === 'disabled' ? 'disabled' : 'active'
  };
}

export function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

export function sanitizeNavigationItem(input = {}) {
  return {
    id: input.id || createId('nav'),
    label: String(input.label || 'Untitled link').trim(),
    url: String(input.url || '#').trim(),
    visible: input.visible !== false
  };
}

export function sanitizePlugin(input = {}) {
  const id = input.id || createSlug(input.name || 'plugin');
  const plugin = {
    id,
    name: String(input.name || 'Plugin').trim(),
    description: String(input.description || '').trim(),
    enabled: Boolean(input.enabled)
  };

  if (id === 'ecommerce') {
    plugin.features = mergeEcommerceFeatures(input.features);
  }

  return plugin;
}

function mergePlugins(plugins = []) {
  const incoming = Array.isArray(plugins) ? plugins.map(sanitizePlugin) : [];
  return defaultPlugins.map((plugin) => {
    const match = incoming.find((candidate) => candidate.id === plugin.id) || {};
    return sanitizePlugin({ ...plugin, ...match });
  });
}

function mergeEcommerceFeatures(features = []) {
  const incoming = Array.isArray(features) ? features : [];
  return ecommerceFeatures.map((feature) => ({
    ...feature,
    enabled: incoming.find((candidate) => candidate.id === feature.id)?.enabled ?? feature.enabled
  }));
}
