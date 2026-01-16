/**
 * Seed Knowledge Base Script
 * Reads markdown files from /knowledge-base directory and inserts them into Supabase
 *
 * Usage: npx ts-node backend/scripts/seed-knowledge-base.ts
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define category mappings based on filename patterns
const categoryMap: { [key: string]: string } = {
  '00-master-system-prompt': 'ai_guidelines',
  '01-company-overview': 'company_info',
  '02-contact-legal-compliance': 'compliance_legal',
  '03-products-services': 'products_services',
  '04-features': 'features',
  '05-pricing-plans': 'pricing',
  '06-onboarding-operations': 'operations',
  '07-team-leadership': 'team',
  '08-ai-best-practices': 'ai_guidelines',
  '09-dashboard-config': 'dashboard_config'
};

interface KnowledgeBaseFile {
  filename: string;
  category: string;
  content: string;
}

async function getOrganizationId(): Promise<string> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error('No organization found. Please create one first.');
    process.exit(1);
  }

  return data[0].id;
}

async function readKnowledgeBaseFiles(): Promise<KnowledgeBaseFile[]> {
  const kbDir = path.join(__dirname, '../../knowledge-base');

  if (!fs.existsSync(kbDir)) {
    console.error(`Knowledge base directory not found: ${kbDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.md'));

  const kbFiles: KnowledgeBaseFile[] = [];

  for (const file of files) {
    const filePath = path.join(kbDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract category from filename
    const basename = path.basename(file, '.md');
    let category = 'ai_guidelines'; // Default category

    for (const [pattern, cat] of Object.entries(categoryMap)) {
      if (basename.includes(pattern)) {
        category = cat;
        break;
      }
    }

    kbFiles.push({
      filename: basename,
      category,
      content
    });
  }

  return kbFiles;
}

async function deleteExistingKnowledgeBase(orgId: string): Promise<void> {
  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('org_id', orgId);

  if (error) {
    console.error('Warning: Could not delete existing knowledge bases:', error);
    // Don't exit, continue anyway
  }
}

async function seedKnowledgeBase(orgId: string, files: KnowledgeBaseFile[]): Promise<void> {
  console.log(`Seeding ${files.length} knowledge base documents for organization: ${orgId}`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    try {
      console.log(`\nSeeding: ${file.filename} (${file.category})`);

      const { data, error } = await supabase
        .from('knowledge_base')
        .insert([
          {
            org_id: orgId,
            filename: file.filename,
            content: file.content,
            category: file.category,
            version: 1,
            active: true,
            metadata: {
              source: 'seeded',
              seeded_at: new Date().toISOString()
            }
          }
        ])
        .select();

      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`  ✅ Successfully seeded (ID: ${data?.[0]?.id})`);
        successCount++;

        // Log in changelog
        await supabase
          .from('knowledge_base_changelog')
          .insert([
            {
              knowledge_base_id: data?.[0]?.id,
              org_id: orgId,
              version_from: null,
              version_to: 1,
              change_type: 'created',
              changed_by: 'system',
              change_summary: `Auto-seeded: ${file.filename}`,
              previous_content: null,
              new_content: file.content
            }
          ]);
      }
    } catch (error) {
      console.error(`  ❌ Exception: ${error}`);
      errorCount++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Seeding complete:`);
  console.log(`  ✅ Successfully seeded: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`${'='.repeat(50)}`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  try {
    console.log('Starting Knowledge Base Seeding...\n');

    // Get organization ID
    const orgId = await getOrganizationId();
    console.log(`Using organization: ${orgId}\n`);

    // Read knowledge base files
    const files = await readKnowledgeBaseFiles();
    console.log(`Found ${files.length} knowledge base files\n`);

    // Optional: Delete existing
    const shouldDelete = process.argv.includes('--delete');
    if (shouldDelete) {
      console.log('Deleting existing knowledge bases...');
      await deleteExistingKnowledgeBase(orgId);
      console.log('Deleted.\n');
    }

    // Seed knowledge bases
    await seedKnowledgeBase(orgId, files);

    console.log('\n✅ Knowledge Base seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error during seeding:', error);
    process.exit(1);
  }
}

// Run the seeding script
main();
