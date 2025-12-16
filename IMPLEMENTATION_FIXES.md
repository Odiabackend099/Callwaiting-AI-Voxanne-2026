# Implementation Fixes for User Flow Gaps

## Priority 1: Critical Missing Endpoint

### Fix 1.1: Implement `/api/founder-console/agent/web-test-outbound`

**File:** `/backend/src/routes/founder-console.ts`

Add this endpoint to handle outbound test calls:

```typescript
/**
 * POST /api/founder-console/agent/web-test-outbound
 * Initiates a test call to a phone number using outbound agent config
 */
router.post('/agent/web-test-outbound', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate request
    const schema = z.object({
      phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format')
    });

    let validated: { phoneNumber: string };
    try {
      validated = schema.parse(req.body);
    } catch (validationError: any) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationError.errors[0]?.message || 'Invalid phone number format'
      });
      return;
    }

    // Fetch outbound agent config
    const { data: outboundConfig, error: configError } = await supabase
      .from('outbound_agent_config')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (configError || !outboundConfig) {
      res.status(400).json({
        error: 'Outbound agent configuration not found',
        details: 'Please configure outbound agent first'
      });
      return;
    }

    // Validate config is complete
    if (!outboundConfig.twilio_phone_number || !outboundConfig.system_prompt) {
      res.status(400).json({
        error: 'Incomplete outbound agent configuration',
        details: 'Missing: ' + [
          !outboundConfig.twilio_phone_number && 'Twilio Phone Number',
          !outboundConfig.system_prompt && 'System Prompt'
        ].filter(Boolean).join(', ')
      });
      return;
    }

    // Create call via Vapi with outbound config
    const vapiClient = new VapiClient(outboundConfig.vapi_api_key || process.env.VAPI_API_KEY);
    
    const callResponse = await vapiClient.createCall({
      phoneNumber: validated.phoneNumber,
      assistantId: outboundConfig.vapi_assistant_id || process.env.VAPI_ASSISTANT_ID,
      systemPrompt: outboundConfig.system_prompt,
      firstMessage: outboundConfig.first_message,
      voiceId: outboundConfig.voice_id,
      language: outboundConfig.language,
      twilioAccountSid: outboundConfig.twilio_account_sid,
      twilioAuthToken: outboundConfig.twilio_auth_token,
      twilioPhoneNumber: outboundConfig.twilio_phone_number,
      isTestCall: true
    });

    if (!callResponse.id) {
      res.status(500).json({
        error: 'Failed to initiate call',
        details: 'Vapi API returned invalid response'
      });
      return;
    }

    // Create call tracking record
    const { data: tracking, error: trackingError } = await supabase
      .from('call_tracking')
      .insert({
        org_id: orgId,
        vapi_call_id: callResponse.id,
        status: 'ringing',
        phone: validated.phoneNumber,
        metadata: {
          channel: 'outbound',
          is_test_call: true,
          source: 'web_test',
          outboundConfigId: outboundConfig.id
        }
      })
      .select('id')
      .single();

    if (trackingError) {
      log.error('POST /agent/web-test-outbound', 'Failed to create tracking', {
        orgId,
        error: trackingError.message
      });
      res.status(500).json({
        error: 'Failed to track call',
        details: 'Call initiated but tracking failed'
      });
      return;
    }

    log.info('POST /agent/web-test-outbound', 'Test call initiated', {
      orgId,
      trackingId: tracking.id,
      vapiCallId: callResponse.id,
      phoneNumber: validated.phoneNumber
    });

    res.status(200).json({
      success: true,
      trackingId: tracking.id,
      callId: callResponse.id,
      status: 'initiated'
    });

  } catch (error: any) {
    log.error('POST /agent/web-test-outbound', 'Error', {
      error: error.message
    });
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});
```

---

## Priority 2: Frontend Form Validation

### Fix 2.1: Add Real-Time Twilio SID Validation

**File:** `/src/app/dashboard/outbound-agent-config/page.tsx`

Add validation helper and update input:

```typescript
// Add validation helper
const validateTwilioSID = (sid: string): { valid: boolean; error?: string } => {
  if (!sid) return { valid: false };
  if (!sid.startsWith('AC')) return { valid: false, error: 'Must start with AC' };
  if (sid.length !== 34) return { valid: false, error: 'Must be 34 characters' };
  return { valid: true };
};

const validateAuthToken = (token: string): { valid: boolean; error?: string } => {
  if (!token) return { valid: false };
  if (token.length !== 32) return { valid: false, error: 'Must be 32 characters' };
  return { valid: true };
};

const validatePhoneNumber = (phone: string): { valid: boolean; error?: string } => {
  if (!phone) return { valid: false };
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  if (!e164Regex.test(phone)) return { valid: false, error: 'Must be in E.164 format (+1234567890)' };
  return { valid: true };
};

// In JSX, update Twilio SID input:
const sidValidation = validateTwilioSID(config.twilio_account_sid);
const tokenValidation = validateAuthToken(config.twilio_auth_token);
const phoneValidation = validatePhoneNumber(config.twilio_phone_number);

<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Twilio Account SID
  </label>
  <input
    type="password"
    value={config.twilio_account_sid}
    onChange={(e) => setConfig({ ...config, twilio_account_sid: e.target.value })}
    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
      config.twilio_account_sid && !sidValidation.valid
        ? 'border-red-500 focus:ring-red-500'
        : 'border-gray-300 focus:ring-emerald-500'
    }`}
  />
  {config.twilio_account_sid && !sidValidation.valid && (
    <p className="text-red-500 text-sm mt-1">❌ {sidValidation.error}</p>
  )}
  {config.twilio_account_sid && sidValidation.valid && (
    <p className="text-green-500 text-sm mt-1">✅ Valid format</p>
  )}
</div>
```

### Fix 2.2: Add Phone Number Format Validation

```typescript
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Twilio Phone Number (Outbound)
  </label>
  <input
    type="tel"
    value={config.twilio_phone_number}
    onChange={(e) => setConfig({ ...config, twilio_phone_number: e.target.value })}
    placeholder="+1234567890"
    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
      config.twilio_phone_number && !phoneValidation.valid
        ? 'border-red-500 focus:ring-red-500'
        : 'border-gray-300 focus:ring-emerald-500'
    }`}
  />
  {config.twilio_phone_number && !phoneValidation.valid && (
    <p className="text-red-500 text-sm mt-1">❌ {phoneValidation.error}</p>
  )}
  {config.twilio_phone_number && phoneValidation.valid && (
    <p className="text-green-500 text-sm mt-1">✅ Valid E.164 format</p>
  )}
</div>
```

### Fix 2.3: Add Max Call Duration Validation

```typescript
const validateMaxDuration = (duration: number): boolean => {
  return duration >= 60 && duration <= 3600;
};

<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Max Call Duration (seconds)
  </label>
  <input
    type="number"
    value={config.max_call_duration}
    onChange={(e) => {
      const value = parseInt(e.target.value);
      if (validateMaxDuration(value)) {
        setConfig({ ...config, max_call_duration: value });
      }
    }}
    min="60"
    max="3600"
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
  />
  <p className="text-xs text-gray-500 mt-1">60-3600 seconds (1-60 minutes)</p>
  {!validateMaxDuration(config.max_call_duration) && (
    <p className="text-red-500 text-sm mt-1">❌ Must be between 60 and 3600 seconds</p>
  )}
</div>
```

---

## Priority 3: Frontend Loading States & Error Handling

### Fix 3.1: Add Loading State to Outbound Config Page

```typescript
// Add loading state for config fetch
const [isLoadingConfig, setIsLoadingConfig] = useState(true);

useEffect(() => {
  if (user) {
    setIsLoadingConfig(true);
    fetchConfig().finally(() => setIsLoadingConfig(false));
  }
}, [user]);

// Update header to show loading
{isLoadingConfig && (
  <div className="flex items-center gap-2 text-gray-600">
    <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
    Loading configuration...
  </div>
)}
```

### Fix 3.2: Add Timeout Handling

```typescript
const handleSave = async () => {
  setIsSaving(true);
  setError(null);
  setSuccess(false);

  try {
    const token = await getToken();
    
    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
    );

    const fetchPromise = fetch(`${API_BASE_URL}/api/founder-console/outbound-agent-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      },
      body: JSON.stringify(config)
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'Failed to save');
    }

    const data = await response.json();
    setConfig(data);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 5000); // Increased from 3s to 5s
  } catch (err: any) {
    setError(err?.message || 'Failed to save configuration');
  } finally {
    setIsSaving(false);
  }
};
```

---

## Priority 4: Test Page Improvements

### Fix 4.1: Add Phone Number Validation on Test Page

```typescript
const validatePhoneNumber = (phone: string): boolean => {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
};

const handleStartPhoneCall = async () => {
  if (!phoneNumber) {
    alert('Please enter a phone number');
    return;
  }

  if (!validatePhoneNumber(phoneNumber)) {
    alert('Phone number must be in E.164 format (e.g., +1234567890)');
    return;
  }

  if (!outboundConfigLoaded) {
    alert('Outbound agent configuration is not ready. Please configure it first.');
    return;
  }

  // Show confirmation
  const confirmed = confirm(
    `Make a test call to ${phoneNumber}? You will be charged for this call.`
  );
  if (!confirmed) return;

  setIsCallingPhone(true);
  try {
    // ... rest of call logic
  } finally {
    setIsCallingPhone(false);
  }
};
```

### Fix 4.2: Add Loading State While Fetching Config

```typescript
const [isLoadingConfig, setIsLoadingConfig] = useState(false);

useEffect(() => {
  const loadOutboundConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/founder-console/outbound-agent-config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to load configuration');
      }

      const config = await response.json();
      if (!config.twilio_phone_number || !config.system_prompt) {
        setOutboundConfigError('Outbound agent configuration is incomplete. Missing: ' + [
          !config.twilio_phone_number && 'Twilio Phone Number',
          !config.system_prompt && 'System Prompt'
        ].filter(Boolean).join(', '));
      } else {
        setOutboundConfigLoaded(true);
        setOutboundConfigError(null);
      }
    } catch (err) {
      setOutboundConfigError('Failed to load outbound agent configuration');
      setOutboundConfigLoaded(false);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  if (activeTab === 'phone' && user) {
    loadOutboundConfig();
  }
}, [activeTab, user]);

// In JSX, show loading state
{isLoadingConfig && (
  <div className="flex items-center gap-2 text-gray-600">
    <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
    Loading outbound agent configuration...
  </div>
)}
```

### Fix 4.3: Add Error Link to Config Page

```typescript
{outboundConfigError && (
  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-medium text-red-900">Configuration Error</p>
      <p className="text-sm text-red-700">{outboundConfigError}</p>
      <button
        onClick={() => router.push('/dashboard/outbound-agent-config')}
        className="text-sm text-red-600 hover:text-red-800 font-medium mt-2 underline"
      >
        Go to Outbound Agent Config →
      </button>
    </div>
  </div>
)}
```

---

## Priority 5: Sidebar Navigation

### Fix 5.1: Add Outbound Agent Config Link to Sidebar

**File:** `/src/components/dashboard/LeftSidebar.tsx`

Add menu item:

```typescript
<nav className="space-y-2">
  {/* ... existing items ... */}
  
  <NavLink href="/dashboard/outbound-agent-config" icon={Phone}>
    📤 Outbound Agent Config
  </NavLink>
  
  {/* ... rest of items ... */}
</nav>
```

---

## Priority 6: WebSocket Error Handling

### Fix 6.1: Improve WebSocket Connection

**File:** `/src/app/dashboard/test/page.tsx`

```typescript
useEffect(() => {
  if (activeTab !== 'phone' || !outboundTrackingId) {
    if (outboundWsRef.current) {
      outboundWsRef.current.close();
      outboundWsRef.current = null;
    }
    return;
  }

  const connectWebSocket = async () => {
    const token = await getAuthToken();
    if (!token) {
      setOutboundConfigError('Authentication failed');
      return;
    }

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const backendUrl = new URL(API_BASE_URL);
      const wsHost = backendUrl.host;
      const wsUrl = `${wsProtocol}//${wsHost}/ws/live-calls`;

      const ws = new WebSocket(wsUrl);
      outboundWsRef.current = ws;

      ws.onopen = () => {
        console.log('[LiveCall] WebSocket connected');
        setOutboundConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', token, trackingId: outboundTrackingId }));
      };

      ws.onerror = (event) => {
        console.error('[LiveCall] WebSocket error:', event);
        setOutboundConfigError('Connection error: Failed to connect to live call service');
      };

      ws.onclose = () => {
        console.log('[LiveCall] WebSocket closed');
        setOutboundConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.trackingId !== outboundTrackingId) return;

          if (data.type === 'transcript') {
            const speaker = data.speaker === 'agent' ? 'agent' : 'user';
            const newTranscript = {
              id: `${outboundTrackingId}_${Date.now()}_${Math.random()}`,
              speaker,
              text: data.text,
              isFinal: data.is_final === true,
              confidence: data.confidence || 0.95,
              timestamp: new Date()
            };
            setOutboundTranscripts(prev => [...prev, newTranscript]);
          }
        } catch (error) {
          console.error('[LiveCall] Failed to parse message:', error);
        }
      };
    } catch (error: any) {
      console.error('[LiveCall] Connection error:', error);
      setOutboundConfigError('Failed to connect to live call service');
    }
  };

  connectWebSocket();

  return () => {
    if (outboundWsRef.current) {
      outboundWsRef.current.close();
    }
  };
}, [activeTab, outboundTrackingId]);
```

---

## Summary of Fixes

| Priority | Issue | Status |
|----------|-------|--------|
| 1 | Missing `/api/founder-console/agent/web-test-outbound` endpoint | ✅ Provided |
| 2 | No real-time form validation | ✅ Provided |
| 3 | No loading states | ✅ Provided |
| 4 | No phone number validation | ✅ Provided |
| 5 | No sidebar link | ✅ Provided |
| 6 | WebSocket error handling | ✅ Provided |

All critical gaps have been identified and fixes provided.
