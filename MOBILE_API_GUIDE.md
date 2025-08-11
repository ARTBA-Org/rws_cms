## RWS CMS Mobile API Guide

This guide explains how a mobile client should authenticate and consume the CMS content (courses, modules, slides). It also proposes lightweight endpoints for per-user progress. Examples use plain HTTP so they can be replicated in any SDK (Flutter/Dart, Swift, Kotlin, etc.).

### Base URL

- Production API base: `https://main.d335csi5l6xsl9.amplifyapp.com`
- Admin UI (not used by mobile): `/admin`
- REST API base: `/api`

If you receive relative media URLs (e.g., `/media/abc.jpg`), prefix them with the base origin above.

### Collections and slugs

- Courses: `courses`
- Modules: `modules`
- Slides: `slides`

These slugs form the REST endpoints under `/api/<slug>`.

---

## Authentication

Payload provides a JWT-based login for the `users` collection.

### Login

- Endpoint: `POST /api/users/login`
- Body:

```json
{ "email": "<email>", "password": "<password>" }
```

- Successful response: `200 OK` with JSON containing `token` and `user`. A `payload-token` HttpOnly cookie is also set (useful for browsers; mobile apps can ignore it).

- Use the returned `token` on every subsequent request via the header:

```
Authorization: JWT <token>
```

#### Test account (for development only)

- Email: `abenuro@gmail.com`
- Password: `abenuro@gmail.com`

> Note: Remove or rotate this test account before any public release.

### Logout

- Endpoint: `POST /api/users/logout`
- Header: `Authorization: JWT <token>`

### Token expiry

- If the API returns `401 Unauthorized`, prompt the user to log in again (or implement a refresh flow later). Keep the token in secure storage (Keychain/Keystore/Secure Storage).

---

## Reading content

General rules for fast responses:

- Keep `depth` low (0–1) to avoid over-fetching nested relations
- Paginate with `limit` and `page`
- Sort with `sort=field` (or `-field` for descending)

### 1) List courses

Request:

```
GET /api/courses?limit=50&depth=0
Authorization: JWT <token>
```

Notes:
- Each course contains a `modules` relationship. With `depth=0`, that field is an array of IDs; you can compute `moduleCount = modules.length`.

### 2) Course detail with modules

Request:

```
GET /api/courses/<courseId>?depth=1
Authorization: JWT <token>
```

Notes:
- `depth=1` expands the course’s `modules` into full module documents.
- Inside each module, `slides` will be present as an array (usually IDs when expanded via the course), so `slideCount = slides.length`.

### 3) List modules for a course (flat list)

Option A (single call via course):

```
GET /api/courses/<courseId>?depth=1
```

Iterate `data.modules`.

Option B (two calls, if you need separate pagination/sorting):

1. Get the course to read module IDs: `GET /api/courses/<courseId>?depth=0`
2. Request modules by ID set:

```
GET /api/modules?where[id][in]=<id1>,<id2>,<id3>&limit=50&depth=0
```

### 4) Module detail with slides

Request:

```
GET /api/modules/<moduleId>?depth=1
Authorization: JWT <token>
```

Notes:
- This returns the module with a `slides` array. If you need full slide documents plus nested media, you can either:
  - Use this response directly when it already contains enough info, or
  - Make a follow-up request for slides by ID set:

```
GET /api/slides?where[id][in]=<slideId1>,<slideId2>,...&limit=200&depth=1
```

### 5) Slide images and media

- Slides have an `image` field that relates to the `media` collection. The media object contains a `url` which may be relative (e.g., `/media/<file>`). Prefix it with the base origin if needed:

```
https://main.d335csi5l6xsl9.amplifyapp.com<relative_url>
```

---

## Recommended progress model (per-user status)

Per-user progress (e.g., “14 of 25 slides”, “0 of 4 modules”) should live outside of Payload’s CMS tables. The recommended approach is to expose light server endpoints that read/write a dedicated progress store (e.g., Supabase) keyed by the authenticated Payload user ID.

### Proposed endpoints (server-provided)

- `GET /api/mobile/progress/module/<moduleId>` → `{ moduleId, completedSlides, totalSlides }`
- `GET /api/mobile/progress/course/<courseId>` → `{ courseId, completedModules, totalModules }`
- Batch variants:
  - `GET /api/mobile/progress/modules?ids=mod1,mod2,...`
  - `GET /api/mobile/progress/courses?ids=course1,course2,...`
- Mark a slide as completed:
  - `POST /api/mobile/progress/slide` with `{ moduleId, slideId, completed: true }`

All progress routes require the same `Authorization: JWT <token>` header. The server resolves the user from the token and reads/writes progress for that `user.id`.

> If these endpoints are not yet available, the mobile client can proceed with content-only rendering and wire in progress later without changing the content calls above.

---

## End-to-end examples

### Login

```
POST /api/users/login
Content-Type: application/json

{ "email": "abenuro@gmail.com", "password": "abenuro@gmail.com" }
```

Response (truncated):

```json
{
  "message": "Authentication Passed",
  "token": "<JWT>",
  "user": { "id": 1, "email": "abenuro@gmail.com" }
}
```

### Fetch courses

```
GET /api/courses?limit=50&depth=0
Authorization: JWT <JWT>
```

Example item:

```json
{
  "id": "course_1",
  "title": "Working at Night",
  "modules": ["mod_1", "mod_2", "mod_3", "mod_4"]
}
```

Compute module count as `modules.length`.

### Course detail → modules list and slide counts

```
GET /api/courses/course_1?depth=1
Authorization: JWT <JWT>
```

Example module in response:

```json
{
  "id": "mod_1",
  "title": "Worker Fatigue",
  "slides": ["slide_1", "slide_2", "slide_3", "..."],
  "moduleThumbnail": { "url": "/media/xyz.jpg" }
}
```

Compute slide count as `slides.length`.

### Module detail → slides

```
GET /api/modules/mod_1?depth=1
Authorization: JWT <JWT>
```

If you need full slide docs with media expanded:

```
GET /api/slides?where[id][in]=slide_1,slide_2,...&limit=200&depth=1
Authorization: JWT <JWT>
```

---

## Error handling

- `401 Unauthorized`: token missing/expired → prompt login
- `403 Forbidden`: user lacks access → show error UI
- `429 Too Many Requests`: back off and retry later
- `5xx`: transient server error → retry with exponential backoff

---

## Performance tips

- Use small `depth` and only request data you need
- Prefer one bulk call over many per-item calls (e.g., `where[id][in]=...`)
- Cache public, non-user-specific responses in the app (short TTL)
- Keep images lazy-loaded and sized appropriately for the device

---

## Environment notes

- During local development, the server may run at `http://localhost:3002` (see `PAYLOAD_PUBLIC_SERVER_URL`). Real devices must use the public HTTPS domain.

---

## FAQ

- Can the mobile app call the database directly?
  - No. Always use the HTTP API. CMS writes and reads should go through Payload’s API so that access control and hooks are enforced.

- Where do we store user progress?
  - In a separate store (e.g., Supabase) behind server endpoints that authenticate with the same JWT and key progress by `user.id`.


