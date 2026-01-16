import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYSTEM_PROMPT = `You are an expert research agent specializing in verified technical research.

**Your Core Responsibilities:**
1. Conduct thorough research on technical topics
2. Validate information across multiple authoritative sources
3. Provide actionable implementation guides
4. Document all sources with URLs
5. Test code examples for accuracy
6. Synthesize findings into clear recommendations

**Research Process:**
1. Define the research question clearly
2. Identify authoritative sources (official docs, GitHub, verified blogs)
3. Gather information from multiple sources
4. Cross-validate findings
5. Test code examples
6. Synthesize into actionable guide
7. Document all sources

**Source Priority:**
1. Official documentation (highest priority)
2. GitHub official repositories
3. npm/PyPI package documentation
4. MDN Web Docs, W3C specs
5. High-voted Stack Overflow (verify date)
6. Verified technical blogs (check author)

**Quality Standards:**
- Always cite sources with URLs
- Prefer information <2 years old
- Test all code examples
- Cross-reference claims across sources
- Flag outdated or unverified information
- Provide multiple solutions when applicable

**Output Format:**
# Research: [Topic]

## Summary
[2-3 sentence overview]

## Key Findings
1. [Finding with source]
2. [Finding with source]

## Implementation Guide
[Step-by-step with code examples]

## Code Examples
\`\`\`typescript
// Verified working code
\`\`\`

## Recommendations
- [Actionable recommendation]

## Sources
- [Source 1]: [URL]
- [Source 2]: [URL]

**Edge Cases:**
- If sources conflict: Present both views, explain difference
- If information is outdated: Flag it, search for current version
- If no official docs: Use multiple community sources, note uncertainty
- If code examples fail: Debug, fix, or note the issue`;

interface ResearchRequest {
    topic: string;
    context?: string;
    specificQuestions?: string[];
}

async function conductResearch(request: ResearchRequest): Promise<string> {
    const userMessage = `
Research Topic: ${request.topic}

${request.context ? `Context: ${request.context}` : ''}

${request.specificQuestions ? `Specific Questions:\n${request.specificQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}` : ''}

Please conduct thorough research following your process. Focus on:
1. Official documentation and authoritative sources
2. Working code examples
3. Production-ready patterns
4. Current best practices (prefer recent information)

Provide a comprehensive research report with verified sources.
`;

    console.log('🔍 Starting research on:', request.topic);
    console.log('⏳ Analyzing sources and gathering information...\n');

    const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 4000
    });

    return response.choices[0].message.content || 'No research results';
}

async function saveResearch(topic: string, content: string): Promise<void> {
    const researchDir = path.join(__dirname, '../knowledge-base/research');

    // Create directory if it doesn't exist
    if (!fs.existsSync(researchDir)) {
        fs.mkdirSync(researchDir, { recursive: true });
    }

    // Create filename from topic
    const filename = topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const filepath = path.join(researchDir, `${filename}.md`);

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`\n📄 Research saved to: ${filepath}`);
}

async function main() {
    // Example research requests
    const researchRequests: ResearchRequest[] = [
        {
            topic: 'WebSocket Reconnection Strategies in React',
            context: 'Building real-time call monitoring with automatic reconnection',
            specificQuestions: [
                'What are the best practices for WebSocket reconnection?',
                'How to implement exponential backoff?',
                'How to preserve state during reconnection?'
            ]
        },
        {
            topic: 'Vapi Voice Agent Best Practices',
            context: 'Implementing production voice agent system',
            specificQuestions: [
                'How to handle webhook events reliably?',
                'What are common error scenarios?',
                'How to track call outcomes effectively?'
            ]
        },
        {
            topic: 'Supabase RLS Policies for Multi-Tenant Apps',
            context: 'Securing org-scoped data access',
            specificQuestions: [
                'How to implement org-based RLS?',
                'Performance impact of RLS policies?',
                'Testing RLS policies effectively?'
            ]
        }
    ];

    // Run research on first topic (or customize)
    const request = researchRequests[0];

    try {
        const results = await conductResearch(request);
        console.log('\n' + '='.repeat(80));
        console.log('RESEARCH RESULTS');
        console.log('='.repeat(80) + '\n');
        console.log(results);

        // Save research
        await saveResearch(request.topic, results);

        // Optionally save to database
        const { error } = await supabase
            .from('research_reports')
            .insert({
                topic: request.topic,
                content: results,
                created_at: new Date().toISOString()
            });

        if (error && error.code !== '42P01') { // Ignore table doesn't exist error
            console.warn('Note: Could not save to database (table may not exist)');
        }

        console.log('\n✅ Research complete!');

    } catch (error) {
        console.error('❌ Research failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

export { conductResearch, saveResearch };
