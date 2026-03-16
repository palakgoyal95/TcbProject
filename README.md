# TcbProject

Full-stack blog project with:
- Backend: Django + Django REST Framework + JWT auth
- Frontend: Next.js + React + Tailwind CSS
- Database: PostgreSQL (via `DATABASE_URL`)
- Image storage: Cloudinary

## Why Vite Is Not Installed

Vite is not missing by mistake. This frontend is built with **Next.js** (`frontend/my-app/package.json`), and Next already provides:
- Dev server
- Bundling/build pipeline
- Routing and server rendering features

Using Vite together with Next in the same app would duplicate tooling and is not the standard setup.

## Prerequisites

- Python 3.14 (tested in this repo)
- Node.js 22+ (tested: `v22.21.0`)
- npm 11+ (tested: `11.6.2`)
- PostgreSQL database URL
- Cloudinary account credentials
- Google OAuth Web Client ID (only if using Google login)

## Project Structure

```text
TcbProject/
|- backend/core/          # Django project
|- frontend/my-app/       # Next.js app
|- requirements.txt
`- .env                   # Backend environment variables
```

## 1. Clone And Enter Project

```powershell
git clone <your-repo-url>
cd TcbProject
```

## 2. Backend Installation (Django)

### 2.1 Create and activate virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2.2 Install Python dependencies

```powershell
pip install -r requirements.txt
```

### 2.3 Configure backend environment

Create or update `.env` in the project root:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GOOGLE_CLIENT_ID=your_google_oauth_web_client_id
```

Important: do not commit real credentials to git.

### 2.4 Run migrations

```powershell
cd backend/core
python manage.py migrate
```

### 2.5 (Optional) Create admin user

```powershell
python manage.py createsuperuser
```

### 2.6 Start backend server

```powershell
python manage.py runserver 8000
```

Backend runs at: `http://127.0.0.1:8000`

## 3. Frontend Installation (Next.js + React)

Open a **new terminal** in project root:

```powershell
cd frontend/my-app
```

### 3.1 Install Node dependencies

```powershell
npm ci
```

If this is your first setup and lockfile is out of sync, use:

```powershell
npm install
```

### 3.2 Configure frontend environment (optional)

Create `frontend/my-app/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_web_client_id
```

If not set, app already defaults to `http://127.0.0.1:8000/api`.

### 3.3 Google Login Setup (optional)

1. Go to Google Cloud Console.
2. Create or select a project.
3. Configure OAuth consent screen.
4. Create OAuth 2.0 Client ID of type **Web application**.
5. Add authorized JavaScript origins:
   - `http://localhost:3000`
6. Copy the generated client ID and set:
   - `GOOGLE_CLIENT_ID` in root `.env` (backend)
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `frontend/my-app/.env.local` (frontend)

### 3.4 Start frontend server

```powershell
npm run dev
```

Frontend runs at: `http://localhost:3000`

## 4. Run Full Project Locally

Keep both terminals running:

- Terminal 1: Django backend on port 8000
- Terminal 2: Next.js frontend on port 3000

Then open `http://localhost:3000`.

## 5. Useful Commands

### Backend

```powershell
cd backend/core
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

### Frontend

```powershell
cd frontend/my-app
npm run dev
npm run build
npm start
npm run lint
```

## 6. API Endpoints (Quick Check)

- `POST /api/register/` - create user
- `POST /api/auth/google/` - sign in/up with Google and receive JWT tokens
- `POST /api/login/` - get JWT token pair
- `POST /api/login/refresh/` - refresh JWT token
- `GET /api/posts/` - list published posts
- `GET /api/categories/` - list categories

Base URL locally: `http://127.0.0.1:8000`

## 7. Troubleshooting

- Backend cannot start with DB error: check `DATABASE_URL`.
- Cloudinary upload fails: check Cloudinary keys in `.env`.
- Frontend cannot fetch data: ensure backend is running on port 8000 and `NEXT_PUBLIC_API_URL` is correct.
- PowerShell blocks venv activation: run PowerShell as admin and set execution policy for current user:
  - `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
