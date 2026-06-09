# WebUX CMS

WebUX CMS is a WordPress-inspired full-stack starter for building customizable marketing pages. It includes a browser-based admin dashboard, live page preview, a public site renderer, session-based admin authentication, media uploads, and a file-backed Node.js API for pages and theme settings.

## Features

- Use a multi-page admin console with Site overview, Content Management, Media Library, Theme, User Management, Navigation Builder, and Plugins sections.
- Create, edit, publish, and delete pages.
- Customize slugs, page status, per-page layouts, and reusable sections.
- Add hero, text, features, gallery, and CTA blocks.
- Update global site name, browser title, tagline, brand colors, header CTA, and announcement banner.
- Choose a page layout: standard, centered content, sidebar navigation, or landing page.
- Add inline buttons inside text by writing tokens such as `[[button:Get started|/signup|primary]]` or `[[button:Learn more|/about|secondary]]`.
- Upload media from the admin dashboard and copy uploaded URLs into gallery fields.
- Create, view, and edit users from User Management.
- Build public navigation links and toggle Forms, Analytics, Blog, Payments, and Ecommerce plugins from the dedicated Plugins section.
- Configure Ecommerce plugin features for Products, Inventory, Orders, Coupons, and Shipping.
- Open a dedicated settings page for every enabled plugin from the admin left navigation.
- Use enabled plugin feature pages for Forms, Analytics dashboards, Blog posts with large formatted content fields, Payment links, and Ecommerce Products, Inventory, Orders, Coupons, and Shipping.
- Insert blog posts or products into Content Management pages as feeds, category lists, or specific selected items, and read blog posts on standalone `/blog/:slug` pages.
- Attach larger formatted descriptions and image URLs to Ecommerce products and inventory records.
- Show Add to cart buttons, product detail pages, editable cart quantities, and a Payments-powered checkout page when Ecommerce is enabled.
- Protect admin editing routes with a simple session login.
- Serve the frontend and JSON API from the same backend.
- Run without third-party runtime dependencies.

## Getting started

```bash
npm run dev
```

Open <http://localhost:4173> for the public site or <http://localhost:4173/admin> for the editor.

Default admin credentials are:

- Username: `admin`
- Password: `admin123`

Set `ADMIN_USER` and `ADMIN_PASSWORD` in the environment to override the defaults. For production:

```bash
npm start
```

## API routes

| Method | Route | Description | Auth required |
| --- | --- | --- | --- |
| `GET` | `/api/session` | Return the current login state. | No |
| `POST` | `/api/login` | Create an admin session. | No |
| `POST` | `/api/logout` | Clear the admin session. | No |
| `GET` | `/api/site` | Return settings, pages, media, safe users, navigation, and plugins. | No |
| `PUT` | `/api/settings` | Update global theme, header, and banner settings. | Yes |
| `GET` | `/api/pages` | List pages. | No |
| `GET` | `/api/pages/:slug` | Fetch a page by slug or ID. | No |
| `POST` | `/api/pages` | Create a page. | Yes |
| `PUT` | `/api/pages/:id` | Update a page. | Yes |
| `DELETE` | `/api/pages/:id` | Delete a page. | Yes |
| `GET` | `/api/media` | List uploaded media. | No |
| `POST` | `/api/media` | Upload a media file as multipart form data with a `file` field. | Yes |
| `GET` | `/api/users` | List users without password fields. | Yes |
| `POST` | `/api/users` | Create a user. | Yes |
| `PUT` | `/api/users/:id` | Edit a user. | Yes |
| `GET` | `/api/navigation` | List navigation links. | No |
| `PUT` | `/api/navigation` | Replace navigation links. | Yes |
| `GET` | `/api/plugins` | List plugins. | No |
| `PUT` | `/api/plugins` | Toggle or edit plugin records. | Yes |
| `GET` | `/api/plugin-data` | Return plugin feature records. | No |
| `PUT` | `/api/plugin-data` | Save plugin feature records. | Yes |

Content is stored in `server/data/site.json`, including each page's `layout` value plus users, navigation links, plugin settings, and plugin feature records. Uploaded files are stored in `public/uploads/`, which makes the project easy to inspect and migrate to a database or object storage later.
