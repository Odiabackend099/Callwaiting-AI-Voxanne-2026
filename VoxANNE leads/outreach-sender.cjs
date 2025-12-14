/**
 * CallWaiting AI - Automated Outreach System
 * 
 * Features:
 * - 10-week warmup schedule (10→150 emails/day)
 * - Rate limiting (1 email per 45-60 seconds)
 * - Bounce detection and handling
 * - Open tracking with 1x1 pixel
 * - Personalization (firstName, clinicName, city)
 * - Comprehensive logging
 * - Auto-stops if bounce rate >3%
 * 
 * Usage: node outreach-sender.js
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // SMTP Settings (Resend.com - FREE)
    smtp: {
        host: 'smtp.resend.com',
        port: 587,
        secure: false,
        auth: {
            user: 'resend',
            pass: process.env.RESEND_API_KEY // Use environment variable for Resend API key
        }
    },

    // Sending settings
    from: {
        name: 'Roxan @ CallWaiting AI',
        email: 'support@callwaitingai.dev'
    },
    replyTo: 'support@callwaitingai.dev',
    cc: 'Austyn@callwaitingai.dev',

    // Warmup schedule (week number → max emails/day)
    warmupSchedule: {
        1: 15,
        2: 25,
        3: 40,
        4: 50,
        5: 65,
        6: 80,
        7: 95,
        8: 110,
        9: 130,
        10: 150
    },

    // Rate limiting
    minDelayMs: 45000,  // 45 seconds
    maxDelayMs: 60000,  // 60 seconds

    // Safety limits
    maxBounceRate: 0.03, // Stop if >3% bounce

    // Tracking pixel URL (self-hosted)
    trackingDomain: 'https://callwaitingai.dev',

    // File paths
    leadsFile: path.join(__dirname, 'filtered-leads.json'),
    sentLogFile: path.join(__dirname, 'sent-log.json'),
    bounceListFile: path.join(__dirname, 'bounce-list.json'),
    statsFile: path.join(__dirname, 'outreach-stats.json')
};

// ============================================
// EMAIL TEMPLATE
// ============================================

function generateEmail(lead, trackingId) {
    // A/B test subject lines (2-4 words, personalized)
    const subjects = [
        `Quick question, ${lead.firstName !== 'there' ? lead.firstName : 'team'}?`,
        `${lead.clinicName} — after 6pm?`,
        `Missed calls at ${lead.clinicName}?`
    ];
    const subject = subjects[Math.floor(Math.random() * subjects.length)];

    const greeting = lead.firstName !== 'there'
        ? `Hi ${lead.firstName},`
        : `Hi,`;

    // 2025 Best Practices: Under 100 words, single CTA, minimal signature
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; max-width: 600px;">
    <p>${greeting}</p>
    
    <p>Quick question about ${lead.clinicName} — when someone calls after 6pm asking about treatment prices, what happens? Voicemail?</p>
    
    <p>We help cosmetic clinics answer those calls 24/7 with an AI that sounds completely human. One London clinic added 9 extra consultations in 2 weeks.</p>
    
    <p>Want to hear her live? Takes 45 seconds — just reply with your mobile.</p>
    
    <p>Best,<br>
    <strong>Roxan</strong><br>
    <span style="color: #666;">CallWaiting AI</span></p>
    
    <p style="font-size: 11px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
        CallWaiting AI · London, UK<br>
        <a href="mailto:support@callwaitingai.dev?subject=Unsubscribe" style="color: #999;">Unsubscribe</a>
    </p>
    
    <!-- Tracking pixel -->
    <img src="${CONFIG.trackingDomain}/track/${trackingId}.png" width="1" height="1" style="display:none;" alt="">
</body>
</html>
    `.trim();

    return { subject, html };
}

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

function randomDelay() {
    const min = CONFIG.minDelayMs;
    const max = CONFIG.maxDelayMs;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getCurrentWeek(startDate) {
    const now = new Date();
    const start = new Date(startDate);
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.ceil(diffDays / 7);
}

function getTodaysSentCount(sentLog) {
    const today = new Date().toISOString().split('T')[0];
    return sentLog.filter(log => log.sentDate && log.sentDate.startsWith(today)).length;
}

function calculateBounceRate(sentLog) {
    if (sentLog.length === 0) return 0;
    const bounced = sentLog.filter(log => log.bounced).length;
    return bounced / sentLog.length;
}

// ============================================
// MAIN SENDING LOGIC
// ============================================

async function sendOutreach() {
    console.log('🚀 CallWaiting AI - Automated Outreach System\n');

    // Load data
    const leads = loadJSON(CONFIG.leadsFile, []);
    const sentLog = loadJSON(CONFIG.sentLogFile, []);
    const bounceList = loadJSON(CONFIG.bounceListFile, []);
    const stats = loadJSON(CONFIG.statsFile, {
        startDate: new Date().toISOString(),
        totalSent: 0,
        totalBounced: 0,
        totalReplied: 0,
        currentWeek: 1
    });

    if (leads.length === 0) {
        console.error('❌ No leads found. Run filter-leads.js first.');
        return;
    }

    console.log(`📊 Leads available: ${leads.length}`);
    console.log(`📧 Already sent: ${sentLog.length}`);
    console.log(`⚠️  Bounced: ${bounceList.length}\n`);

    // Determine current week and daily limit
    const currentWeek = getCurrentWeek(stats.startDate);
    const dailyLimit = CONFIG.warmupSchedule[currentWeek] || 150;
    const todaysSent = getTodaysSentCount(sentLog);

    console.log(`📅 Week ${currentWeek} - Daily limit: ${dailyLimit}`);
    console.log(`📤 Sent today: ${todaysSent}/${dailyLimit}\n`);

    if (todaysSent >= dailyLimit) {
        console.log('✅ Daily limit reached. Come back tomorrow!');
        return;
    }

    // Check bounce rate
    const bounceRate = calculateBounceRate(sentLog);
    if (bounceRate > CONFIG.maxBounceRate) {
        console.error(`🛑 STOPPED: Bounce rate too high (${(bounceRate * 100).toFixed(1)}%)`);
        console.error('Fix deliverability issues before continuing.');
        return;
    }

    // Filter unsent leads
    const sentEmails = new Set(sentLog.map(log => log.email));
    const bounceEmails = new Set(bounceList);
    const unsentLeads = leads.filter(lead =>
        !sentEmails.has(lead.email) && !bounceEmails.has(lead.email)
    );

    if (unsentLeads.length === 0) {
        console.log('✅ All leads contacted!');
        return;
    }

    // Calculate how many to send today
    const toSendCount = Math.min(dailyLimit - todaysSent, unsentLeads.length);
    const toSend = unsentLeads.slice(0, toSendCount);

    console.log(`🎯 Sending ${toSendCount} emails...\n`);

    // Create transporter
    const transporter = nodemailer.createTransport(CONFIG.smtp);

    // Verify connection
    try {
        await transporter.verify();
        console.log('✅ SMTP connection verified\n');
    } catch (err) {
        console.error('❌ SMTP connection failed:', err.message);
        return;
    }

    // Send emails
    let sent = 0;
    let failed = 0;

    for (const lead of toSend) {
        const trackingId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const { subject, html } = generateEmail(lead, trackingId);

        try {
            const info = await transporter.sendMail({
                from: `"${CONFIG.from.name}" <${CONFIG.from.email}>`,
                replyTo: CONFIG.replyTo,
                to: lead.email,
                cc: CONFIG.cc,  // Always CC Austyn
                subject: subject,
                html: html
            });

            // Log success
            sentLog.push({
                email: lead.email,
                clinicName: lead.clinicName,
                city: lead.city,
                sentDate: new Date().toISOString(),
                messageId: info.messageId,
                trackingId: trackingId,
                bounced: false,
                replied: false,
                opened: false
            });

            sent++;
            stats.totalSent++;

            console.log(`✅ ${sent}/${toSendCount} - ${lead.email} (${lead.clinicName})`);

            // Random delay before next email
            if (sent < toSendCount) {
                const delay = randomDelay();
                console.log(`   ⏳ Waiting ${Math.round(delay / 1000)}s...\n`);
                await sleep(delay);
            }

        } catch (err) {
            console.error(`❌ Failed: ${lead.email} - ${err.message}`);

            // Check if it's a bounce
            if (err.responseCode === 550 || err.message.includes('bounce')) {
                bounceList.push(lead.email);
                stats.totalBounced++;
            }

            failed++;
        }
    }

    // Save logs
    saveJSON(CONFIG.sentLogFile, sentLog);
    saveJSON(CONFIG.bounceListFile, bounceList);
    stats.currentWeek = currentWeek;
    saveJSON(CONFIG.statsFile, stats);

    // Summary
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Session Summary`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Sent: ${sent}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📧 Total sent (all time): ${stats.totalSent}`);
    console.log(`⚠️  Total bounced: ${stats.totalBounced}`);
    console.log(`📈 Bounce rate: ${(bounceRate * 100).toFixed(2)}%`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log(`🎯 Next steps:`);
    console.log(`1. Monitor ${CONFIG.replyTo} for replies`);
    console.log(`2. Run again tomorrow to send next batch`);
    console.log(`3. Check bounce-list.json for hard bounces\n`);
}

// ============================================
// RUN
// ============================================

sendOutreach().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
