import { Router, Request, Response } from 'express';
import { sendDemoEmail, sendDemoSms, sendDemoWhatsApp, DemoRecipient, DemoContext } from '../services/demo-service';

export const demoDeliveryRouter = Router();

// ============================================
// TYPES
// ============================================

interface SendDemoEmailRequest {
  prospect_name: string;
  prospect_email: string;
  clinic_name: string;
  demo_type: 'outbound_intro' | 'inbound_intro' | 'feature_overview';
  agent_id: string;
  call_id?: string;
}

interface SendDemoSmsRequest {
  prospect_name: string;
  prospect_phone: string;
  clinic_name: string;
  demo_type: 'outbound_intro' | 'inbound_intro' | 'feature_overview';
  agent_id: string;
  call_id?: string;
}

interface SendDemoWhatsAppRequest {
  prospect_name: string;
  prospect_phone: string;
  clinic_name: string;
  demo_type: 'outbound_intro' | 'inbound_intro' | 'feature_overview';
  agent_id: string;
  call_id?: string;
}

interface SearchWebRequest {
  query: string;
  max_results?: number;
}

// ============================================
// SEND DEMO EMAIL
// ============================================

demoDeliveryRouter.post('/send-email', async (req: Request, res: Response) => {
  try {
    const {
      prospect_name,
      prospect_email,
      clinic_name,
      demo_type,
      agent_id,
      call_id
    }: SendDemoEmailRequest = req.body;

    if (!prospect_name || !prospect_email || !clinic_name || !demo_type || !agent_id) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const recipient: DemoRecipient = {
      name: prospect_name,
      email: prospect_email,
      clinic_name
    };

    const context: DemoContext = {
      demo_type,
      agent_id,
      call_id
    };

    const result = await sendDemoEmail(recipient, context);
    res.json(result);
  } catch (error: any) {
    console.error('Error sending demo email:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error 
    });
  }
});

// ============================================
// SEND DEMO SMS
// ============================================

demoDeliveryRouter.post('/send-sms', async (req: Request, res: Response) => {
  try {
    const {
      prospect_name,
      prospect_phone,
      clinic_name,
      demo_type,
      agent_id,
      call_id
    }: SendDemoSmsRequest = req.body;

    if (!prospect_name || !prospect_phone || !clinic_name || !demo_type || !agent_id) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const recipient: DemoRecipient = {
      name: prospect_name,
      phone: prospect_phone,
      clinic_name
    };

    const context: DemoContext = {
      demo_type,
      agent_id,
      call_id
    };

    const result = await sendDemoSms(recipient, context);
    res.json(result);
  } catch (error: any) {
    console.error('Error sending demo SMS:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error 
    });
  }
});

// ============================================
// SEND DEMO WHATSAPP
// ============================================

demoDeliveryRouter.post('/send-whatsapp', async (req: Request, res: Response) => {
  try {
    const {
      prospect_name,
      prospect_phone,
      clinic_name,
      demo_type,
      agent_id,
      call_id
    }: SendDemoWhatsAppRequest = req.body;

    if (!prospect_name || !prospect_phone || !clinic_name || !demo_type || !agent_id) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const recipient: DemoRecipient = {
      name: prospect_name,
      phone: prospect_phone,
      clinic_name
    };

    const context: DemoContext = {
      demo_type,
      agent_id,
      call_id
    };

    const result = await sendDemoWhatsApp(recipient, context);
    res.json(result);
  } catch (error: any) {
    console.error('Error sending demo WhatsApp:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error 
    });
  }
});

// ============================================
// BOOK DEMO MEETING (TEMPORARILY DISABLED)
// ============================================
// Endpoint commented out until Google Calendar OAuth is configured.

// ============================================
// SEARCH WEB
// ============================================

demoDeliveryRouter.post('/search-web', async (req: Request, res: Response) => {
  try {
    const { query, max_results = 3 }: SearchWebRequest = req.body;

    if (!query) {
      res.status(400).json({ error: 'Missing query parameter' });
      return;
    }

    // Safeguard
    const forbiddenKeywords = [
      'diagnose', 'treatment', 'medication', 'cure', 'dose', 'prescribe'
    ];

    if (forbiddenKeywords.some(kw => query.toLowerCase().includes(kw))) {
      res.status(400).json({
        error: 'Cannot search for medical advice. Please defer to the clinic.'
      });
      return;
    }

    // Placeholder results
    const searchResults = [
      {
        title: 'Clinic Website Information',
        snippet: 'Search results would be retrieved from clinic website',
        url: 'https://clinic-example.com'
      }
    ];

    res.json({
      success: true,
      query,
      results: searchResults.slice(0, max_results),
      note: 'This is a placeholder. In production, integrate with Google Custom Search or similar.'
    });
  } catch (error) {
    console.error('Error searching web:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default demoDeliveryRouter;
