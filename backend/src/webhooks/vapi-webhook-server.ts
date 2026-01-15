/**
 * VAPI Webhook Server
 * Handles incoming webhooks from VAPI service
 * Port: 3002
 */

import express, { Express, Request, Response } from 'express';
import crypto from 'crypto';

interface VAPIWebhookPayload {
  event: string;
  data: any;
  timestamp: string;
}

class VAPIWebhookServer {
  private app: Express;
  private port: number;
  private vapiSecret: string;

  constructor(port: number = 3002, vapiSecret: string = process.env.VAPI_WEBHOOK_SECRET || '') {
    this.app = express();
    this.port = port;
    this.vapiSecret = vapiSecret;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[VAPI Webhook] ${req.method} ${req.path}`);
      next();
    });

    // Signature verification middleware
    this.app.use((req, res, next) => {
      if (req.path !== '/health' && req.method === 'POST') {
        this.verifySignature(req, res, next);
      } else {
        next();
      }
    });
  }

  private verifySignature(req: Request, res: Response, next: express.NextFunction): void {
    if (!this.vapiSecret) {
      console.warn('[VAPI Webhook] Warning: VAPI_WEBHOOK_SECRET not configured, skipping signature verification');
      return next();
    }

    const signature = req.headers['x-vapi-signature'] as string;
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature header' });
    }

    // Verify HMAC signature
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', this.vapiSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('[VAPI Webhook] Invalid signature detected');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        service: 'vapi-webhook',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        service: 'VAPI Webhook Server',
        version: '1.0.0',
        endpoints: {
          'GET /health': 'Health check',
          'POST /webhook': 'VAPI webhook handler',
          'POST /webhook/call': 'Call-related events',
          'POST /webhook/message': 'Message events',
          'POST /webhook/transcription': 'Transcription events',
        },
      });
    });

    // Main webhook endpoint
    this.app.post('/webhook', (req: Request, res: Response) => {
      this.handleWebhook(req.body, res);
    });

    // Call webhook endpoint
    this.app.post('/webhook/call', (req: Request, res: Response) => {
      this.handleCallWebhook(req.body, res);
    });

    // Message webhook endpoint
    this.app.post('/webhook/message', (req: Request, res: Response) => {
      this.handleMessageWebhook(req.body, res);
    });

    // Transcription webhook endpoint
    this.app.post('/webhook/transcription', (req: Request, res: Response) => {
      this.handleTranscriptionWebhook(req.body, res);
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
      });
    });

    // Error handler
    this.app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
      console.error('[VAPI Webhook] Error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
  }

  private handleWebhook(payload: VAPIWebhookPayload, res: Response): void {
    const { event, data, timestamp } = payload;

    console.log(`[VAPI Webhook] Event: ${event}`);
    console.log(`[VAPI Webhook] Timestamp: ${timestamp}`);
    console.log(`[VAPI Webhook] Data:`, JSON.stringify(data, null, 2));

    // Route to specific handler based on event
    switch (event) {
      case 'call.started':
        this.onCallStarted(data);
        break;
      case 'call.ended':
        this.onCallEnded(data);
        break;
      case 'call.recording':
        this.onCallRecording(data);
        break;
      case 'transcription.complete':
        this.onTranscriptionComplete(data);
        break;
      case 'message.received':
        this.onMessageReceived(data);
        break;
      default:
        console.log(`[VAPI Webhook] Unhandled event: ${event}`);
    }

    res.json({
      status: 'ok',
      event,
      processedAt: new Date().toISOString(),
    });
  }

  private handleCallWebhook(payload: any, res: Response): void {
    const { type, callId, duration, status } = payload;
    console.log(`[VAPI Webhook] Call Event - Type: ${type}, CallID: ${callId}, Status: ${status}, Duration: ${duration}s`);

    res.json({
      status: 'ok',
      callId,
      processedAt: new Date().toISOString(),
    });
  }

  private handleMessageWebhook(payload: any, res: Response): void {
    const { type, messageId, content } = payload;
    console.log(`[VAPI Webhook] Message Event - Type: ${type}, MessageID: ${messageId}`);

    res.json({
      status: 'ok',
      messageId,
      processedAt: new Date().toISOString(),
    });
  }

  private handleTranscriptionWebhook(payload: any, res: Response): void {
    const { transcriptionId, text, confidence } = payload;
    console.log(`[VAPI Webhook] Transcription - ID: ${transcriptionId}, Confidence: ${confidence}, Text: ${text.substring(0, 50)}...`);

    res.json({
      status: 'ok',
      transcriptionId,
      processedAt: new Date().toISOString(),
    });
  }

  private onCallStarted(data: any): void {
    console.log(`[VAPI Webhook] Call started:`, {
      callId: data.callId,
      from: data.from,
      to: data.to,
      timestamp: data.timestamp,
    });
  }

  private onCallEnded(data: any): void {
    console.log(`[VAPI Webhook] Call ended:`, {
      callId: data.callId,
      duration: data.duration,
      status: data.status,
      timestamp: data.timestamp,
    });
  }

  private onCallRecording(data: any): void {
    console.log(`[VAPI Webhook] Call recording:`, {
      callId: data.callId,
      recordingUrl: data.recordingUrl,
      duration: data.duration,
    });
  }

  private onTranscriptionComplete(data: any): void {
    console.log(`[VAPI Webhook] Transcription complete:`, {
      callId: data.callId,
      text: data.text.substring(0, 100),
      confidence: data.confidence,
    });
  }

  private onMessageReceived(data: any): void {
    console.log(`[VAPI Webhook] Message received:`, {
      from: data.from,
      content: data.content.substring(0, 100),
      timestamp: data.timestamp,
    });
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`
╔════════════════════════════════════════╗
║   VAPI Webhook Server Started          ║
╚════════════════════════════════════════╝

Port: ${this.port}
Environment: ${process.env.NODE_ENV || 'development'}
Uptime: ${new Date().toISOString()}

Endpoints:
  GET  /health
  POST /webhook
  POST /webhook/call
  POST /webhook/message
  POST /webhook/transcription

Ready to receive VAPI webhooks!
      `);
    });
  }
}

// Start server
const server = new VAPIWebhookServer(3002);
server.start();

export default VAPIWebhookServer;
