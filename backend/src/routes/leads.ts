import express, { Request, Response } from 'express';

export const leadsRouter = express.Router();

type InMemoryLead = {
  id: string;
  phone: string;
  name?: string | null;
  company?: string | null;
  city?: string | null;
  email?: string | null;
  status: 'pending' | 'called' | 'interested' | 'not_interested';
};

let inMemoryLeads: InMemoryLead[] = [];

function setGlobalLeads(next: InMemoryLead[]) {
  (globalThis as any).__VOXANNE_IN_MEMORY_LEADS__ = next;
}

function getGlobalLeads(): InMemoryLead[] {
  return ((globalThis as any).__VOXANNE_IN_MEMORY_LEADS__ as InMemoryLead[]) || inMemoryLeads;
}

leadsRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json(getGlobalLeads());
});

// Validate and return CSV leads (no database operations)
leadsRouter.post('/bulk', async (req: Request, res: Response): Promise<void> => {
  try {
    const leads = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      res.status(400).json({
        error: 'Invalid payload: must be a non-empty array of leads'
      });
      return;
    }

    // Validate each lead has required phone field
    const validated = leads.filter(lead => {
      if (!lead.phone || typeof lead.phone !== 'string') {
        return false;
      }
      return true;
    });

    if (validated.length === 0) {
      res.status(400).json({
        error: 'No valid leads with phone numbers found'
      });
      return;
    }

    // Return validated leads with IDs for frontend state management
    const leadsWithIds = validated.map((lead, idx) => ({
      id: `temp-${Date.now()}-${idx}`,
      phone: lead.phone,
      name: lead.name || null,
      company: lead.company || null,
      city: lead.city || null,
      email: lead.email || null,
      status: 'pending' as const
    }));

    inMemoryLeads = leadsWithIds;
    setGlobalLeads(leadsWithIds);

    res.status(200).json({
      imported: leadsWithIds.length,
      duplicates: [],
      leads: leadsWithIds
    });
  } catch (err: any) {
    console.error('Error in POST /leads/bulk:', err.message);
    res.status(500).json({
      error: err.message || 'Failed to validate leads'
    });
  }
});

export default leadsRouter;
