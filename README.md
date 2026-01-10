# CallWaiting AI - Voxanne

**AI Voice Receptionist Platform for Medical Clinics**

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn
- Supabase account
- Vapi API key
- Twilio account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Callwaiting-AI-Voxanne-2026
   ```

2. **Install dependencies**
   ```bash
   # Frontend
   npm install
   
   # Backend
   cd backend
   npm install
   ```

3. **Set up environment variables**
   - Frontend: Create `.env.local` in root (see `.env.local.example`)
   - Backend: Create `.env` in `backend/` directory (see `backend/.env.example`)

4. **Start development servers**
   ```bash
   # From root directory
   ./scripts/shared/start-all-servers.sh
   ```
   
   Or manually:
   ```bash
   # Terminal 1: Frontend (port 3000)
   npm run dev
   
   # Terminal 2: Backend (port 3001)
   cd backend && npm run dev
   
   # Terminal 3: Ngrok (for Vapi webhooks)
   ngrok http 3001
   ```

---

## 📁 Repository Structure

```
callwaiting-ai/
├── backend/               # Backend source (single source of truth)
│   ├── src/              # Source code
│   ├── docs/             # Backend-specific documentation
│   ├── config/           # Backend configuration files
│   ├── scripts/          # Backend scripts
│   └── migrations/       # Database migrations
│
├── src/                  # Frontend source (Next.js - single source of truth)
│   ├── app/             # Next.js app router pages
│   ├── components/      # React components
│   ├── lib/             # Frontend utilities
│   ├── hooks/           # React hooks
│   └── contexts/        # React contexts
│
├── docs/                 # Project-wide documentation
│   ├── architecture/    # Architecture decisions
│   ├── deployment/      # Deployment guides
│   ├── development/     # Development documentation
│   ├── features/        # Feature documentation
│   └── api/             # API documentation
│
├── infrastructure/       # Infrastructure configuration
│   ├── render.yaml      # Render deployment config
│   ├── vercel.json      # Vercel deployment config
│   └── netlify.toml     # Netlify deployment config
│
├── scripts/              # Shared scripts
│   └── shared/          # Shared utility scripts
│
└── public/               # Static assets
```

---

## 📚 Documentation

- **[Main Documentation Hub](./docs/README.md)** - Comprehensive documentation index
- **[Architecture](./docs/architecture/)** - System design and architecture
- **[Deployment Guide](./docs/deployment/)** - Deployment instructions
- **[Development Guide](./docs/development/)** - Developer setup and guidelines
- **[Features](./docs/features/)** - Feature documentation
- **[API Documentation](./docs/api/)** - API endpoints and integration

---

## 🛠️ Technology Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- TailwindCSS
- Framer Motion

### Backend
- Node.js 20
- Express.js
- TypeScript
- Supabase (PostgreSQL)
- WebSocket (ws)

### Integrations
- Vapi (AI Voice Agent)
- Twilio (Telephony)
- Supabase (Database, Auth, Storage)

---

## 🔧 Development

### Backend Development
```bash
cd backend
npm run dev          # Start development server
npm run build        # Build for production
npm test             # Run tests
```

### Frontend Development
```bash
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run lint         # Run ESLint
```

---

## 📝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

---

## 📄 License

[Your License Here]

---

## 🆘 Support

For issues and questions:
- Check [Documentation](./docs/)
- Open an issue on GitHub
- Contact the development team

---

## 🔗 Links

- **Website:** https://callwaitingai.dev
- **Dashboard:** https://callwaitingai.dev/dashboard
- **Documentation:** [./docs/README.md](./docs/README.md)
