# 🚀 Startup Quick Reference

## One-Command Startup

```bash
export NGROK_AUTH_TOKEN="35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU"
cd backend && npm run startup
```

---

## 📍 Access Points

| Service | URL | Port |
|---------|-----|------|
| Frontend | `http://localhost:3000` | 3000 |
| Backend (Local) | `http://localhost:3001` | 3001 |
| Backend (Public) | `https://xxxx-xxxx.ngrok.io` | ngrok |
| ngrok Dashboard | `http://localhost:4040` | 4040 |

---

## ✅ Success Indicators

You're ready when you see:
- ✅ `ngrok tunnel ready at: https://xxxx-xxxx.ngrok.io`
- ✅ `Backend server ready on port 3001`
- ✅ `Frontend server ready on port 3000`
- ✅ `ALL SYSTEMS READY FOR DEVELOPMENT`

---

## 🔧 Prerequisites

```bash
# Check requirements
which ngrok && ngrok --version
node --version && npm --version

# Install dependencies
cd backend && npm install
cd .. && npm install
```

---

## 🛑 Stop Services

```bash
# Press Ctrl+C in the startup terminal
```

---

## 🐛 Quick Fixes

| Issue | Fix |
|-------|-----|
| Port in use | `lsof -i :3000` → `kill -9 <PID>` |
| ngrok auth fails | `ngrok config add-authtoken 35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU` |
| Backend won't start | Check `.env` has all required vars |
| Webhook not working | Verify ngrok URL in VAPI dashboard |

---

## 📖 Full Documentation

See `STARTUP_GUIDE.md` for complete troubleshooting and debugging.

---

**Pro Tip**: Bookmark these URLs for quick access:
- Frontend: http://localhost:3000
- ngrok Dashboard: http://localhost:4040
