/**
 * Test script to verify manifest loading system
 * Tests: loadManifest(), getElement(), getCoordinates()
 */

import * as fs from 'fs';
import * as path from 'path';

// Manifest structure
interface ElementManifest {
  name: string;
  selector: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

interface ScreenshotManifest {
  screenshotName: string;
  resolution: {
    width: number;
    height: number;
  };
  capturedAt: string;
  elements: ElementManifest[];
}

// Load manifest from JSON file
function loadManifest(manifestName: string): ScreenshotManifest {
  const manifestPath = path.join(__dirname, 'public', 'manifests', manifestName);

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(manifestContent) as ScreenshotManifest;
}

// Get element by name from manifest
function getElement(manifest: ScreenshotManifest, elementName: string): ElementManifest | undefined {
  return manifest.elements.find(el => el.name === elementName);
}

// Get coordinates for an element (end-to-end test)
function getCoordinates(manifestName: string, elementName: string): { x: number; y: number } | null {
  try {
    const manifest = loadManifest(manifestName);
    const element = getElement(manifest, elementName);

    if (!element) {
      console.error(`❌ Element "${elementName}" not found in manifest "${manifestName}"`);
      return null;
    }

    return { x: element.centerX, y: element.centerY };
  } catch (error) {
    console.error(`❌ Error loading coordinates:`, error);
    return null;
  }
}

// Run tests
console.log('🧪 Testing Manifest Loading System\n');

// Test 1: Load manifest
console.log('Test 1: Load manifest file');
try {
  const manifest = loadManifest('00_signin_page.json');
  console.log(`✅ Loaded manifest: ${manifest.screenshotName}`);
  console.log(`   Resolution: ${manifest.resolution.width}x${manifest.resolution.height}`);
  console.log(`   Elements found: ${manifest.elements.length}`);
} catch (error) {
  console.error(`❌ Failed to load manifest:`, error);
}

console.log('\n');

// Test 2: Get element by name
console.log('Test 2: Get element by name');
try {
  const manifest = loadManifest('00_signin_page.json');
  const element = getElement(manifest, 'email-input');

  if (element) {
    console.log(`✅ Found element "email-input"`);
    console.log(`   Position: (${element.x}, ${element.y})`);
    console.log(`   Size: ${element.width}x${element.height}`);
    console.log(`   Center: (${element.centerX}, ${element.centerY})`);
  } else {
    console.error(`❌ Element "email-input" not found`);
  }
} catch (error) {
  console.error(`❌ Failed to get element:`, error);
}

console.log('\n');

// Test 3: Get coordinates (end-to-end)
console.log('Test 3: Get coordinates (end-to-end)');
const coords = getCoordinates('00_signin_page.json', 'email-input');
if (coords) {
  console.log(`✅ Coordinates for "email-input": (${coords.x}, ${coords.y})`);
} else {
  console.error(`❌ Failed to get coordinates`);
}

console.log('\n');

// Test 4: Test all elements in manifest
console.log('Test 4: Test all elements in 00_signin_page.json');
try {
  const manifest = loadManifest('00_signin_page.json');
  const elementNames = ['email-input', 'password-input', 'sign-in-button', 'logo'];

  let allFound = true;
  elementNames.forEach(name => {
    const coords = getCoordinates('00_signin_page.json', name);
    if (coords) {
      console.log(`✅ ${name}: (${coords.x}, ${coords.y})`);
    } else {
      console.error(`❌ ${name}: NOT FOUND`);
      allFound = false;
    }
  });

  if (allFound) {
    console.log('\n✅ All elements found successfully!');
  }
} catch (error) {
  console.error(`❌ Test failed:`, error);
}

console.log('\n');

// Test 5: List all available manifests
console.log('Test 5: List all available manifests');
const manifestsDir = path.join(__dirname, 'public', 'manifests');
try {
  const files = fs.readdirSync(manifestsDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  console.log(`Found ${jsonFiles.length} manifest files:`);
  jsonFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });
} catch (error) {
  console.error(`❌ Failed to list manifests:`, error);
}

console.log('\n');

// Test 6: Check which scenes need manifests
console.log('Test 6: Identify missing manifests for updated scenes');
const sceneManifestMapping = {
  'Scene0A_HomepageScroll.tsx': ['00_homepage_top.json', '00_homepage_scrolled.json'],
  'Scene0B_SignIn.tsx': ['00_signin_page.json'],
  'Scene2_DashboardOverview.tsx': ['00_dashboard_after_login.json'],
  'Scene3_GoogleAuth.tsx': ['01_google_auth_modal.json'], // MISSING
  'Scene3_ConfigureAgent.tsx': ['02_agent_config_page.json'], // MISSING
  'Scene4_UploadKnowledge.tsx': ['03_knowledge_upload.json'], // MISSING
  'Scene5_ConnectTelephony.tsx': ['04_telephony_config.json'], // MISSING
  'Scene6_AIForwarding.tsx': ['05_ai_forwarding_setup.json'], // MISSING
  'Scene8_LivePhoneTest.tsx': ['06_phone_test_page.json'], // MISSING
  'Scene9_CallLogs.tsx': ['07_call_logs_page.json'], // MISSING
  'Scene10_HotLeads.tsx': ['08_hot_leads_page.json'], // MISSING
};

const existingManifests = fs.readdirSync(manifestsDir).filter(f => f.endsWith('.json'));
const missingManifests: string[] = [];

Object.entries(sceneManifestMapping).forEach(([scene, manifests]) => {
  manifests.forEach(manifest => {
    if (!existingManifests.includes(manifest)) {
      missingManifests.push(manifest);
      console.log(`⚠️  ${scene} needs: ${manifest}`);
    }
  });
});

console.log(`\n📊 Summary: ${missingManifests.length} manifests missing`);
if (missingManifests.length > 0) {
  console.log('Missing manifests:');
  missingManifests.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m}`);
  });
}

console.log('\n✅ Manifest loader tests complete!');
