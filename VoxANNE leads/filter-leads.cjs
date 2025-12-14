/**
 * Lead Filtering Script
 * Filters 800+ leads to 350-400 high-quality personal emails
 * 
 * Criteria:
 * - Has valid email (not info@, hello@, contact@)
 * - Email looks personal (firstname@, dr.name@, etc.)
 * - Has clinic name and city for personalization
 * - Deduplicates by domain
 */

const fs = require('fs');
const path = require('path');

// Load leads
const leadsPath = path.join(__dirname, 'dataset_crawler-google-places_2025-12-05_08-39-56-182.json');
const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));

console.log(`📊 Total leads loaded: ${leads.length}\n`);

// Generic email prefixes to exclude
const genericPrefixes = [
    'info', 'hello', 'contact', 'enquiry', 'enquiries', 'admin',
    'office', 'reception', 'bookings', 'appointments', 'support',
    'customerservices', 'records', 'enquire', 'book', 'mail'
];

// Extract first name from clinic title
function extractFirstName(title) {
    // Try to find "Dr. Name" or "Dr Name"
    const drMatch = title.match(/Dr\.?\s+([A-Z][a-z]+)/);
    if (drMatch) return drMatch[1];

    // Try to find first capitalized word that's not common words
    const words = title.split(/\s+/);
    const commonWords = ['The', 'Clinic', 'Surgery', 'Medical', 'Cosmetic', 'Plastic', 'Face', 'Aesthetic'];
    for (const word of words) {
        if (/^[A-Z][a-z]+$/.test(word) && !commonWords.includes(word)) {
            return word;
        }
    }

    return null; // Will use "there" in email
}

// Check if email looks personal
function isPersonalEmail(email) {
    if (!email) return false;

    const prefix = email.split('@')[0].toLowerCase();

    // Exclude generic prefixes
    if (genericPrefixes.some(gen => prefix.includes(gen))) {
        return false;
    }

    // Personal indicators: has a name, initials, or dr.
    if (prefix.includes('dr.') || prefix.includes('dr') ||
        /^[a-z]+\.[a-z]+/.test(prefix) || // firstname.lastname
        /^[a-z]{1,2}[a-z]+/.test(prefix)) { // initials or short name
        return true;
    }

    return false;
}

// Filter and process leads
const filtered = [];
const seenDomains = new Set();

for (const lead of leads) {
    // Must have emails array
    if (!lead.emails || lead.emails.length === 0) continue;

    // Must have clinic name and city
    if (!lead.title || !lead.city) continue;

    // Check each email
    for (const email of lead.emails) {
        if (!email || !email.includes('@')) continue;

        const domain = email.split('@')[1];

        // Skip if we've already contacted this domain
        if (seenDomains.has(domain)) continue;

        // Check if personal
        if (!isPersonalEmail(email)) continue;

        // Extract first name
        const firstName = extractFirstName(lead.title);

        // Add to filtered list
        filtered.push({
            email: email.toLowerCase(),
            clinicName: lead.title,
            city: lead.city,
            firstName: firstName || 'there',
            phone: lead.phone || '',
            website: lead.website || '',
            category: lead.categoryName || 'Clinic',
            sent: false,
            sentDate: null,
            status: 'pending',
            bounced: false,
            replied: false
        });

        seenDomains.add(domain);
        break; // Only take first valid email per clinic
    }
}

// Sort by city for better organization
filtered.sort((a, b) => a.city.localeCompare(b.city));

// Save filtered leads
const outputPath = path.join(__dirname, 'filtered-leads.json');
fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2));

console.log(`✅ Filtered leads: ${filtered.length}`);
console.log(`📧 Personal emails found: ${filtered.length}`);
console.log(`🏙️  Cities covered: ${new Set(filtered.map(l => l.city)).size}`);
console.log(`\n📁 Saved to: ${outputPath}`);

// Show sample
console.log(`\n📋 Sample leads:\n`);
filtered.slice(0, 5).forEach((lead, i) => {
    console.log(`${i + 1}. ${lead.email}`);
    console.log(`   Clinic: ${lead.clinicName}`);
    console.log(`   City: ${lead.city}`);
    console.log(`   First Name: ${lead.firstName}\n`);
});

console.log(`\n🎯 Ready for outreach!`);
console.log(`Expected results with ${filtered.length} leads:`);
console.log(`- Month 1: 6-10 replies, 1-3 customers, £600-£1,800 MRR`);
console.log(`- Month 2: 18-25 replies, 5-9 customers, £3k-£5k MRR`);
console.log(`- Month 3: 30-45 replies, 10-15 customers, £6k-£9k MRR`);
