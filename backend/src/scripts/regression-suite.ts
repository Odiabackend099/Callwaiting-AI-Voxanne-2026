
import { spawn } from 'child_process';
import path from 'path';

// Configuration
const SCRIPTS = [
    { name: 'Smoke Test (Architecture & Atomic Logic)', file: 'src/scripts/smoke-test-suite.ts' },
    { name: 'Orchestration Test (Handoffs)', file: 'src/scripts/orchestration-test.ts' },
    { name: 'Redaction Unit Test (Security)', file: 'src/scripts/redaction-test.ts' }
];

async function runScript(name: string, file: string): Promise<boolean> {
    return new Promise((resolve) => {
        console.log(`\n▶️  RUNNING: ${name}`);
        console.log('--------------------------------------------------');

        const cmd = 'npx';
        const args = ['ts-node', file];

        const child = spawn(cmd, args, {
            cwd: process.cwd(),
            stdio: 'inherit', // Pipe output directly to console
            env: process.env
        });

        child.on('close', (code) => {
            console.log('--------------------------------------------------');
            if (code === 0) {
                console.log(`✅ ${name}: PASSED`);
                resolve(true);
            } else {
                console.error(`❌ ${name}: FAILED (Exit Code: ${code})`);
                resolve(false);
            }
        });

        child.on('error', (err) => {
            console.error(`🔥 ERROR launching ${name}:`, err);
            resolve(false);
        });
    });
}

async function runRegressionSuite() {
    console.log('🕵️  REGRESSION TESTING SUITE');
    console.log('==================================================');
    console.log(`Targeting ${SCRIPTS.length} Sub-systems...\n`);

    const results = [];

    for (const script of SCRIPTS) {
        const passed = await runScript(script.name, script.file);
        results.push({ ...script, passed });
    }

    console.log('\n📊 REGRESSION SUMMARY');
    console.log('==================================================');

    let allPassed = true;
    results.forEach(r => {
        console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
        if (!r.passed) allPassed = false;
    });

    console.log('==================================================');

    if (allPassed) {
        console.log('🏆 SYSTEM STABLE. ALL TESTS PASSED.');
        process.exit(0);
    } else {
        console.error('💥 REGRESSION DETECTED. SYSTEM UNSTABLE.');
        process.exit(1);
    }
}

runRegressionSuite();
