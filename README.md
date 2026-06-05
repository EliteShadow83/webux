# WebUX CMS

WebUX CMS is a WordPress-inspired full-stack starter for building customizable marketing pages. It includes a browser-based admin dashboard, live page preview, a public site renderer, and a file-backed Node.js API for pages and theme settings.

## Features

- Create, edit, publish, and delete pages.
- Customize slugs, page status, and reusable sections.
- Add hero, text, features, gallery, and CTA blocks.
- Update global site name, tagline, and brand colors.
- Serve the frontend and JSON API from the same backend.
- Run without third-party runtime dependencies.

## Getting started

```bash
npm run dev
```

Open <http://localhost:4173> for the public site or <http://localhost:4173/admin> for the editor. For production:

```bash
npm start
```

## API routes

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/site` | Return settings and all pages. |
| `PUT` | `/api/settings` | Update global theme/site settings. |
| `GET` | `/api/pages` | List pages. |
| `GET` | `/api/pages/:slug` | Fetch a page by slug or ID. |
| `POST` | `/api/pages` | Create a page. |
| `PUT` | `/api/pages/:id` | Update a page. |
| `DELETE` | `/api/pages/:id` | Delete a page. |

Content is stored in `server/data/site.json`, which makes the project easy to inspect and migrate to a database later.
