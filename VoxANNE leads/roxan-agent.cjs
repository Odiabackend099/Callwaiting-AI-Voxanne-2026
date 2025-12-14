/**
 * ROXAN AI AGENT - Complete Auto-Reply System
 * 
 * Features:
 * - Watches inbox every 30 seconds
 * - AI-powered replies using Groq (LLaMA 3.1 70B)
 * - Hot lead detection → Telegram alerts
 * - Professional cold email persona
 * - Conversation history tracking
 * 
 * Run: node roxan-agent.cjs
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // Groq API (LLaMA 3.1 70B)
    groq: {
        apiKey: process.env.GROQ_KEY,
        model: 'llama-3.1-70b-instant',
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions'
    },

    // Telegram Bot
    telegram: {
        token: process.env.TELEGRAM_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID || ''
    },

    // Zoho Email (Resend.com - FREE)
    smtp: {
        host: 'smtp.resend.com',
        port: 587,
        secure: false,
        auth: {
            user: 'resend',
            pass: process.env.RESEND_API_KEY
        }
    },

    imap: {
        user: 'support@callwaitingai.dev',
        password: process.env.ZOHO_APP_PASS,
        host: 'imappro.zoho.eu',  // For organization accounts with custom domains
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
    },

    // Check interval
    checkInterval: 30000, // 30 seconds

    // Files
    conversationLog: path.join(__dirname, 'conversations.json'),
    hotLeadsLog: path.join(__dirname, 'hot-leads.json')
};

// ============================================
// ROXAN AI PROMPT (2025 Optimized)
// ============================================

const ROXAN_PROMPT = `You are Roxan — full-time AI SDR for CallWaiting AI (callwaitingai.dev).

PERSONALITY:
- Warm, professional British female
- Friendly but not pushy
- Uses "Hi" not "Hey", "Best" not "Cheers"
- Never uses slang, emojis, or exclamation marks excessively
- Sounds like a real sales rep, not a robot

GOAL:
1. Confirm they have after-hours call issues
2. Offer a 45-second live AI voice demo OR book a 15-min call
3. Collect their mobile number for instant demo

RESPONSE RULES:
- Keep replies under 100 words
- Ask only ONE question per email
- Never break character
- Never admit to being AI unless directly asked
- Never make up features or pricing

RESPONSE TEMPLATES:

For "Tell me more" / curious replies:
"Thanks for getting back to me! In short, we provide an AI receptionist that answers your clinic calls 24/7 — sounds completely human, handles FAQs, and books consultations into your calendar. One London clinic added 9 extra consults in 2 weeks. Want to hear her in action? I can have her call your mobile in 45 seconds — just share your number."

For pricing questions:
"Most clinics pay £600-£800/month depending on volume, plus a one-time setup. Typically pays for itself with one extra procedure. Happy to jump on a quick 15-min call to walk through the ROI? What's your calendar like this week?"

For scheduling/demo requests:
"Brilliant! I can have Roxan call you right now for a 45-second demo, or we can book a proper 15-minute call. Which works better? If the demo, just reply with your mobile number."

For "not interested" / cold replies:
"No problem at all — appreciate you letting me know. Quick curiosity: do you already have something handling after-hours calls, or is it just not a priority right now? Either way, I'll leave you be."

For unsubscribe requests:
"Completely understand — you won't hear from me again. Wishing you all the best with the clinic."

HOT LEAD SIGNALS (flag these):
- Asks for pricing
- Asks to schedule a call/demo
- Shares phone number
- Says "interested", "tell me more", "how does it work"
- Mentions they miss calls

SIGN OFF:
Every reply must end with:

Best,
Roxan
CallWaiting AI`;

// ============================================
// UTILITIES
// ============================================

function loadJSON(filepath, defaultValue = []) {
    try {
        if (fs.existsSync(filepath)) {
            return JSON.parse(fs.readFileSync(filepath, 'utf8'));
        }
    } catch (err) {
        console.error(`Error loading ${filepath}:`, err.message);
    }
    return defaultValue;
}

function saveJSON(filepath, data) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ============================================
// AI (Groq API)
// ============================================

async function askRoxan(emailText, senderEmail, history = '') {
    try {
        const response = await fetch(CONFIG.groq.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.groq.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: CONFIG.groq.model,
                messages: [
                    { role: 'system', content: ROXAN_PROMPT + (history ? `\n\nPrevious conversation with ${senderEmail}:\n${history}` : '') },
                    { role: 'user', content: `Email from ${senderEmail}:\n\n${emailText}` }
                ],
                temperature: 0.7,
                max_tokens: 400
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('Groq API error:', data.error);
            return null;
        }

        return data.choices[0].message.content.trim();
    } catch (err) {
        console.error('Error calling Groq API:', err.message);
        return null;
    }
}

// ============================================
// HOT LEAD DETECTION
// ============================================

function isHotLead(emailText, replyText) {
    const hotSignals = [
        'interested', 'tell me more', 'how does it work', 'how much',
        'pricing', 'schedule', 'demo', 'call me', 'my number',
        'book', 'appointment', 'available', 'calendar', 'miss calls',
        'after hours', 'voicemail', 'busy', 'need help'
    ];

    const combined = (emailText + ' ' + replyText).toLowerCase();

    for (const signal of hotSignals) {
        if (combined.includes(signal)) {
            return true;
        }
    }

    // Phone number detection
    const phoneRegex = /(\+?\d{10,14}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/;
    if (phoneRegex.test(emailText)) {
        return true;
    }

    return false;
}

// ============================================
// TELEGRAM ALERTS
// ============================================

const bot = CONFIG.telegram.token ? new TelegramBot(CONFIG.telegram.token) : null;

async function sendTelegramAlert(from, subject, emailText, replyText) {
    if (!bot || !CONFIG.telegram.chatId) {
        console.log('⚠️  Telegram not configured — skipping alert');
        return;
    }

    const message = `🔥 HOT LEAD DETECTED

📧 From: ${from}
📝 Subject: ${subject}

💬 Their message:
${emailText.slice(0, 300)}${emailText.length > 300 ? '...' : ''}

🤖 Roxan replied:
${replyText.slice(0, 300)}${replyText.length > 300 ? '...' : ''}

📞 ACTION: Check inbox and follow up!`;

    try {
        await bot.sendMessage(CONFIG.telegram.chatId, message);
        console.log('📱 Telegram alert sent!');
    } catch (err) {
        console.error('Telegram error:', err.message);
    }
}

// ============================================
// EMAIL TRANSPORT
// ============================================

const transporter = nodemailer.createTransport(CONFIG.smtp);

async function sendReply(to, subject, replyText) {
    try {
        const info = await transporter.sendMail({
            from: `"Roxan @ CallWaiting AI" <${CONFIG.smtp.auth.user}>`,
            to: to,
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            text: replyText + '\n\n---\nRoxan @ CallWaiting AI\nsupport@callwaitingai.dev\nhttps://callwaitingai.dev'
        });

        console.log(`📤 Reply sent to ${to} (${info.messageId})`);
        return true;
    } catch (err) {
        console.error(`❌ Failed to send reply to ${to}:`, err.message);
        return false;
    }
}

// ============================================
// IMAP INBOX WATCHER
// ============================================

const imap = new Imap(CONFIG.imap);

function openInbox(cb) {
    imap.openBox('INBOX', false, cb);
}

async function processMail() {
    return new Promise((resolve) => {
        imap.search(['UNSEEN'], async (err, results) => {
            if (err) {
                console.error('IMAP search error:', err.message);
                return resolve();
            }

            if (!results || results.length === 0) {
                console.log(`📭 No new emails (${new Date().toLocaleTimeString()})`);
                return resolve();
            }

            console.log(`📬 Found ${results.length} new email(s)`);

            const f = imap.fetch(results, { bodies: '', markSeen: true });

            f.on('message', (msg, seqno) => {
                msg.on('body', async (stream) => {
                    try {
                        const parsed = await simpleParser(stream);
                        const from = parsed.from?.text || '';
                        const fromEmail = parsed.from?.value?.[0]?.address || '';
                        const subject = parsed.subject || '(no subject)';
                        const text = parsed.text || parsed.html?.replace(/<[^>]*>/g, '') || '';

                        // Skip our own emails and automated messages
                        if (fromEmail.includes('callwaitingai.dev') ||
                            fromEmail.includes('noreply') ||
                            fromEmail.includes('mailer-daemon') ||
                            subject.toLowerCase().includes('auto-reply') ||
                            subject.toLowerCase().includes('out of office')) {
                            console.log(`⏭️  Skipping: ${from}`);
                            return;
                        }

                        console.log(`\n📧 Processing email from: ${from}`);
                        console.log(`   Subject: ${subject}`);
                        console.log(`   Preview: ${text.slice(0, 100)}...`);

                        // Load conversation history
                        const conversations = loadJSON(CONFIG.conversationLog, {});
                        const history = conversations[fromEmail] || '';

                        // Ask Roxan for reply
                        const replyText = await askRoxan(text, fromEmail, history);

                        if (!replyText) {
                            console.log('⚠️  Could not generate reply — skipping');
                            return;
                        }

                        console.log(`🤖 Roxan's reply:\n${replyText}\n`);

                        // Check if hot lead
                        const hot = isHotLead(text, replyText);

                        if (hot) {
                            console.log('🔥 HOT LEAD DETECTED!');

                            // Log hot lead
                            const hotLeads = loadJSON(CONFIG.hotLeadsLog, []);
                            hotLeads.push({
                                email: fromEmail,
                                subject: subject,
                                message: text.slice(0, 500),
                                reply: replyText,
                                timestamp: new Date().toISOString()
                            });
                            saveJSON(CONFIG.hotLeadsLog, hotLeads);

                            // Send Telegram alert
                            await sendTelegramAlert(from, subject, text, replyText);
                        }

                        // Send reply
                        await sendReply(fromEmail, subject, replyText);

                        // Save conversation history
                        conversations[fromEmail] = (history ? history + '\n\n---\n\n' : '') +
                            `Their email:\n${text.slice(0, 500)}\n\nRoxan's reply:\n${replyText}`;
                        saveJSON(CONFIG.conversationLog, conversations);

                    } catch (parseErr) {
                        console.error('Error processing email:', parseErr.message);
                    }
                });
            });

            f.on('end', () => {
                resolve();
            });
        });
    });
}

// ============================================
// MAIN
// ============================================

console.log(`
╔══════════════════════════════════════════════╗
║          ROXAN AI AGENT                      ║
║          CallWaiting AI SDR                  ║
╠══════════════════════════════════════════════╣
║  ✅ Email: ${CONFIG.smtp.auth.user}
║  ✅ Groq Model: ${CONFIG.groq.model}
║  ✅ Check Interval: ${CONFIG.checkInterval / 1000}s
║  ${CONFIG.telegram.chatId ? '✅' : '⚠️ '} Telegram: ${CONFIG.telegram.chatId ? 'Configured' : 'Not configured (add TELEGRAM_CHAT_ID)'}
╚══════════════════════════════════════════════╝
`);

imap.once('ready', () => {
    console.log('🚀 ROXAN IS ALIVE — watching inbox...\n');

    openInbox(async (err) => {
        if (err) {
            console.error('Error opening inbox:', err.message);
            return;
        }

        // Initial check
        await processMail();

        // Periodic check
        setInterval(async () => {
            await processMail();
        }, CONFIG.checkInterval);
    });
});

imap.once('error', (err) => {
    console.error('IMAP error:', err.message);
});

imap.once('end', () => {
    console.log('IMAP connection ended');
});

imap.connect();
