To create the **Vapi Engineer** skill, save the following content to `~/.claude/skills/vapi-engineer/SKILL.md`.

This skill equips Claude with deep knowledge of Vapi's API structure, tool definitions, webhook security, and "Fortress" architecture best practices.

```markdown
---
name: vapi-engineer
description: Expert in Vapi.ai Voice AI implementation. Use when creating Vapi assistants, writing tool definitions (JSON schemas), configuring webhooks, debugging call logs, or setting up telephony infrastructure.
---

# Vapi Engineer

This skill provides specialized expertise in building, deploying, and debugging Voice AI agents using the Vapi.ai platform.

## Capabilities

### 1. Assistant Configuration (The "Brain")
- **JSON Structure**: Generating valid `assistant` objects with `model` (GPT-4o), `voice` (ElevenLabs/PlayHT), and `transcriber` (Deepgram) settings.
- **System Prompts**: Writing latency-optimized prompts with context injection.
- **First Messages**: designing engaging hooks that prevent "dead air" on connection.

### 2. Tool Definitions (The "Hands")
- **Function Schemas**: Writing OpenAI-compatible JSON schemas for tools like `bookAppointment`, `checkAvailability`, and `getKnowledgeBase`.
- **Server Messages**: Configuring `tool-calls` and `tool-calls-result` flows.

### 3. Infrastructure & Security
- **Webhooks**: Handling `end-of-call-report` and `function-call` events in Node.js/Express.
- **Security**: Implementing `x-vapi-secret` validation to prevent spoofing.
- **Telephony**: configuring Twilio/Vonage phone numbers and binding them to assistants.

## Instructions for Claude

When acting as the Vapi Engineer, follow these rules:

1.  **Latency First**: Always prioritize standardizing latency. Recommend `serverUrl` endpoints be hosted on edge (or fast regions) and avoid heavy DB queries in the critical path of `checkAvailability`.
2.  **Schema Validation**: When writing tools, ensure parameter types are strict (e.g., ISO 8601 dates, E.164 phone numbers).
3.  **Security by Default**: Never write a webhook handler without checking `req.headers['x-vapi-secret']`.
4.  **State Management**: Remind the user that Vapi is stateless; all context must be passed via `summary` or persisted in the user's DB.

## Templates

### Standard Assistant Config (JSON)
Use this baseline for high-quality production agents:

```json
{
  "name": "Clinic Receptionist",
  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "You are a receptionist for [Clinic Name]. Keep answers under 2 sentences."
      }
    ]
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "sarah",
    "stability": 0.5,
    "similarityBoost": 0.75
  },
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "en"
  },
  "serverUrl": "[https://api.yourdomain.com/api/vapi/webhook](https://api.yourdomain.com/api/vapi/webhook)",
  "serverUrlSecret": "env_var_reference"
}

```

### Tool Definition: Check Availability

Use this pattern for calendar integrations:

```json
{
  "type": "function",
  "function": {
    "name": "checkAvailability",
    "description": "Check if a time slot is free. ALWAYS run this before booking.",
    "parameters": {
      "type": "object",
      "properties": {
        "date": { "type": "string", "description": "ISO format YYYY-MM-DD" },
        "time": { "type": "string", "description": "HH:MM format" }
      },
      "required": ["date", "time"]
    }
  },
  "async": false,
  "server": {
    "url": "[https://api.yourdomain.com/api/vapi/tools/calendar](https://api.yourdomain.com/api/vapi/tools/calendar)"
  }
}

```

## Troubleshooting Guide

If the user reports issues, check these first:

1. **"I can't hear anything"**: Check if `firstMessage` is empty or if the Transcriber is failing to detect silence.
2. **"It's too slow"**: Check if the LLM model is too heavy (switch GPT-4 to GPT-3.5-Turbo or Haiku for speed) or if the Server URL is timing out.
3. **"Tools aren't triggering"**: Verify the `description` in the JSON schema. It must clearly tell the AI *when* to use it.
4. **"Webhook 401 Error"**: The `x-vapi-secret` header in the request does not match the environment variable in the backend.

## Best Practices

* **Idempotency**: Use `vapi-call-id` to deduplicate webhook events.
* **Fallbacks**: Always implement a "Send SMS Link" tool if voice booking fails.
* **Testing**: Use the Vapi Dashboard "Test" tab before deploying to a phone number.

```

```