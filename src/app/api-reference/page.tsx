import { Metadata } from "next";
import Link from "next/link";
import { Code, Key, Database, Webhook, Phone, Calendar, Users, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "API Reference - Voxanne AI",
  description: "Developer documentation for Voxanne AI REST API. Integrate with agents, calls, contacts, and webhooks.",
};

const endpoints = [
  {
    category: "Agents",
    icon: Phone,
    description: "Create and manage AI agents",
    endpoints: [
      {
        method: "GET",
        path: "/api/agents",
        description: "List all agents for your organization",
      },
      {
        method: "POST",
        path: "/api/agents",
        description: "Create a new AI agent",
      },
      {
        method: "GET",
        path: "/api/agents/:id",
        description: "Get a specific agent by ID",
      },
      {
        method: "PATCH",
        path: "/api/agents/:id",
        description: "Update an agent's configuration",
      },
      {
        method: "DELETE",
        path: "/api/agents/:id",
        description: "Delete an agent",
      },
    ],
  },
  {
    category: "Calls",
    icon: Phone,
    description: "Access call logs and transcripts",
    endpoints: [
      {
        method: "GET",
        path: "/api/calls",
        description: "List all calls with filtering options",
      },
      {
        method: "GET",
        path: "/api/calls/:id",
        description: "Get detailed call information",
      },
      {
        method: "GET",
        path: "/api/calls/:id/transcript",
        description: "Get call transcript",
      },
      {
        method: "GET",
        path: "/api/calls/:id/recording",
        description: "Get call recording URL",
      },
    ],
  },
  {
    category: "Contacts",
    icon: Users,
    description: "Manage patient/customer contacts",
    endpoints: [
      {
        method: "GET",
        path: "/api/contacts",
        description: "List all contacts",
      },
      {
        method: "POST",
        path: "/api/contacts",
        description: "Create a new contact",
      },
      {
        method: "GET",
        path: "/api/contacts/:id",
        description: "Get contact details",
      },
      {
        method: "PATCH",
        path: "/api/contacts/:id",
        description: "Update contact information",
      },
      {
        method: "POST",
        path: "/api/contacts/:id/call-back",
        description: "Initiate outbound call to contact",
      },
    ],
  },
  {
    category: "Appointments",
    icon: Calendar,
    description: "Schedule and manage appointments",
    endpoints: [
      {
        method: "GET",
        path: "/api/appointments",
        description: "List appointments",
      },
      {
        method: "POST",
        path: "/api/appointments",
        description: "Create appointment",
      },
      {
        method: "PATCH",
        path: "/api/appointments/:id",
        description: "Update appointment",
      },
      {
        method: "DELETE",
        path: "/api/appointments/:id",
        description: "Cancel appointment",
      },
    ],
  },
  {
    category: "Webhooks",
    icon: Webhook,
    description: "Receive real-time events",
    endpoints: [
      {
        method: "POST",
        path: "/webhooks/vapi",
        description: "Receive Vapi voice events",
      },
      {
        method: "POST",
        path: "/webhooks/stripe",
        description: "Receive Stripe billing events",
      },
      {
        method: "GET",
        path: "/api/webhook-logs",
        description: "View webhook delivery logs",
      },
    ],
  },
];

const codeExamples = {
  authentication: `// Using API key in headers
fetch('https://api.voxanne.ai/api/agents', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})`,
  createAgent: `// Create a new AI agent
const response = await fetch('https://api.voxanne.ai/api/agents', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Front Desk Agent',
    voice_provider: 'elevenlabs',
    voice_id: 'rachel',
    prompt: 'You are a friendly medical receptionist...',
    tools: ['book_appointment', 'check_availability']
  })
});

const agent = await response.json();
console.log('Agent created:', agent.id);`,
  listCalls: `// List recent calls with filtering
const response = await fetch('https://api.voxanne.ai/api/calls?limit=20&status=completed', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});

const calls = await response.json();
calls.forEach(call => {
  console.log(\`Call from \${call.from}: \${call.outcome}\`);
});`,
  webhookHandler: `// Handle webhook events (Node.js/Express)
app.post('/webhooks/vapi', async (req, res) => {
  const event = req.body;

  // Verify webhook signature (recommended)
  const signature = req.headers['x-vapi-signature'];
  if (!verifySignature(event, signature)) {
    return res.status(401).send('Invalid signature');
  }

  // Process event
  switch (event.type) {
    case 'call.started':
      console.log('Call started:', event.call.id);
      break;
    case 'call.ended':
      console.log('Call ended:', event.call.id);
      await saveCallToDatabase(event.call);
      break;
    case 'appointment.booked':
      console.log('Appointment booked:', event.appointment);
      await sendConfirmationEmail(event.appointment);
      break;
  }

  res.status(200).send('OK');
});`,
};

export default function APIReferencePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-4">
            API Reference
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mb-8">
            Build custom integrations with Voxanne AI's REST API. Manage agents, calls, contacts, and receive real-time events via webhooks.
          </p>

          {/* API Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
              <Code className="w-8 h-8 text-surgical-600 mb-3" />
              <h3 className="font-semibold text-navy-900 mb-2">Base URL</h3>
              <code className="text-sm text-slate-700 bg-white px-3 py-1 rounded border border-slate-200">
                https://api.voxanne.ai
              </code>
            </div>
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
              <Key className="w-8 h-8 text-surgical-600 mb-3" />
              <h3 className="font-semibold text-navy-900 mb-2">Authentication</h3>
              <p className="text-sm text-slate-600">Bearer token in Authorization header</p>
            </div>
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
              <Database className="w-8 h-8 text-surgical-600 mb-3" />
              <h3 className="font-semibold text-navy-900 mb-2">Response Format</h3>
              <p className="text-sm text-slate-600">JSON with standard HTTP status codes</p>
            </div>
          </div>
        </div>

        {/* Authentication Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-navy-900 mb-6" id="auth">
            Authentication
          </h2>
          <div className="border border-slate-200 rounded-3xl p-8 bg-white">
            <p className="text-slate-700 mb-6">
              All API requests require an API key passed in the <code className="px-2 py-1 bg-slate-100 rounded text-sm">Authorization</code> header:
            </p>
            <pre className="bg-navy-900 text-white p-6 rounded-2xl overflow-x-auto">
              <code className="text-sm">{codeExamples.authentication}</code>
            </pre>
            <div className="mt-6 p-4 rounded-lg bg-surgical-50 border border-surgical-600/20">
              <p className="text-sm text-slate-700">
                <strong>Get your API key:</strong> Navigate to Dashboard → Settings → API Keys
              </p>
            </div>
          </div>
        </section>

        {/* Endpoints */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-navy-900 mb-6">Endpoints</h2>
          <div className="space-y-8">
            {endpoints.map((category) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.category}
                  className="border border-slate-200 rounded-3xl overflow-hidden"
                  id={category.category.toLowerCase()}
                >
                  <div className="bg-gradient-to-br from-surgical-50 to-white p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-surgical-100 border border-surgical-600/20">
                        <Icon className="w-6 h-6 text-surgical-600" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-navy-900">{category.category}</h3>
                        <p className="text-slate-600">{category.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="space-y-4">
                      {category.endpoints.map((endpoint, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-4 p-4 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <span
                            className={`px-3 py-1 rounded-lg text-sm font-bold ${
                              endpoint.method === "GET"
                                ? "bg-blue-100 text-blue-700"
                                : endpoint.method === "POST"
                                ? "bg-green-100 text-green-700"
                                : endpoint.method === "PATCH"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {endpoint.method}
                          </span>
                          <div className="flex-1">
                            <code className="text-navy-900 font-mono text-sm">
                              {endpoint.path}
                            </code>
                            <p className="text-slate-600 text-sm mt-1">{endpoint.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Code Examples */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-navy-900 mb-6">Code Examples</h2>

          <div className="space-y-8">
            <div className="border border-slate-200 rounded-3xl overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h3 className="text-xl font-bold text-navy-900">Create Agent</h3>
              </div>
              <pre className="bg-navy-900 text-white p-6 overflow-x-auto">
                <code className="text-sm">{codeExamples.createAgent}</code>
              </pre>
            </div>

            <div className="border border-slate-200 rounded-3xl overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h3 className="text-xl font-bold text-navy-900">List Calls</h3>
              </div>
              <pre className="bg-navy-900 text-white p-6 overflow-x-auto">
                <code className="text-sm">{codeExamples.listCalls}</code>
              </pre>
            </div>

            <div className="border border-slate-200 rounded-3xl overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                <h3 className="text-xl font-bold text-navy-900">Webhook Handler</h3>
              </div>
              <pre className="bg-navy-900 text-white p-6 overflow-x-auto">
                <code className="text-sm">{codeExamples.webhookHandler}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Rate Limits */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-navy-900 mb-6">Rate Limits</h2>
          <div className="border border-slate-200 rounded-3xl p-8 bg-white">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <h3 className="font-semibold text-navy-900 mb-2">Per Organization</h3>
                <p className="text-3xl font-bold text-surgical-600 mb-2">1,000 req/hour</p>
                <p className="text-sm text-slate-600">Across all API endpoints</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <h3 className="font-semibold text-navy-900 mb-2">Per IP Address</h3>
                <p className="text-3xl font-bold text-surgical-600 mb-2">100 req/15min</p>
                <p className="text-sm text-slate-600">For security protection</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-6">
              If you exceed rate limits, you'll receive a <code className="px-2 py-1 bg-slate-100 rounded">429 Too Many Requests</code> response.
              Contact sales for higher limits.
            </p>
          </div>
        </section>

        {/* Support CTA */}
        <div className="bg-gradient-to-br from-surgical-50 to-white border border-slate-200 rounded-3xl p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold text-navy-900 mb-4">Need help with integration?</h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            Our team can help you build custom integrations and answer technical questions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/support"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-surgical-600 text-white font-semibold hover:bg-surgical-700 transition-colors"
            >
              Contact Support
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-navy-900 text-navy-900 font-semibold hover:bg-navy-900 hover:text-white transition-colors"
            >
              View Documentation
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
