# Environment Variables Setup

## Single Source of Truth

This project uses a **single source of truth** for environment variables to prevent confusion and scattered configuration:

### Frontend Environment Variables
**Location:** `.env.local` (project root)
- Used by Next.js automatically
- Contains `NEXT_PUBLIC_*` prefixed variables
- These are exposed to the browser

### Backend Environment Variables
**Location:** `backend/.env`
- Used by the backend server
- Contains server-side secrets
- Never exposed to the browser

## Required Environment Variables

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Backend (`backend/.env`)
```env
PORT=3001
NODE_ENV=development
SUPABASE_URL=https://lbjymlodxprzqgtyqtcq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Setup Instructions

1. **Copy the template** (if needed):
   ```bash
   cp .env.example .env.local
   cp .env.example backend/.env
   ```

2. **Update with your actual keys** from Supabase Dashboard:
   - Go to Settings → API
   - Copy `anon` key for frontend
   - Copy `service_role` key for backend (KEEP SECRET!)

3. **Never commit `.env.local` or `backend/.env`** to version control
   - These files are already in `.gitignore`

## Verification

### Test Frontend Config:
```bash
# Check if variables are loaded (Next.js loads automatically)
npm run dev
```

### Test Backend Config:
```bash
cd backend
npm run dev
# Check console for "Server started on port 3001"
```

## Troubleshooting

### Frontend can't connect to Supabase
- Verify `NEXT_PUBLIC_SUPABASE_URL` matches your Supabase project URL
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the correct `anon` key (not service_role)

### Backend "Invalid API key" errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is the correct `service_role` key
- Ensure the key has no extra spaces or newlines
- Restart the backend server after updating `.env`

### Environment variables not loading
- **Frontend**: Ensure `.env.local` is in the project root (not in `src/` or `backend/`)
- **Backend**: Ensure `backend/.env` exists and contains required variables
- Restart the development server after making changes

## Production Deployment

For production deployments, set environment variables in your hosting platform:
- **Vercel/Netlify**: Set in dashboard under "Environment Variables"
- **Render/Railway**: Set in service settings
- **Docker**: Pass via `-e` flags or `.env` file

**Important**: Use production URLs for `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_APP_URL` in production!
