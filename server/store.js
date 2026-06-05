import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'site.json');

const defaultSite = {
  settings: {
    siteName: 'WebUX Studio',
    tagline: 'Build beautiful pages without code',
    primaryColor: '#6d5dfc',
    accentColor: '#18b892',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
  },
  pages: []
};

export async function readSite() {
  try {
    const contents = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeSite(defaultSite);
      return defaultSite;
    }
    throw error;
  }
}

export async function writeSite(site) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(site, null, 2));
  return site;
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
  const sections = Array.isArray(input.sections) ? input.sections : existingPage.sections || [];

  return {
    id,
    title,
    slug,
    status,
    updatedAt: new Date().toISOString(),
    sections: sections.map((section, index) => ({
      id: section.id || createId(`section-${index + 1}`),
      type: section.type || 'text',
      ...section
    }))
  };
}
