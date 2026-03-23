# Frontend (Next.js)

This frontend is built with **Next.js + React**.

## Why no Vite?

Vite is not used because this app already uses Next.js, which includes its own dev server and bundler.
Using Vite together with Next for the same app is unnecessary.

## Local Setup (Quick)

```powershell
cd frontend/my-app
npm ci
npm run dev
```

Open `http://localhost:3000`.

## API Base URL

Create `frontend/my-app/.env.local` if needed:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_web_client_id
```

If omitted, the app falls back to the same default URL.

## Google Login

Google sign-in button on `/login` is enabled when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set.
Backend must also have `GOOGLE_CLIENT_ID` in root `.env`.

## Full Project Setup

For complete backend + frontend installation steps, see:
- `../../README.md`
