import twilio from 'twilio';
import { IntegrationDecryptor } from '../src/services/integration-decryptor';

/**
 * Check Twilio Geo Permissions for an organization
 *
 * This script queries Twilio's Country API to see which countries
 * are enabled for outbound calling.
 *
 * Usage: npx ts-node scripts/check-geo-permissions.ts
 */

async function checkGeoPermissions() {
  const orgId = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07'; // test@demo.com

  console.log('🔍 Checking Twilio Geo Permissions...\n');

  // Get Twilio credentials
  const credentials = await IntegrationDecryptor.getEffectiveTwilioCredentials(orgId);

  if (!credentials) {
    console.error('❌ No Twilio credentials found for organization');
    return;
  }

  console.log('Using Account SID:', credentials.accountSid);

  const twilioClient = twilio(credentials.accountSid, credentials.authToken);

  try {
    // Get all countries
    console.log('\nFetching country settings from Twilio...\n');

    const countries = await twilioClient.voice.v1.dialingPermissions.countries.list({ limit: 300 });

    // Categorize countries
    const highRiskEnabled: string[] = [];
    const lowRiskEnabled: string[] = [];
    const highRiskDisabled: string[] = [];
    const lowRiskDisabled: string[] = [];

    countries.forEach((country) => {
      const isEnabled = country.highRiskSpecialNumbersEnabled || country.highRiskTollfraudEnabled || country.lowRiskNumbersEnabled;
      const riskLevel = country.highRiskSpecialNumbersEnabled || country.highRiskTollfraudEnabled ? 'high' : 'low';

      const countryName = `${country.name} (${country.isoCode})`;

      if (isEnabled) {
        if (riskLevel === 'high') {
          highRiskEnabled.push(countryName);
        } else {
          lowRiskEnabled.push(countryName);
        }
      } else {
        // Check if it's in high risk category
        if (country.highRiskSpecialPrefixEnabled === false && country.highRiskTollfraudEnabled === false) {
          lowRiskDisabled.push(countryName);
        } else {
          highRiskDisabled.push(countryName);
        }
      }
    });

    // Print summary
    console.log('=' .repeat(60));
    console.log('GEO PERMISSIONS SUMMARY');
    console.log('='.repeat(60));

    console.log(`\n✅ LOW RISK - ENABLED (${lowRiskEnabled.length} countries):`);
    if (lowRiskEnabled.length > 0) {
      lowRiskEnabled.slice(0, 20).forEach((country) => console.log(`  - ${country}`));
      if (lowRiskEnabled.length > 20) {
        console.log(`  ... and ${lowRiskEnabled.length - 20} more`);
      }
    } else {
      console.log('  (none)');
    }

    console.log(`\n⚠️  HIGH RISK - ENABLED (${highRiskEnabled.length} countries):`);
    if (highRiskEnabled.length > 0) {
      highRiskEnabled.forEach((country) => console.log(`  - ${country}`));
    } else {
      console.log('  (none)');
    }

    console.log(`\n❌ LOW RISK - DISABLED (${lowRiskDisabled.length} countries):`);
    if (lowRiskDisabled.length > 0) {
      // Check specifically for Nigeria
      const nigeriaDisabled = lowRiskDisabled.find((c) => c.includes('(NG)'));
      if (nigeriaDisabled) {
        console.log(`  ⚠️  ${nigeriaDisabled} - NEEDED FOR VERIFICATION`);
      }
      lowRiskDisabled.slice(0, 10).forEach((country) => console.log(`  - ${country}`));
      if (lowRiskDisabled.length > 10) {
        console.log(`  ... and ${lowRiskDisabled.length - 10} more`);
      }
    } else {
      console.log('  (none)');
    }

    console.log(`\n🔒 HIGH RISK - DISABLED (${highRiskDisabled.length} countries):`);
    if (highRiskDisabled.length > 0) {
      highRiskDisabled.slice(0, 5).forEach((country) => console.log(`  - ${country}`));
      if (highRiskDisabled.length > 5) {
        console.log(`  ... and ${highRiskDisabled.length - 5} more`);
      }
    } else {
      console.log('  (none)');
    }

    // Check specifically for Nigeria
    const nigeria = countries.find((c) => c.isoCode === 'NG');
    console.log('\n' + '='.repeat(60));
    console.log('NIGERIA (NG) - SPECIFIC CHECK');
    console.log('='.repeat(60));
    if (nigeria) {
      console.log('Country:', nigeria.name);
      console.log('ISO Code:', nigeria.isoCode);
      console.log('Low Risk Numbers Enabled:', nigeria.lowRiskNumbersEnabled ? '✅ YES' : '❌ NO');
      console.log('High Risk Tollfraud Enabled:', nigeria.highRiskTollfraudEnabled ? '✅ YES' : '❌ NO');
      console.log('High Risk Special Numbers Enabled:', nigeria.highRiskSpecialNumbersEnabled ? '✅ YES' : '❌ NO');

      if (!nigeria.lowRiskNumbersEnabled) {
        console.log('\n⚠️  ACTION REQUIRED:');
        console.log('Nigeria is DISABLED. Enable it at:');
        console.log('https://www.twilio.com/console/voice/calls/geo-permissions/low-risk?countryIsoCode=NG');
      } else {
        console.log('\n✅ Nigeria is enabled for outbound calling');
      }
    } else {
      console.log('❌ Nigeria not found in country list');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\nTo manage Geo Permissions:');
    console.log('https://www.twilio.com/console/voice/calls/geo-permissions');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Error checking Geo Permissions:', error.message);
  }
}

checkGeoPermissions();
