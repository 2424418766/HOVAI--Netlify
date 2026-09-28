# HOVAI Photography — Netlify project

This repository is a deployable version of the HOVAI portfolio. The frontend is served as static files; portfolio edits and media uploads are stored in Netlify Blobs.

## Deploy from your GitHub repository

1. Put the contents of this project at the root of your GitHub repository and push to the default branch.
2. In Netlify, choose **Add new project → Import an existing project**, select that GitHub repository, and deploy it. The included `netlify.toml` supplies the build and publish settings.
3. In the Netlify project, open **Project configuration → Environment variables** and add:
   - `ADMIN_PASSWORD`: a new, strong password for the Edit button.
   - `SESSION_SECRET`: a random secret, at least 32 characters. Generate one locally with `openssl rand -hex 32`.
4. Trigger a new deploy after adding the variables. Open the site, choose **管理作品 / Admin**, and sign in with `ADMIN_PASSWORD`.

Do not put either secret in GitHub or in frontend files. The signed admin session lasts 12 hours and is held in the current browser tab. Netlify Blobs is initialized by the Functions at runtime; it keeps edits and uploaded media across subsequent deploys.

## Run locally

```sh
npm install
cp .env.example .env
# Set ADMIN_PASSWORD and SESSION_SECRET in .env
npx netlify dev
```

Open the local URL printed by Netlify CLI. `npm test` runs API smoke tests; `npm run build` checks the static publish directory.

## Included behavior

- Preserves the portfolio layout and current bundled seed images.
- Password-protected editing, project saves, image/video uploads, cover crops, and admin settings.
- Uploads are sent in 4 MiB chunks to stay below Netlify's buffered function request limit. Images are optimized in the browser; MP4/WebM uploads are limited to 80 MiB and served with byte-range responses for playback and seeking.
- Portfolio saves use conditional Blobs writes, so simultaneous edits are detected rather than silently overwriting one another.

## Important migration note

This package includes the content and seed media present in the project source. It cannot include data that exists only in another Netlify site's private Blobs store. Before replacing the current site, export any newer portfolio edits and uploaded original media from the existing site. After deploying this project, re-upload the highest-resolution originals in **管理作品 / Admin**. The bundled sample images are mostly 1280 px wide, so use your original full-resolution photos for the final portfolio when image sharpness matters.

Netlify's storage, function, and bandwidth quotas depend on the plan. See the current [Netlify Blobs documentation](https://docs.netlify.com/build/data-and-storage/netlify-blobs/) and [Functions limits](https://docs.netlify.com/build/functions/configuration/) before uploading a large video collection.
