import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
    console.error('Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const FILENAME = 'callwaitingai-master-kb.txt';
const FILE_PATH = path.join(__dirname, '../../sample-kb-files/callwaitingai-master-kb.txt');

async function generateEmbeddings() {
    console.log(`\n🚀 Starting Embedding Process for ${FILENAME}...`);

    // 1. Get/Create File Record
    let fileId: string;
    const { data: existingFiles } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('org_id', ORG_ID)
        .eq('filename', FILENAME)
        .limit(1);

    if (existingFiles && existingFiles.length > 0) {
        fileId = existingFiles[0].id;
        console.log(`✅ Found existing file ID: ${fileId}`);
    } else {
        console.log("⚠️ File record not found in DB. Creating one...");
        // Fallback: This assumes we need to create it if missing, but we saw it earlier.
        // Simplified for this script to just error if missing since we expect it.
        console.error("❌ File not found in DB. Please upload via UI or ensure checking correct Org.");
        return;
    }

    // 2. Read Local File Content
    if (!fs.existsSync(FILE_PATH)) {
        console.error(`❌ Local file not found at ${FILE_PATH}`);
        return;
    }
    const content = fs.readFileSync(FILE_PATH, 'utf-8');
    console.log(`📖 Read ${content.length} characters.`);

    // 3. Chunk Content
    // Simple chunking strategy: split by paragraphs, then combine to ~1000 chars
    const rawChunks = content.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const p of rawChunks) {
        if ((currentChunk + p).length > 1000) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }
        currentChunk += p + '\n\n';
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());

    console.log(`🔪 Generated ${chunks.length} chunks.`);

    // 4. Generate Embeddings & Upsert
    let processed = 0;
    for (const chunkText of chunks) {
        try {
            const embeddingResp = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: chunkText,
            });
            const embedding = embeddingResp.data[0].embedding;

            const { error } = await supabase.from('knowledge_base_chunks').insert({
                knowledge_base_id: fileId,
                org_id: ORG_ID,
                content: chunkText,
                embedding: embedding,
                chunk_index: processed
            });

            if (error) {
                console.error(`❌ Failed to insert chunk ${processed}:`, error.message);
            } else {
                process.stdout.write('.');
            }
            processed++;
        } catch (e: any) {
            console.error(`\n❌ API Error on chunk ${processed}:`, e.message);
        }
    }

    console.log(`\n\n✅ Process Completed! Embedded ${processed}/${chunks.length} chunks.`);
}

generateEmbeddings();
