import { fromZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

const timezone = 'Africa/Lagos';
const dateStr = '2026-01-21';
const timeStr = '15:00';
const combinedStr = `${dateStr} ${timeStr}`;

console.log(`Testing timezone: ${timezone}`);
console.log(`Input string: ${combinedStr}`);

try {
    const zonedDate = fromZonedTime(combinedStr, timezone);
    console.log(`Resulting Date (UTC): ${zonedDate.toISOString()}`);

    // Expected: 14:00Z
    if (zonedDate.toISOString().includes('14:00:00')) {
        console.log('✅ SUCCESS: Correctly converted to UTC');
    } else {
        console.log('❌ FAILURE: Incorrect conversion');
    }
} catch (error) {
    console.error('Error:', error);
}
