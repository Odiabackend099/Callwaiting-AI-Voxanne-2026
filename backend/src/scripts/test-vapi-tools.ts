
import axios from 'axios';

const API_URL = 'http://localhost:3001/api/vapi';

// Valid Org ID from DB
const MOCK_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

async function testCalendarCheck() {
    console.log('\n--- Testing Calendar Check ---');
    try {
        const res = await axios.post(`${API_URL}/tools/calendar/check`, {
            tenantId: MOCK_TENANT_ID,
            date: '2026-01-20'
        });
        console.log('Response:', JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.log('Error:', e.response?.data || e.message);
    }
}

async function testReserveSlot() {
    console.log('\n--- Testing Reserve Slot ---');
    try {
        const res = await axios.post(`${API_URL}/tools/calendar/reserve`, {
            tenantId: MOCK_TENANT_ID,
            slotId: '2026-01-20T10:00:00',
            patientPhone: '+15555555555',
            patientName: 'Test Patient'
        });
        console.log('Response:', JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.log('Error:', e.response?.data || e.message);
    }
}

async function testSmsSend() {
    console.log('\n--- Testing SMS Send ---');
    try {
        const res = await axios.post(`${API_URL}/tools/sms/send`, {
            tenantId: MOCK_TENANT_ID,
            phoneNumber: '+15555555555',
            messageType: 'confirmation',
            appointmentId: '12345'
        });
        console.log('Response:', JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.log('Error:', e.response?.data || e.message);
    }
}

async function run() {
    console.log('Verify Vapi Tools Endpoints on ' + API_URL);
    await testCalendarCheck();
    await testReserveSlot();
    await testSmsSend();
}

run();
