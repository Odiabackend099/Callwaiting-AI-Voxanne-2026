# AI Skills Reference Guide

This folder contains reference files that AI assistants should use to understand how to perform specific tasks for this project.

## 📋 Available Skills

### 1. Server Startup File.md
**Purpose**: Complete guide for AI to automatically start all servers

**How to Use**:
- Reference this file when you want to start the development environment
- The AI will follow the exact procedures documented
- Contains troubleshooting guide for common issues
- Includes all required environment variables and verification steps

**What It Does**:
- Starts ngrok tunnel (creates public URL)
- Starts backend server (port 3001)
- Starts frontend server (port 3000)
- Automatically configures VAPI webhook
- Verifies all systems operational

**Quick Start**:
```bash
# User says: "Start the servers" or "Run npm run startup"
# AI reads: .agent/skills/Server Startup File.md
# AI executes the procedures documented there
```

**Access Points After Startup**:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Dashboard: http://localhost:4040
- Public Webhook: https://[ngrok-url]/api/webhooks/vapi

---

## 🚀 How AI Uses These Files

1. **User Request**: "Start the servers"
2. **AI Action**: Reads `.agent/skills/Server Startup File.md`
3. **AI Executes**: Follows the documented procedure step-by-step
4. **AI Reports**: Shows user what's running and how to access

---

## 📝 File Format

All files in this folder are markdown (.md) documents structured for AI to:
- Quickly understand the task
- Execute in correct order
- Handle errors gracefully
- Report status clearly
- Provide helpful troubleshooting

---

## 🔐 Important Notes

- **Auth Token**: ngrok token is embedded in Server Startup File.md
- **Credentials**: All env variables documented in startup file
- **Security**: All sensitive info kept in appropriate locations
- **Verification**: Startup file includes health check procedures

---

## 📚 Related Documentation

For more detailed information, see:
- `/STARTUP_GUIDE.md` - Complete setup guide
- `/WEBHOOK_CONFIGURATION_GUIDE.md` - Webhook details
- `/ENV_VARIABLES_ARCHITECTURE.md` - Configuration architecture
- `/STARTUP_INDEX.md` - Navigation hub

---

**Last Updated**: January 17, 2026
**Version**: 1.0
**Status**: Ready for AI reference
