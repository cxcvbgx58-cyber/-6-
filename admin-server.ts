import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Pool } from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to fix connection string if it has unencoded special characters in password
function getConnectionString() {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;

  try {
    // If the password contains '?' or other reserved chars, it can break the URL constructor.
    // This is a common issue with Supabase/Neon passwords.
    if (url.includes('?') && !url.includes('?sslmode=')) {
      const parts = url.split('@');
      if (parts.length > 1) {
        const credentials = parts[0];
        if (credentials.includes('?')) {
          url = credentials.replace(/\?/g, '%3F') + '@' + parts.slice(1).join('@');
          console.log('Applied auto-fix for "?" in database password.');
        }
      }
    }
    return url;
  } catch (e) {
    return url;
  }
}

const connectionString = getConnectionString();

if (!connectionString) {
  console.error("CRITICAL: DATABASE_URL is not defined in environment variables.");
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function startServer() {
  const app = express();
  const PORT = process.env.ADMIN_PORT ? parseInt(process.env.ADMIN_PORT) : 3001;

  app.use(express.json());

  // Get all tables in the database
  app.get("/api/tables", async (req, res) => {
    if (!connectionString) return res.status(500).json({ error: "DATABASE_URL is missing" });
    try {
      const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tables" });
    }
  });

  // API Routes
  app.get("/api/users", async (req, res) => {
    if (!connectionString) {
      return res.status(500).json({ 
        error: "DATABASE_URL is missing", 
        details: "Please set DATABASE_URL in the Secrets panel." 
      });
    }
    try {
      // Re-creating the logic to handle UUIDs and joined tables correctly
      const result = await pool.query(`
        SELECT 
          u.*,
          p.plan_tier as subscription_type,
          p.purchase_date as subscription_start,
          p.expiry_date as subscription_end,
          (
            SELECT json_agg(h ORDER BY h.purchase_date DESC)
            FROM premium_purchases h
            WHERE h.user_id = u.id
          ) as subscription_history,
          COALESCE(a.earnings, 0) as referral_income,
          COALESCE(a.clicks, 0) as referral_clicks,
          (
            SELECT COUNT(*)
            FROM referrals r
            WHERE r.referrer_id = u.id
          ) as total_referrals,
          (
            SELECT json_agg(w ORDER BY w.created_at DESC)
            FROM withdrawals w
            WHERE w.user_id = u.id AND w.status = 'pending'
          ) as pending_withdrawals,
          (
            SELECT json_agg(w ORDER BY w.created_at DESC)
            FROM withdrawals w
            WHERE w.user_id = u.id AND w.status = 'completed'
          ) as withdrawal_history
        FROM users u
        LEFT JOIN (
          SELECT DISTINCT ON (user_id) 
            user_id, plan_tier, purchase_date, expiry_date
          FROM premium_purchases
          ORDER BY user_id, purchase_date DESC
        ) p ON u.id = p.user_id
        LEFT JOIN affiliate_stats a ON u.id = a.user_id
        ORDER BY u.created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "Failed to fetch users", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Confirm withdrawal
  app.post("/api/withdrawals/:id/confirm", async (req, res) => {
    const { id } = req.params;
    if (!connectionString) return res.status(500).json({ error: "DATABASE_URL is missing" });
    
    try {
      await pool.query("UPDATE withdrawals SET status = 'completed' WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to confirm withdrawal" });
    }
  });

  // Get table schema
  app.get("/api/schema", async (req, res) => {
    if (!connectionString) {
      return res.status(500).json({ error: "DATABASE_URL is missing" });
    }
    try {
      const result = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schema" });
    }
  });

  // Update user
  app.put("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const { email, username, referral_income, subscription_type, subscription_end } = req.body;
    if (!connectionString) return res.status(500).json({ error: "DATABASE_URL is missing" });

    try {
      // Update users table
      await pool.query(
        "UPDATE users SET email = $1, username = $2 WHERE id = $3",
        [email, username, id]
      );
      
      // Update affiliate stats
      await pool.query(`
        INSERT INTO affiliate_stats (user_id, earnings)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET earnings = EXCLUDED.earnings
      `, [id, referral_income || 0]);

      // Update or insert into premium_purchases for subscription
      if (subscription_type || subscription_end) {
        await pool.query(`
          INSERT INTO premium_purchases (user_id, plan_tier, amount, purchase_date, expiry_date)
          VALUES ($1, $2, 0, NOW(), $3)
        `, [id, subscription_type || 'Premium', subscription_end || null]);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    if (!connectionString) return res.status(500).json({ error: "DATABASE_URL is missing" });
    
    try {
      await pool.query("DELETE FROM users WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Support Chat APIs
  app.get("/api/support/sessions", async (req, res) => {
    if (!connectionString) return res.status(500).json({ error: "DATABASE_URL is missing" });
    try {
      const result = await pool.query(`
        SELECT DISTINCT ON (m.user_id) 
          m.user_id, 
          u.email, 
          u.username,
          m.message as last_message, 
          m.created_at as last_message_at,
          (SELECT COUNT(*) FROM support_messages WHERE user_id = m.user_id AND is_read = false AND sender_role = 'user') as unread_count
        FROM support_messages m
        JOIN users u ON m.user_id = u.id
        ORDER BY m.user_id, m.created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch support sessions" });
    }
  });

  app.get("/api/support/messages/:userId", async (req, res) => {
    const { userId } = req.params;
    const { role } = req.query; // admin or user
    
    if (!connectionString) return res.status(500).json({ error: "DATABASE_URL is missing" });
    try {
      const result = await pool.query(
        "SELECT * FROM support_messages WHERE user_id = $1 ORDER BY created_at ASC",
        [userId]
      );
      
      if (role === 'admin') {
        await pool.query(
          "UPDATE support_messages SET is_read = true WHERE user_id = $1 AND sender_role = 'user'",
          [userId]
        );
      }
      
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/support/messages", async (req, res) => {
    const { userId, message, senderRole } = req.body;
    if (!connectionString) return res.status(500).json({ error: "DATABASE_URL is missing" });
    try {
      const result = await pool.query(
        "INSERT INTO support_messages (user_id, message, sender_role, sender_type) VALUES ($1, $2, $3, $3) RETURNING *",
        [userId, message, senderRole]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Failed to send support message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Note: This serving logic assumes the admin app is built in a specific subfolder or separate dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Admin Server running on http://localhost:${PORT}`);
    
    if (connectionString) {
      try {
        // Fix Schema for Admin panel requirements
        await pool.query(`
          -- Ensure users has activity tracking
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

          -- Create affiliate_stats if missing
          CREATE TABLE IF NOT EXISTS affiliate_stats (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            earnings DECIMAL(20, 2) DEFAULT 0.00,
            clicks INTEGER DEFAULT 0,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          -- Ensure support_messages is correct
          CREATE TABLE IF NOT EXISTS support_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            sender_role VARCHAR(20) DEFAULT 'user',
            sender_type VARCHAR(20) DEFAULT 'user',
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            is_read BOOLEAN DEFAULT false
          );
        `);
        
        // COLUMN VALIDATION LOGS (Helpful for debugging)
        const refCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'referrals'");
        console.log("Referrals table columns:", refCols.rows.map(r => r.column_name).join(", "));
        
        const affCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliate_stats'");
        console.log("Affiliate Stats columns:", affCols.rows.map(r => r.column_name).join(", "));

        console.log("Admin Database schema verified and patched.");
      } catch (e) {
        console.error("Failed to verify database schema on admin startup:", e);
      }
    }
  });
}

startServer();
