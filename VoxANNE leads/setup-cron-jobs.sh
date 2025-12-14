#!/bin/bash

# VOXANNE LEAD GENERATION - AUTOMATED CRON JOBS
# Schedule daily email sends, weekly reports, and metrics tracking

LEAD_GEN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$LEAD_GEN_DIR/cron-logs"

# Create log directory
mkdir -p "$LOG_DIR"

# ============================================
# CRON JOBS
# ============================================

# Daily email send (9am UK time, Monday-Friday)
DAILY_EMAIL="0 9 * * 1-5 cd $LEAD_GEN_DIR && node lead-gen-system.js send-emails 15 >> $LOG_DIR/daily-emails.log 2>&1"

# Weekly report (Friday 5pm)
WEEKLY_REPORT="0 17 * * 5 cd $LEAD_GEN_DIR && node lead-gen-system.js generate-report >> $LOG_DIR/weekly-report.log 2>&1"

# Daily status check (8am UK time)
DAILY_STATUS="0 8 * * * cd $LEAD_GEN_DIR && node lead-gen-system.js status >> $LOG_DIR/daily-status.log 2>&1"

# ============================================
# INSTALLATION
# ============================================

echo "🔧 VOXANNE LEAD GENERATION - CRON JOB SETUP"
echo "==========================================="
echo ""

# Check if cron is available
if ! command -v crontab &> /dev/null; then
    echo "❌ crontab not found. This script requires cron."
    exit 1
fi

echo "📋 Current cron jobs:"
crontab -l 2>/dev/null || echo "   (no existing jobs)"

echo ""
echo "📝 Adding new cron jobs..."
echo ""

# Get existing crontab
EXISTING_CRON=$(crontab -l 2>/dev/null || echo "")

# Check if jobs already exist
if echo "$EXISTING_CRON" | grep -q "lead-gen-system.js"; then
    echo "⚠️  Lead generation jobs already scheduled."
    read -p "Replace existing jobs? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
    # Remove existing jobs
    EXISTING_CRON=$(echo "$EXISTING_CRON" | grep -v "lead-gen-system.js")
fi

# Add new jobs
NEW_CRON="$EXISTING_CRON
$DAILY_EMAIL
$WEEKLY_REPORT
$DAILY_STATUS"

# Install cron jobs
echo "$NEW_CRON" | crontab -

echo "✅ Cron jobs installed!"
echo ""
echo "📅 SCHEDULED JOBS:"
echo "   • Daily emails: 9am (Mon-Fri)"
echo "   • Daily status: 8am (every day)"
echo "   • Weekly report: 5pm (Friday)"
echo ""
echo "📊 Logs location: $LOG_DIR"
echo ""
echo "View logs:"
echo "   tail -f $LOG_DIR/daily-emails.log"
echo "   tail -f $LOG_DIR/weekly-report.log"
echo ""
echo "View all cron jobs:"
echo "   crontab -l"
echo ""
echo "Remove cron jobs:"
echo "   crontab -r"
