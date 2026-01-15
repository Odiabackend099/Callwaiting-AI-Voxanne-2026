/**
 * Mock Data - Centralized test data and fixtures for unit and integration tests
 * Provides consistent, realistic data for testing services and routes
 */

/**
 * Sample Organizations
 */
export const MOCK_ORGANIZATIONS = {
  clinic1: {
    id: 'org_clinic_001',
    name: 'Premier Cosmetic Surgery',
    slug: 'premier-cosmetic',
    type: 'medical_practice',
    status: 'active',
    plan: 'professional',
    timezone: 'GMT',
    createdAt: '2025-01-01T00:00:00Z',
  },
  clinic2: {
    id: 'org_clinic_002',
    name: 'Advanced Aesthetic Clinic',
    slug: 'advanced-aesthetic',
    type: 'medical_practice',
    status: 'active',
    plan: 'enterprise',
    timezone: 'GMT',
    createdAt: '2025-06-01T00:00:00Z',
  },
  clinic3: {
    id: 'org_clinic_003',
    name: 'Wellness & Beauty Center',
    slug: 'wellness-beauty',
    type: 'medical_practice',
    status: 'inactive',
    plan: 'starter',
    timezone: 'GMT',
    createdAt: '2024-01-01T00:00:00Z',
  },
};

/**
 * Sample VAPI Credentials (encrypted in reality)
 */
export const MOCK_VAPI_CREDENTIALS = {
  clinic1: {
    apiKey: 'sk_test_vapi_clinic1_abc123def456xyz789',
    webhookSecret: 'whs_test_clinic1_secret_xyz789',
    publicKey: 'pk_test_vapi_clinic1_public_key_123',
    accountId: 'account_vapi_001',
  },
  clinic2: {
    apiKey: 'sk_test_vapi_clinic2_ghi123jkl456mno789',
    webhookSecret: 'whs_test_clinic2_secret_mno789',
    publicKey: 'pk_test_vapi_clinic2_public_key_456',
    accountId: 'account_vapi_002',
  },
  clinic3: {
    apiKey: 'sk_test_vapi_clinic3_pqr123stu456vwx789',
    webhookSecret: 'whs_test_clinic3_secret_vwx789',
    publicKey: 'pk_test_vapi_clinic3_public_key_789',
    accountId: 'account_vapi_003',
  },
};

/**
 * Sample Twilio Credentials
 */
export const MOCK_TWILIO_CREDENTIALS = {
  clinic1: {
    accountSid: 'ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p',
    authToken: 'authtoken1234567890abcdefghijklmn',
    phoneNumber: '+12025551234',
    friendlyName: 'Premier Clinic Line',
  },
  clinic2: {
    accountSid: 'ACz9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k',
    authToken: 'authtoken0987654321zyxwvutsrqpon',
    phoneNumber: '+14155552222',
    friendlyName: 'Advanced Clinic Line',
  },
  clinic3: {
    accountSid: 'ACm1l2k3j4i5h6g7f8e9d0c1b2a3z4y5x',
    authToken: 'authtoken1357913579abcdefghijklmn',
    phoneNumber: '+13105553333',
    friendlyName: 'Wellness Clinic Line',
  },
};

/**
 * Sample Call Transcripts
 */
export const MOCK_TRANSCRIPTS = {
  facelifInquiry: `Customer: Hi, I'm interested in a facelift procedure.
Assistant: Welcome! We specialize in facelift procedures. Can you tell me more about your concerns?
Customer: I have some sagging skin and would like to look more youthful.
Assistant: That's a common concern. A facelift can address these issues beautifully.
Customer: How much does it typically cost?
Assistant: Our facelift procedures range from £8,000 to £12,000 depending on the extent of the procedure.
Customer: That sounds reasonable. Can I schedule a consultation?
Assistant: Absolutely! Let me check our availability.`,

  rhinoplastyInquiry: `Customer: I'd like to discuss a nose job.
Assistant: Of course! Rhinoplasty is one of our most popular procedures.
Customer: I'm concerned about the shape of my nose.
Assistant: We can certainly help with that. What specific concerns do you have?
Customer: It's too wide and I'd like it more proportional to my face.
Assistant: That's achievable with modern rhinoplasty techniques.`,

  pricingOnlyInquiry: `Customer: Hi, I'm just calling to ask about pricing.
Assistant: Of course! What procedure are you interested in?
Customer: Just general pricing information for various procedures.
Assistant: We can provide that information. Our most popular procedures are...`,

  bookingInquiry: `Customer: I'd like to book an appointment.
Assistant: Great! I can help you schedule that.
Customer: What dates do you have available?
Assistant: Let me check our calendar. We have openings next week.
Customer: Perfect! I'll take Tuesday at 2 PM.
Assistant: Excellent! You're booked for Tuesday at 2 PM. See you then!`,

  shortCall: `Customer: Hi.
Assistant: Hello, how can I help?
Customer: Just wanted to know if you're open.
Assistant: Yes, we're open Monday to Friday.`,
};

/**
 * Sample Call Summaries
 */
export const MOCK_SUMMARIES = {
  facelifInquiry: 'Customer interested in facelift procedure. Discussed procedure details and pricing (£8,000-£12,000). Customer requested to schedule consultation.',

  rhinoplastyInquiry: 'Customer inquired about rhinoplasty to address nose width concerns. Discussed procedure feasibility and benefits.',

  pricingOnlyInquiry: 'Customer called for general pricing information about various cosmetic procedures.',

  bookingConfirmed: 'Appointment booked successfully for consultation. Customer scheduled for next week.',

  shortCall: 'Brief call - customer asked about business hours.',
};

/**
 * Sample Assistant Configurations
 */
export const MOCK_ASSISTANT_CONFIGS = {
  clinic1_facelift: {
    id: 'asst_clinic1_facelift_001',
    name: 'Facelift Specialist',
    orgId: 'org_clinic_001',
    systemPrompt: 'You are a friendly and professional facelift specialist...',
    model: 'gpt-4',
    voice: 'alloy',
    tools: ['checkSlotAvailability', 'bookAppointment', 'getPrice'],
  },
  clinic2_general: {
    id: 'asst_clinic2_general_001',
    name: 'General Inquiry Assistant',
    orgId: 'org_clinic_002',
    systemPrompt: 'You are a welcoming receptionist for our cosmetic surgery clinic...',
    model: 'gpt-4',
    voice: 'nova',
    tools: ['checkSlotAvailability', 'bookAppointment', 'getPrice', 'getServicesInfo'],
  },
};

/**
 * Sample Call Records
 */
export const MOCK_CALL_RECORDS = {
  hot_lead_unbooked: {
    id: 'call_001',
    orgId: 'org_clinic_001',
    vapiCallId: 'vapi_call_001',
    assistantId: 'asst_clinic1_facelift_001',
    customerId: 'cust_001',
    status: 'ended',
    durationSeconds: 180,
    startedAt: '2026-01-10T10:00:00Z',
    endedAt: '2026-01-10T10:03:00Z',
    procedure_intent: 'facelift',
    sentiment_score: 0.85,
    lead_temp: 'hot',
    financial_value: 10000,
    transcript: MOCK_TRANSCRIPTS.facelifInquiry,
    summary: MOCK_SUMMARIES.facelifInquiry,
  },

  warm_lead_short_call: {
    id: 'call_002',
    orgId: 'org_clinic_001',
    vapiCallId: 'vapi_call_002',
    assistantId: 'asst_clinic1_facelift_001',
    customerId: 'cust_002',
    status: 'ended',
    durationSeconds: 45,
    startedAt: '2026-01-10T11:00:00Z',
    endedAt: '2026-01-10T11:00:45Z',
    procedure_intent: 'pricing_inquiry',
    sentiment_score: 0.5,
    lead_temp: 'cool',
    financial_value: 0,
    transcript: MOCK_TRANSCRIPTS.shortCall,
    summary: MOCK_SUMMARIES.shortCall,
  },

  booked_lead: {
    id: 'call_003',
    orgId: 'org_clinic_002',
    vapiCallId: 'vapi_call_003',
    assistantId: 'asst_clinic2_general_001',
    customerId: 'cust_003',
    status: 'ended',
    durationSeconds: 240,
    startedAt: '2026-01-10T14:00:00Z',
    endedAt: '2026-01-10T14:04:00Z',
    procedure_intent: 'booking_inquiry',
    sentiment_score: 0.9,
    lead_temp: 'cool',
    financial_value: 150,
    transcript: MOCK_TRANSCRIPTS.bookingInquiry,
    summary: MOCK_SUMMARIES.bookingConfirmed,
    appointment_booked: true,
  },
};

/**
 * Sample Webhook Payloads from VAPI
 */
export const MOCK_WEBHOOK_PAYLOADS = {
  endOfCall: {
    event: 'call/ended',
    data: {
      call: {
        id: 'call_vapi_001',
        orgId: 'org_clinic_001',
        assistantId: 'asst_clinic1_facelift_001',
        customerId: 'cust_001',
        status: 'ended',
        duration: 180,
        startedAt: '2026-01-10T10:00:00Z',
        endedAt: '2026-01-10T10:03:00Z',
      },
      messages: [
        {
          role: 'customer',
          message: 'Hi, I am interested in a facelift.',
        },
        {
          role: 'assistant',
          message: 'Great! We have excellent facelift services.',
        },
      ],
      analysis: {
        summary: 'Customer interested in facelift',
        sentiment: 'positive',
      },
      recordingUrl: 'https://recordings.vapi.ai/call_001.wav',
    },
  },

  toolCall: {
    event: 'call/tool-call',
    data: {
      call: {
        id: 'call_vapi_002',
        orgId: 'org_clinic_002',
        assistantId: 'asst_clinic2_general_001',
      },
      toolCall: {
        function: {
          name: 'bookAppointment',
          arguments: {
            date: '2026-02-01',
            time: '14:00',
          },
        },
      },
      result: {
        success: true,
        appointmentId: 'apt_001',
      },
    },
  },
};

/**
 * Sample Intent Examples for Testing
 */
export const MOCK_INTENT_EXAMPLES = {
  facelift: [
    'I want a facelift',
    'Can you do a face lift procedure?',
    'I am interested in facelift surgery',
    'Face lift cost?',
  ],
  rhinoplasty: [
    'I want a nose job',
    'Can you do rhinoplasty?',
    'I am interested in nose surgery',
    'Rhinoplasty pricing?',
  ],
  breast_augmentation: [
    'I want breast augmentation',
    'Can you do breast implants?',
    'Interested in boob job',
    'Breast enhancement surgery',
  ],
  pricing_inquiry: [
    'How much does it cost?',
    'What is your pricing?',
    'How much are your procedures?',
    'Pricing information please',
  ],
  booking_inquiry: [
    'Can I book an appointment?',
    'I want to schedule a consultation',
    'Book a time to see the doctor',
    'Schedule an appointment',
  ],
  general_inquiry: [
    'Hi, are you open?',
    'What services do you offer?',
    'Tell me about your clinic',
  ],
};

/**
 * Sample Sentiment Scores
 */
export const MOCK_SENTIMENT_SCORES = {
  positive: 0.9,
  neutral: 0.5,
  negative: 0.2,
};

/**
 * Sample Financial Values by Intent
 */
export const MOCK_FINANCIAL_VALUES = {
  facelift: 10000,
  rhinoplasty: 6000,
  breast_augmentation: 7000,
  booking_inquiry: 150,
  pricing_inquiry: 0,
  general_inquiry: 0,
};

/**
 * Sample Lead Temperature Classifications
 */
export const MOCK_LEAD_TEMPS = {
  hot: {
    intent: 'facelift',
    duration: 120,
    booked: false,
    sentiment: 0.8,
  },
  warm: {
    intent: 'rhinoplasty',
    duration: 60,
    booked: false,
    sentiment: 0.6,
  },
  cool_booked: {
    intent: 'booking_inquiry',
    duration: 90,
    booked: true,
    sentiment: 0.7,
  },
  cool_short: {
    intent: 'pricing_inquiry',
    duration: 15,
    booked: false,
    sentiment: 0.4,
  },
};

/**
 * Shared Test Constants
 */
export const TEST_CONSTANTS = {
  TIMEOUT_MS: 5000,
  RETRY_COUNT: 3,
  CACHE_TTL_MS: 3600000, // 1 hour
  WEBHOOK_SIGNATURE_ALGORITHM: 'sha256',
};

/**
 * Multi-tenant Test Data
 */
export const MOCK_MULTI_TENANT_DATA = {
  org1_assistant_mapping: {
    assistantId: 'asst_clinic1_001',
    orgId: 'org_clinic_001',
    createdAt: '2026-01-01T00:00:00Z',
  },
  org2_assistant_mapping: {
    assistantId: 'asst_clinic2_001',
    orgId: 'org_clinic_002',
    createdAt: '2026-01-02T00:00:00Z',
  },
  org1_credential_mapping: {
    orgId: 'org_clinic_001',
    provider: 'vapi',
    encryptedCredentials: 'encrypted_data_clinic1',
    iv: 'initialization_vector_1',
  },
  org2_credential_mapping: {
    orgId: 'org_clinic_002',
    provider: 'vapi',
    encryptedCredentials: 'encrypted_data_clinic2',
    iv: 'initialization_vector_2',
  },
};
