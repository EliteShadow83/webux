import { createReadStream, promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createId, readSite, sanitizePage, writeSite } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.join(__dirname, '..', 'public');
const port = process.env.PORT || 4173;

const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
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

  if (request.method === 'GET' && url.pathname === '/api/site') {
    sendJson(response, 200, await readSite());
    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings') {
    const site = await readSite();
    site.settings = { ...site.settings, ...(await readJson(request)) };
    await writeSite(site);
    sendJson(response, 200, site.settings);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/pages') {
    const site = await readSite();
    sendJson(response, 200, site.pages);
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

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

server.listen(port, () => {
  console.log(`WebUX CMS running on http://localhost:${port}`);
});
