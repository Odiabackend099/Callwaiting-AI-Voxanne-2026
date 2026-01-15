import { db, generateEmbedding } from '../setup/integration-setup';

interface ClinicSeedOptions {
  name: string;
  policies?: string[];
}

interface Clinic {
  id: string;
  name: string;
}

/**
 * Create a test clinic with optional policies
 */
export async function seedClinic({
  name,
  policies = [],
}: ClinicSeedOptions): Promise<Clinic> {
  // Create organization
  const { data: org, error: orgError } = await db
    .from('orgs')
    .insert({
      id: crypto.randomUUID(),
      name,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (orgError) {
    throw new Error(`Failed to create clinic: ${orgError.message}`);
  }

  // Insert policies with embeddings
  for (const policy of policies) {
    const embedding = await generateEmbedding(policy);

    const { error: policyError } = await db.from('knowledge_base').insert({
      id: crypto.randomUUID(),
      org_id: org.id,
      content: policy,
      embedding,
      created_at: new Date().toISOString(),
    });

    if (policyError) {
      console.warn(`Failed to insert policy: ${policyError.message}`);
    }
  }

  return {
    id: org.id,
    name: org.name,
  };
}

/**
 * Create a clinic with a single policy
 */
export async function seedClinicWithPolicy(
  name: string,
  policyContent: string
): Promise<{ clinic: Clinic; policy: { id: string; content: string } }> {
  const clinic = await seedClinic({ name, policies: [policyContent] });

  const { data: policies } = await db
    .from('knowledge_base')
    .select('id, content')
    .eq('org_id', clinic.id)
    .single();

  if (!policies) {
    throw new Error('Policy was not created');
  }

  return {
    clinic,
    policy: {
      id: policies.id,
      content: policies.content,
    },
  };
}

/**
 * Get all policies for a clinic
 */
export async function getClinicPolicies(
  clinicId: string
): Promise<{ id: string; content: string; embedding?: number[] }[]> {
  const { data, error } = await db
    .from('knowledge_base')
    .select('id, content, embedding')
    .eq('org_id', clinicId);

  if (error) {
    throw new Error(`Failed to fetch policies: ${error.message}`);
  }

  return data || [];
}

/**
 * Delete all test clinics (cleanup)
 */
export async function deleteAllTestClinics(): Promise<void> {
  await db.from('knowledge_base').delete().neq('id', '');
  await db.from('orgs').delete().neq('id', '');
}
