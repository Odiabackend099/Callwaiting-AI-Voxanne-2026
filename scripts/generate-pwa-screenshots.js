const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const COLORS = {
  obsidian: '#020412',
  surgical600: '#1D4ED8',
  surgical500: '#3B82F6',
  surgical200: '#BFDBFE',
  surgical50: '#F0F9FF',
  white: '#FFFFFF'
};

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'public', 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function generateDesktopScreenshot() {
  const width = 1920;
  const height = 1080;

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${COLORS.surgical50}"/>
    <rect y="0" width="${width}" height="80" fill="${COLORS.white}"/>
    <rect y="80" width="${width}" height="1" fill="${COLORS.surgical200}"/>
    <text x="40" y="50" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="${COLORS.obsidian}">Voxanne AI</text>
    <rect x="0" y="80" width="280" height="${height - 80}" fill="${COLORS.white}"/>
    <rect x="280" y="80" width="1" height="${height - 80}" fill="${COLORS.surgical200}"/>
    <rect x="20" y="120" width="240" height="50" rx="8" fill="${COLORS.surgical600}"/>
    <text x="40" y="150" font-family="Arial, sans-serif" font-size="16" font-weight="500" fill="${COLORS.white}">📊 Dashboard</text>
    <rect x="20" y="185" width="240" height="50" rx="8" fill="transparent"/>
    <text x="40" y="215" font-family="Arial, sans-serif" font-size="16" fill="${COLORS.obsidian}">📞 Calls</text>
    <rect x="20" y="250" width="240" height="50" rx="8" fill="transparent"/>
    <text x="40" y="280" font-family="Arial, sans-serif" font-size="16" fill="${COLORS.obsidian}">👥 Leads</text>
    <g transform="translate(300, 100)">
      <text x="0" y="40" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="${COLORS.obsidian}">Dashboard Overview</text>
      <g transform="translate(0, 80)">
        <rect width="380" height="140" rx="12" fill="${COLORS.white}" stroke="${COLORS.surgical200}" stroke-width="1"/>
        <text x="30" y="40" font-family="Arial, sans-serif" font-size="14" fill="${COLORS.obsidian}" opacity="0.6">TOTAL CALLS TODAY</text>
        <text x="30" y="85" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="${COLORS.surgical600}">247</text>
        <text x="30" y="115" font-family="Arial, sans-serif" font-size="14" fill="#10B981">↑ 12% from yesterday</text>
        <g transform="translate(410, 0)">
          <rect width="380" height="140" rx="12" fill="${COLORS.white}" stroke="${COLORS.surgical200}" stroke-width="1"/>
          <text x="30" y="40" font-family="Arial, sans-serif" font-size="14" fill="${COLORS.obsidian}" opacity="0.6">APPOINTMENTS BOOKED</text>
          <text x="30" y="85" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="${COLORS.surgical600}">89</text>
          <text x="30" y="115" font-family="Arial, sans-serif" font-size="14" fill="#10B981">↑ 8% conversion rate</text>
        </g>
        <g transform="translate(820, 0)">
          <rect width="380" height="140" rx="12" fill="${COLORS.white}" stroke="${COLORS.surgical200}" stroke-width="1"/>
          <text x="30" y="40" font-family="Arial, sans-serif" font-size="14" fill="${COLORS.obsidian}" opacity="0.6">REVENUE PIPELINE</text>
          <text x="30" y="85" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="${COLORS.surgical600}">$35.6K</text>
          <text x="30" y="115" font-family="Arial, sans-serif" font-size="14" fill="#10B981">↑ 24% from last week</text>
        </g>
      </g>
      <g transform="translate(0, 260)">
        <rect width="780" height="380" rx="12" fill="${COLORS.white}" stroke="${COLORS.surgical200}" stroke-width="1"/>
        <text x="30" y="40" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="${COLORS.obsidian}">Call Volume (Last 7 Days)</text>
        <g transform="translate(60, 100)">
          <rect x="0" y="150" width="60" height="130" rx="4" fill="${COLORS.surgical500}" opacity="0.8"/>
          <rect x="100" y="124" width="60" height="156" rx="4" fill="${COLORS.surgical500}" opacity="0.8"/>
          <rect x="200" y="116" width="60" height="164" rx="4" fill="${COLORS.surgical500}" opacity="0.8"/>
          <rect x="300" y="140" width="60" height="140" rx="4" fill="${COLORS.surgical500}" opacity="0.8"/>
          <rect x="400" y="104" width="60" height="176" rx="4" fill="${COLORS.surgical500}" opacity="0.8"/>
          <rect x="500" y="90" width="60" height="190" rx="4" fill="${COLORS.surgical500}" opacity="0.8"/>
          <rect x="600" y="80" width="60" height="200" rx="4" fill="${COLORS.surgical500}" opacity="0.8"/>
        </g>
        <g transform="translate(820, 0)">
          <rect width="380" height="380" rx="12" fill="${COLORS.white}" stroke="${COLORS.surgical200}" stroke-width="1"/>
          <text x="30" y="40" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="${COLORS.obsidian}">Recent Activity</text>
          <g transform="translate(30, 80)">
            <circle cx="10" cy="10" r="8" fill="${COLORS.surgical600}"/>
            <text x="30" y="15" font-family="Arial, sans-serif" font-size="14" fill="${COLORS.obsidian}">New appointment booked</text>
            <text x="30" y="35" font-family="Arial, sans-serif" font-size="12" fill="${COLORS.obsidian}" opacity="0.5">2 minutes ago</text>
          </g>
        </g>
      </g>
    </g>
    <text x="${width - 20}" y="${height - 20}" font-family="Arial, sans-serif" font-size="12" text-anchor="end" fill="${COLORS.obsidian}" opacity="0.4">Voxanne AI Dashboard</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(path.join(SCREENSHOTS_DIR, 'desktop-dashboard.png'));

  console.log('  ✅ Generated desktop screenshot (1920x1080)');
}

async function generateMobileScreenshot() {
  const width = 750;
  const height = 1334;

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${COLORS.surgical50}"/>
    <rect y="0" width="${width}" height="70" fill="${COLORS.white}"/>
    <rect y="70" width="${width}" height="1" fill="${COLORS.surgical200}"/>
    <rect x="20" y="22" width="30" height="3" rx="1.5" fill="${COLORS.obsidian}"/>
    <rect x="20" y="32" width="30" height="3" rx="1.5" fill="${COLORS.obsidian}"/>
    <rect x="20" y="42" width="30" height="3" rx="1.5" fill="${COLORS.obsidian}"/>
    <text x="${width / 2}" y="45" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="${COLORS.obsidian}" text-anchor="middle">Voxanne AI</text>
    <g transform="translate(20, 90)">
      <text x="0" y="30" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${COLORS.obsidian}">Dashboard</text>
      <g transform="translate(0, 60)">
        <rect width="${width - 40}" height="120" rx="12" fill="${COLORS.white}" stroke="${COLORS.surgical200}" stroke-width="1"/>
        <text x="25" y="35" font-family="Arial, sans-serif" font-size="12" fill="${COLORS.obsidian}" opacity="0.6">TOTAL CALLS TODAY</text>
        <text x="25" y="70" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="${COLORS.surgical600}">247</text>
        <text x="25" y="95" font-family="Arial, sans-serif" font-size="12" fill="#10B981">↑ 12% from yesterday</text>
        <g transform="translate(0, 140)">
          <rect width="${width - 40}" height="120" rx="12" fill="${COLORS.white}" stroke="${COLORS.surgical200}" stroke-width="1"/>
          <text x="25" y="35" font-family="Arial, sans-serif" font-size="12" fill="${COLORS.obsidian}" opacity="0.6">APPOINTMENTS BOOKED</text>
          <text x="25" y="70" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="${COLORS.surgical600}">89</text>
          <text x="25" y="95" font-family="Arial, sans-serif" font-size="12" fill="#10B981">↑ 8% conversion rate</text>
        </g>
        <g transform="translate(0, 280)">
          <rect width="${width - 40}" height="120" rx="12" fill="${COLORS.white}" stroke="${COLORS.surgical200}" stroke-width="1"/>
          <text x="25" y="35" font-family="Arial, sans-serif" font-size="12" fill="${COLORS.obsidian}" opacity="0.6">REVENUE PIPELINE</text>
          <text x="25" y="70" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="${COLORS.surgical600}">$35.6K</text>
          <text x="25" y="95" font-family="Arial, sans-serif" font-size="12" fill="#10B981">↑ 24% from last week</text>
        </g>
      </g>
      <g transform="translate(0, 480)">
        <text x="0" y="30" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="${COLORS.obsidian}">Recent Activity</text>
        <rect y="50" width="${width - 40}" height="280" rx="12" fill="${COLORS.white}" stroke="${COLORS.surgical200}" stroke-width="1"/>
        <g transform="translate(25, 80)">
          <circle cx="8" cy="8" r="6" fill="${COLORS.surgical600}"/>
          <text x="25" y="12" font-family="Arial, sans-serif" font-size="14" fill="${COLORS.obsidian}">New appointment booked</text>
          <text x="25" y="32" font-family="Arial, sans-serif" font-size="11" fill="${COLORS.obsidian}" opacity="0.5">2 minutes ago</text>
          <g transform="translate(0, 60)">
            <circle cx="8" cy="8" r="6" fill="${COLORS.surgical500}"/>
            <text x="25" y="12" font-family="Arial, sans-serif" font-size="14" fill="${COLORS.obsidian}">Inbound call handled</text>
            <text x="25" y="32" font-family="Arial, sans-serif" font-size="11" fill="${COLORS.obsidian}" opacity="0.5">5 minutes ago</text>
          </g>
          <g transform="translate(0, 120)">
            <circle cx="8" cy="8" r="6" fill="${COLORS.surgical600}"/>
            <text x="25" y="12" font-family="Arial, sans-serif" font-size="14" fill="${COLORS.obsidian}">Follow-up SMS sent</text>
            <text x="25" y="32" font-family="Arial, sans-serif" font-size="11" fill="${COLORS.obsidian}" opacity="0.5">12 minutes ago</text>
          </g>
        </g>
      </g>
    </g>
    <g transform="translate(0, ${height - 80})">
      <rect width="${width}" height="80" fill="${COLORS.white}"/>
      <rect width="${width}" height="1" fill="${COLORS.surgical200}"/>
      <g transform="translate(${width / 8}, 20)">
        <circle cx="0" cy="10" r="20" fill="${COLORS.surgical600}" opacity="0.1"/>
        <text x="0" y="15" font-family="Arial, sans-serif" font-size="20" text-anchor="middle">📊</text>
        <text x="0" y="45" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="${COLORS.surgical600}" font-weight="600">Dashboard</text>
      </g>
      <g transform="translate(${width * 3 / 8}, 20)">
        <text x="0" y="15" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" opacity="0.5">📞</text>
        <text x="0" y="45" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="${COLORS.obsidian}" opacity="0.5">Calls</text>
      </g>
      <g transform="translate(${width * 5 / 8}, 20)">
        <text x="0" y="15" font-family="Arial, sans-serif" font-size="20" text-anchor="middle" opacity="0.5">👥</text>
        <text x="0" y="45" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="${COLORS.obsidian}" opacity="0.5">Leads</text>
      </g>
    </g>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(path.join(SCREENSHOTS_DIR, 'mobile-dashboard.png'));

  console.log('  ✅ Generated mobile screenshot (750x1334)');
}

async function main() {
  console.log('🚀 Starting PWA screenshot generation...\n');

  try {
    console.log('🎨 Generating screenshots...');
    await generateDesktopScreenshot();
    await generateMobileScreenshot();
    console.log('\n✅ All screenshots generated successfully!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);
  } catch (error) {
    console.error('❌ Error generating screenshots:', error);
    process.exit(1);
  }
}

main();
