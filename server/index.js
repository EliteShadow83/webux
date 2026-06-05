import { createReadStream, promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createId, normalizePluginData, publicUser, readSite, sanitizeNavigationItem, sanitizePage, sanitizePlugin, sanitizeUser, writeSite } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.join(__dirname, '..', 'public');
const uploadPath = path.join(publicPath, 'uploads');
const port = process.env.PORT || 4173;
const sessions = new Map();
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

const mimeTypes = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.url?.startsWith('/api/')) {
      await handleApi(request, response);
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { message: 'Internal server error' });
  }
});

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const segments = url.pathname.split('/').filter(Boolean);

  if (request.method === 'GET' && url.pathname === '/api/session') {
    sendJson(response, 200, { authenticated: isAuthenticated(request), username: isAuthenticated(request) ? adminUser : null });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/login') {
    const { username, password } = await readJson(request);
    const site = await readSite();
    const user = site.users.find((candidate) => candidate.username === username && candidate.password === password && candidate.status === 'active');
    const envLogin = username === adminUser && password === adminPassword;

    if (!user && !envLogin) {
      sendJson(response, 401, { message: 'Invalid username or password' });
      return;
    }

    const token = crypto.randomUUID();
    sessions.set(token, { username, createdAt: Date.now() });
    response.setHeader('Set-Cookie', `webux_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);
    sendJson(response, 200, { authenticated: true, username });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/logout') {
    const token = getCookie(request, 'webux_session');
    if (token) sessions.delete(token);
    response.setHeader('Set-Cookie', 'webux_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    sendJson(response, 200, { authenticated: false });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/site') {
    sendJson(response, 200, toClientSite(await readSite()));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/pages') {
    const site = await readSite();
    sendJson(response, 200, site.pages);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/media') {
    const site = await readSite();
    sendJson(response, 200, site.media);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/navigation') {
    const site = await readSite();
    sendJson(response, 200, site.navigation);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/plugins') {
    const site = await readSite();
    sendJson(response, 200, site.plugins);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/plugin-data') {
    const site = await readSite();
    sendJson(response, 200, site.pluginData);
    return;
  }

  if (segments[1] === 'pages' && segments[2] && request.method === 'GET') {
    await handlePageRoute(request, response, segments[2]);
    return;
  }

  if (!isAuthenticated(request)) {
    sendJson(response, 401, { message: 'Authentication required' });
    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings') {
    const site = await readSite();
    site.settings = { ...site.settings, ...(await readJson(request)) };
    await writeSite(site);
    sendJson(response, 200, site.settings);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/users') {
    const site = await readSite();
    sendJson(response, 200, site.users.map(publicUser));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/users') {
    const site = await readSite();
    const user = sanitizeUser(await readJson(request));
    if (site.users.some((candidate) => candidate.username === user.username && candidate.id !== user.id)) {
      sendJson(response, 409, { message: 'Username already exists' });
      return;
    }
    site.users.push(user);
    await writeSite(site);
    sendJson(response, 201, publicUser(user));
    return;
  }

  if (segments[1] === 'users' && segments[2]) {
    await handleUserRoute(request, response, segments[2]);
    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/navigation') {
    const site = await readSite();
    site.navigation = (await readJson(request)).map(sanitizeNavigationItem);
    await writeSite(site);
    sendJson(response, 200, site.navigation);
    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/plugins') {
    const site = await readSite();
    site.plugins = (await readJson(request)).map(sanitizePlugin);
    await writeSite(site);
    sendJson(response, 200, site.plugins);
    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/plugin-data') {
    const site = await readSite();
    site.pluginData = normalizePluginData(await readJson(request));
    await writeSite(site);
    sendJson(response, 200, site.pluginData);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/media') {
    const media = await saveUploadedMedia(request);
    const site = await readSite();
    site.media.unshift(media);
    await writeSite(site);
    sendJson(response, 201, media);
    return;
  }

  if (segments[1] === 'pages' && segments[2]) {
    await handlePageRoute(request, response, segments[2]);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/pages') {
    const site = await readSite();
    const body = await readJson(request);
    const page = sanitizePage({
      title: 'New page',
      slug: 'new-page',
      status: 'draft',
      sections: [],
      ...body,
      id: body.id || createId('page')
    }, site.pages);

    site.pages.push(page);
    await writeSite(site);
    sendJson(response, 201, page);
    return;
  }

  sendJson(response, 404, { message: 'Route not found' });
}


async function handleUserRoute(request, response, userId) {
  const site = await readSite();
  const userIndex = site.users.findIndex((user) => user.id === userId);

  if (userIndex === -1) {
    sendJson(response, 404, { message: 'User not found' });
    return;
  }

  if (request.method === 'PUT') {
    const user = sanitizeUser(await readJson(request), site.users[userIndex]);
    if (site.users.some((candidate) => candidate.username === user.username && candidate.id !== user.id)) {
      sendJson(response, 409, { message: 'Username already exists' });
      return;
    }
    site.users[userIndex] = user;
    await writeSite(site);
    sendJson(response, 200, publicUser(user));
    return;
  }

  sendJson(response, 405, { message: 'Method not allowed' });
}

async function handlePageRoute(request, response, pageKey) {
  const site = await readSite();

  if (request.method === 'GET') {
    const page = site.pages.find((candidate) => candidate.slug === pageKey || candidate.id === pageKey);
    if (!page) {
      sendJson(response, 404, { message: 'Page not found' });
      return;
    }
    sendJson(response, 200, page);
    return;
  }

  if (request.method === 'PUT') {
    const pageIndex = site.pages.findIndex((page) => page.id === pageKey);
    if (pageIndex === -1) {
      sendJson(response, 404, { message: 'Page not found' });
      return;
    }

    const page = sanitizePage(await readJson(request), site.pages, site.pages[pageIndex]);
    site.pages[pageIndex] = page;
    await writeSite(site);
    sendJson(response, 200, page);
    return;
  }

  if (request.method === 'DELETE') {
    const nextPages = site.pages.filter((page) => page.id !== pageKey);
    if (nextPages.length === site.pages.length) {
      sendJson(response, 404, { message: 'Page not found' });
      return;
    }

    site.pages = nextPages;
    await writeSite(site);
    response.writeHead(204);
    response.end();
    return;
  }

  sendJson(response, 405, { message: 'Method not allowed' });
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = path.normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '');
  const filePath = path.join(publicPath, requestedPath || 'index.html');

  if (!filePath.startsWith(publicPath)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    createReadStream(path.join(publicPath, 'index.html')).pipe(response);
  }
}

async function saveUploadedMedia(request) {
  const contentType = request.headers['content-type'] || '';
  const boundary = contentType.match(/boundary=(.+)$/)?.[1];
  if (!boundary) throw new Error('Missing multipart boundary');

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const file = parseMultipartFile(body, boundary);
  if (!file) throw new Error('No upload file found');

  const safeName = path.basename(file.filename).replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
  const extension = path.extname(safeName);
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${extension || '.bin'}`;
  await fs.mkdir(uploadPath, { recursive: true });
  await fs.writeFile(path.join(uploadPath, filename), file.content);

  return {
    id: createId('media'),
    name: safeName || filename,
    url: `/uploads/${filename}`,
    type: file.contentType || 'application/octet-stream',
    size: file.content.length,
    uploadedAt: new Date().toISOString()
  };
}

function parseMultipartFile(body, boundary) {
  const boundaryText = `--${boundary}`;
  const bodyText = body.toString('binary');
  const parts = bodyText.split(boundaryText);

  for (const part of parts) {
    if (!part.includes('name="file"')) continue;
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const header = part.slice(0, headerEnd);
    const filename = header.match(/filename="([^"]+)"/)?.[1];
    const contentType = header.match(/Content-Type:\s*([^\r\n]+)/i)?.[1];
    if (!filename) continue;

    let contentBinary = part.slice(headerEnd + 4);
    if (contentBinary.endsWith('\r\n')) contentBinary = contentBinary.slice(0, -2);
    return { filename, contentType, content: Buffer.from(contentBinary, 'binary') };
  }

  return null;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

function getCookie(request, name) {
  return (request.headers.cookie || '')
    .split(';')
    .map((cookie) => cookie.trim().split('='))
    .find(([key]) => key === name)?.[1];
}

function isAuthenticated(request) {
  const token = getCookie(request, 'webux_session');
  return Boolean(token && sessions.has(token));
}

function toClientSite(site) {
  return { ...site, users: site.users.map(publicUser) };
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

server.listen(port, () => {
  console.log(`WebUX CMS running on http://localhost:${port}`);
  console.log(`Admin login: ${adminUser} / ${process.env.ADMIN_PASSWORD ? 'configured password' : adminPassword}`);
});
