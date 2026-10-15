# Certificate Studio (MERN)

Upload a blank certificate image once, mark where the **name** and **date** go, and from then on
anyone on your team can pick it from the sidebar, type a name + date and download a high-resolution
PNG or PDF — perfectly aligned every time. Bulk mode: paste many names (one per line) and download
all certificates as a ZIP.

## Stack
- **MongoDB** — users and certificate templates (name, image size, name/date layout)
- **Express + Multer** — API, login (JWT in an httpOnly cookie), private image storage inside MongoDB (GridFS)
- **React (Vite)** — sidebar, login, upload, edit, generator, team management
- **Canvas** — draws text on the image at its *full native resolution*, so output quality equals the uploaded image

## Run locally
```bash
# 1. Backend
cd server
cp .env.example .env        # set MONGODB_URI (local or Atlas) and JWT_SECRET
npm install
npm run dev                 # http://localhost:5000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173  (proxies /api and /uploads to :5000)
```

## Production (single server)
```bash
cd client && npm install && npm run build
cd ../server && npm install
NODE_ENV=production npm start    # serves the built React app + API on one port (JWT_SECRET required)
```

## Login & roles
- The **first account** created on the sign-up screen becomes the **admin**. After that, sign-up is closed.
- **Admin** — upload, edit, delete certificates; manage the team (Team page: add people, reset passwords, change roles, remove).
- **Member** — pick a certificate from the sidebar and generate / download.
- Set `ALLOW_SIGNUP=true` in `server/.env` only if you want anyone to be able to create a member account.
- Certificate images are private — they are only served to signed-in users.
- To let members edit certificates too, change `requireAdmin` to `requireAuth` on the POST/PUT routes in `server/routes/templates.js` (and the `adminOnly` checks in `client/src/App.jsx`).

## How to use
1. **+ Upload certificate** (sidebar, admin) — a blank template (leave name/date empty), highest resolution available.
2. **Edit** — click/drag to place Name and Date; pick font, size, colour (picker, hex code or swatches), alignment.
   Long names shrink to the "max width" you set. You can also rename the certificate or **replace its image** later.
   Reopen it any time via **Edit certificate** (or **Edit** on the home page).
3. **Generate** — click a certificate in the sidebar, enter name + date, optionally tweak text colour for this download, choose PNG or PDF, download.

Layout is stored as fractions of the image, so it is identical at any resolution.

## Notes
- Certificate images are stored in MongoDB (GridFS), so they survive redeploys and need no disk. Images uploaded by older versions (in `server/uploads/`) are still served if the folder is present; otherwise open Edit and replace the image.
- Fonts load from Google Fonts (`client/index.html`). Add more there and in `FONTS` inside `client/src/render.js`.
- Max upload size is 40 MB (`server/routes/templates.js`).
- Failed logins are rate-limited in memory (10 per 15 min per IP + email).

## Deploy: GitHub + Vercel (frontend) + Render (backend) + MongoDB Atlas

Vercel hosts the React app. The Express API runs on Render (Vercel's serverless functions can't run this
long-lived server and cap request bodies at 4.5 MB). Vercel proxies `/api` and `/uploads` to Render,
so the browser sees one site and the login cookie works.

1. **GitHub** — `git init && git add . && git commit -m "Certificate Studio" && git branch -M main`,
   create an empty repo on github.com, then `git remote add origin <repo-url> && git push -u origin main`.
   (`.env`, `node_modules` and `dist` are git-ignored — never commit secrets.)
2. **MongoDB Atlas** — create a free cluster, add a database user, under *Network Access* allow `0.0.0.0/0`,
   and copy the connection string (`mongodb+srv://USER:PASS@.../certificate-generator`).
3. **Render** (backend) — New → Web Service → pick the repo. Root Directory `server`, Build `npm install`,
   Start `npm start`. Environment: `MONGODB_URI`, `JWT_SECRET` (long random string), `NODE_ENV=production`.
   Deploy and note the URL, e.g. `https://certificate-api.onrender.com` (check `/api/health`).
4. **Vercel** (frontend) — edit `client/vercel.json`: replace both `YOUR-BACKEND.onrender.com` with your Render host,
   commit and push. Then Vercel → Add New Project → import the repo, Root Directory `client`
   (framework preset Vite), Deploy.
5. Open the Vercel URL → create the first account (it becomes admin) → upload a certificate.

## Fixing `502` on /api/* (recurring problem)

A 502 means Vercel can't reach the Render backend. Check, in order:
1. `client/vercel.json` must contain your **real** Render URL (not `YOUR-BACKEND.onrender.com`).
   Set it with `cd client && node set-backend.mjs https://YOUR-SERVICE.onrender.com`, then commit + push.
2. Open `https://YOUR-SERVICE.onrender.com/api/health` — it must return `{"ok":true}`. If not, read the Render logs
   (usually `MONGODB_URI` wrong, Atlas Network Access missing `0.0.0.0/0`, or `JWT_SECRET` not set).
3. Render free tier sleeps after ~15 min idle; use a free uptime pinger (e.g. UptimeRobot) on `/api/health` to keep it awake.
