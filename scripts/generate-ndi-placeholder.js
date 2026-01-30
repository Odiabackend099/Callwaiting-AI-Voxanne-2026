/**
 * Professional Placeholder Generator for Ndi's Team Photo
 *
 * This creates a professional placeholder image that matches the existing team photo style.
 * The actual photo should be replaced with a real professional headshot when available.
 */

const fs = require('fs');
const path = require('path');

// Professional placeholder SVG that matches team photo style
const placeholderSVG = `
<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
  <!-- Professional background gradient (medical/corporate blue) -->
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
    </linearGradient>

    <radialGradient id="face" cx="50%" cy="40%" r="35%">
      <stop offset="0%" style="stop-color:#8b7355;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6b5544;stop-opacity:1" />
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="800" height="800" fill="url(#bg)"/>

  <!-- Professional silhouette (placeholder for real photo) -->
  <g transform="translate(400, 400)">
    <!-- Head -->
    <ellipse cx="0" cy="-50" rx="120" ry="140" fill="url(#face)" opacity="0.85"/>

    <!-- Shoulders/Suit -->
    <path d="M -180 250 Q -150 100, -120 60 L -80 120 L -120 250 Z" fill="#1f2937" opacity="0.9"/>
    <path d="M 180 250 Q 150 100, 120 60 L 80 120 L 120 250 Z" fill="#1f2937" opacity="0.9"/>

    <!-- Collar/Tie (professional attire) -->
    <path d="M -60 80 L -40 200 L 0 180 L 40 200 L 60 80 Z" fill="#1e293b" opacity="0.95"/>
    <path d="M -5 100 L 0 200 L 5 100 Z" fill="#3b82f6" opacity="0.9"/>

    <!-- Professional badge/watermark -->
    <text x="0" y="320" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" opacity="0.6">
      NDI
    </text>
    <text x="0" y="350" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" opacity="0.5">
      Head of Human &amp; International Relations
    </text>
  </g>

  <!-- Professional quality indicator -->
  <text x="400" y="750" font-family="Arial, sans-serif" font-size="14" fill="white" text-anchor="middle" opacity="0.4">
    PLACEHOLDER - Replace with professional headshot
  </text>
</svg>
`;

// Output path
const outputPath = path.join(__dirname, '../public/images/team/ndi.svg');

// Ensure directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Write placeholder
fs.writeFileSync(outputPath, placeholderSVG.trim());

console.log('✅ Professional placeholder created at:', outputPath);
console.log('⚠️  NOTE: This is a placeholder. Replace with actual professional headshot.');
console.log('');
console.log('Recommended photo specifications:');
console.log('- Format: PNG or JPG');
console.log('- Dimensions: 800x800px minimum');
console.log('- Background: Professional (office/studio)');
console.log('- Attire: Business professional');
console.log('- Lighting: Professional headshot quality');
console.log('- Subject: Black American male, 40 years old');
console.log('- Expression: Confident, approachable, professional');
