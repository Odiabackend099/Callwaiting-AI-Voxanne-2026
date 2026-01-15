/**
 * Centralized Mock Data
 * Sample data for testing across all unit tests
 */

export const MOCK_ORGANIZATIONS = {
    clinic1: {
        id: 'org_harley_street',
        name: 'Harley Street Clinic',
        created_at: '2024-01-01T00:00:00Z',
    },
    clinic2: {
        id: 'org_beverly_hills',
        name: 'Beverly Hills Aesthetics',
        created_at: '2024-01-01T00:00:00Z',
    },
};

export const MOCK_VAPI_CREDENTIALS = {
    clinic1: {
        apiKey: 'sk_live_harley_abc123def456',
        webhookSecret: 'whs_harley_xyz789',
    },
    clinic2: {
        apiKey: 'sk_live_beverly_ghi789jkl012',
        webhookSecret: 'whs_beverly_mno345',
    },
};

export const MOCK_TWILIO_CREDENTIALS = {
    clinic1: {
        accountSid: 'AC1234567890abcdef1234567890abcd',
        authToken: 'auth_token_harley_123',
        phoneNumber: '+442071234567',
    },
    clinic2: {
        accountSid: 'ACabcdef1234567890abcdef12345678',
        authToken: 'auth_token_beverly_456',
        phoneNumber: '+13105551234',
    },
};

export const MOCK_CALL_TRANSCRIPTS = {
    rhinoplasty: `
    Receptionist: Hello, thank you for calling. How can I help you today?
    Patient: Hi, I'm interested in getting a rhinoplasty consultation.
    Receptionist: Wonderful! May I have your name and phone number?
    Patient: Sure, it's Sarah Johnson and my number is 07700 123456.
    Receptionist: Thank you Sarah. Let me check our available slots for you.
  `,
    facelift: `
    Receptionist: Good afternoon, how may I assist you?
    Patient: I'd like to inquire about facelift procedures and pricing.
    Receptionist: Of course! I'd be happy to help with that information.
    Patient: What's the typical cost range?
    Receptionist: Our facelift procedures typically range from £8,000 to £12,000.
  `,
    breastAugmentation: `
    Receptionist: Hello! How can I help you today?
    Patient: I'm calling about breast augmentation. Do you have any availability this month?
    Receptionist: Yes, we do have some openings. May I take your details?
    Patient: My name is Emma Williams.
  `,
    pricingInquiry: `
    Receptionist: Thank you for calling. How may I help?
    Patient: How much does a consultation cost?
    Receptionist: Initial consultations are £150.
    Patient: Okay, thank you for the information.
  `,
    bookingInquiry: `
    Receptionist: Good morning! How can I assist you?
    Patient: I'd like to schedule an appointment for next week.
    Receptionist: Certainly! What type of appointment are you looking for?
    Patient: A consultation for cosmetic procedures.
  `,
};

export const MOCK_ASSISTANT_CONFIGS = {
    inbound: {
        name: 'Voxanne - Inbound Receptionist',
        systemPrompt: 'You are Voxanne, a professional medical receptionist for a cosmetic surgery clinic. Be warm, professional, and helpful.',
        firstMessage: 'Hello! Thank you for calling. How may I help you today?',
        voiceId: 'Paige',
        voiceProvider: 'vapi',
        modelProvider: 'openai',
        modelName: 'gpt-4',
        language: 'en',
        maxDurationSeconds: 600,
    },
    outbound: {
        name: 'Sarah - Outbound Follow-up',
        systemPrompt: 'You are Sarah, a friendly follow-up specialist for a cosmetic surgery clinic. Your role is to check in with leads who showed interest.',
        firstMessage: 'Hi! This is Sarah from the clinic. I wanted to follow up on your recent inquiry.',
        voiceId: 'Emma',
        voiceProvider: 'vapi',
        modelProvider: 'openai',
        modelName: 'gpt-4',
        language: 'en',
        maxDurationSeconds: 300,
    },
};

export const MOCK_CALL_PAYLOADS = {
    rhinoplastyCompleted: {
        call: {
            id: 'call_rhino_001',
            orgId: 'org_harley_street',
            status: 'ended',
            durationSeconds: 240,
            customer: {
                id: 'contact_sarah_j',
                name: 'Sarah Johnson',
                phone: '+447700123456',
            },
        },
        transcript: MOCK_CALL_TRANSCRIPTS.rhinoplasty,
        summary: 'Patient Sarah Johnson inquired about rhinoplasty consultation. Provided contact details.',
        recordingUrl: 'https://example.com/recordings/rhino_001.mp3',
        analysis: {
            sentiment: 'positive',
        },
        toolCalls: [],
    },
    faceliftBooked: {
        call: {
            id: 'call_face_002',
            orgId: 'org_harley_street',
            status: 'ended',
            durationSeconds: 420,
            customer: {
                id: 'contact_john_d',
                name: 'John Doe',
                phone: '+447700987654',
            },
        },
        transcript: MOCK_CALL_TRANSCRIPTS.facelift,
        summary: 'Patient inquired about facelift. Appointment booked for consultation.',
        recordingUrl: 'https://example.com/recordings/face_002.mp3',
        analysis: {
            sentiment: 'positive',
        },
        toolCalls: [
            {
                function: {
                    name: 'bookAppointment',
                    arguments: '{"date": "2024-02-15", "time": "14:00"}',
                },
                result: { success: true },
            },
        ],
    },
    shortInquiry: {
        call: {
            id: 'call_short_003',
            orgId: 'org_harley_street',
            status: 'ended',
            durationSeconds: 25,
            customer: {
                id: 'contact_quick',
                name: 'Quick Caller',
                phone: '+447700111222',
            },
        },
        transcript: MOCK_CALL_TRANSCRIPTS.pricingInquiry,
        summary: 'Brief pricing inquiry.',
        recordingUrl: 'https://example.com/recordings/short_003.mp3',
        analysis: {
            sentiment: 'neutral',
        },
        toolCalls: [],
    },
};

export const MOCK_PII_TEXT_SAMPLES = {
    withEmail: 'Please contact me at john.doe@example.com for more information.',
    withPhone: 'My phone number is 07700 123456 or you can call +44 20 1234 5678.',
    withAddress: 'I live at 123 Harley Street, London, W1G 6AX.',
    withMedicalHistory: 'I have had heart issues in the past and take medication for diabetes.',
    withMultiplePII: 'My name is Sarah, email sarah@test.com, phone 07700123456, and I had a previous surgery for breast augmentation.',
    clean: 'I would like to schedule a consultation for next week.',
};
