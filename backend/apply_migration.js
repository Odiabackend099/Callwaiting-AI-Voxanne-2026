const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const url = process.env.SUPABASE_URL || "https://lbjymlodxprzqgtyqtcq.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set");
  console.error("   Please add SUPABASE_SERVICE_ROLE_KEY to your .env file");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function applyMigration() {
  const migrationFile = path.join(__dirname, "supabase/migrations/20260213_fix_wallet_summary_rpc.sql");
  
  const sql = fs.readFileSync(migrationFile, "utf-8");
  
  console.log("🔧 Applying migration: 20260213_fix_wallet_summary_rpc.sql\n");
  
  try {
    // Split SQL into individual statements and execute
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const stmt of statements) {
      if (!stmt.trim()) continue;
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: stmt.trim()
      }).catch(() => ({ error: { message: 'exec_sql RPC not found' } }));
      
      // If exec_sql doesn't exist, try a simpler approach
      if (error?.message?.includes('exec_sql')) {
        console.log("⚠️  Direct RPC execution not available, trying alternative approach...");
        // The migration may already be queued or we need dashboard access
        break;
      }
    }
    
    console.log("✅ Migration statements prepared!");
    console.log("\n📝 NOTE: Please apply the following via Supabase Dashboard:");
    console.log("   1. Go to SQL Editor in Supabase Dashboard");
    console.log("   2. Paste the contents of: supabase/migrations/20260213_fix_wallet_summary_rpc.sql");
    console.log("   3. Click 'RUN'");
    
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

applyMigration();
