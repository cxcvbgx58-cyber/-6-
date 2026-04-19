import pg from 'pg';

const { Pool } = pg;

// Use lazy initialization for the pool to avoid crashing if DATABASE_URL is missing on startup
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    let connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('DATABASE_URL is missing. Using empty pool mock to avoid immediate crash.');
      // Return a dummy pool if no URL, to let the application start but fail on actual queries
      pool = new Pool(); 
      return pool;
    }

    // Basic validation and common fix for unencoded special characters in passwords
    try {
      new URL(connectionString);
    } catch (e) {
      console.warn('DATABASE_URL appears to be malformed. Attempting to fix unencoded characters...');
      // If the password contains '?' or other reserved chars, it can break the URL constructor.
      // This is a common issue with Supabase/Neon passwords.
      if (connectionString.includes('?') && !connectionString.includes('?sslmode=')) {
        // Naive fix: encode '?' if it looks like it's in the password section
        const parts = connectionString.split('@');
        if (parts.length > 1) {
          const credentials = parts[0];
          if (credentials.includes('?')) {
            connectionString = credentials.replace(/\?/g, '%3F') + '@' + parts.slice(1).join('@');
            console.log('Applied auto-fix for "?" in database password.');
          }
        }
      }
    }

    console.log('Initializing database pool...');
    try {
      pool = new Pool({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : {
          rejectUnauthorized: false
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      
      // Verification log
      pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
      });
    } catch (err) {
      console.error('CRITICAL: Failed to create database pool instance:', err);
      pool = new Pool();
    }
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await getPool().query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

export async function initializeDatabase() {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const schemaPath = path.join(__dirname, '../../schema.sql');

  if (fs.existsSync(schemaPath)) {
    console.log('Initializing database with schema...');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    try {
      await query(schema);
      console.log('Base schema applied.');
    } catch (error) {
      console.warn('Base schema application had warnings/errors (might be fine if tables exist):', error instanceof Error ? error.message : error);
    }

    // Migration: Add missing columns to users table if they don't exist
    const columnsToAdd = [
      { name: 'password', type: 'TEXT' },
      { name: 'username', type: 'TEXT' },
      { name: 'subscription_tier', type: 'TEXT', default: "'free'" },
      { name: 'avatar_tier', type: 'TEXT', default: "'free'" },
      { name: 'premium_end_date', type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'telegram_payment_charge_id', type: 'TEXT' },
      { name: 'telegram_id', type: 'BIGINT UNIQUE' },
      { name: 'telegram_username', type: 'TEXT' },
      { name: 'telegram_first_name', type: 'TEXT' },
      { name: 'balance', type: 'DECIMAL(20, 2)', default: '1000.00' },
      { name: 'role', type: 'TEXT', default: "'user'" },
      { name: 'referrer_id', type: 'UUID REFERENCES users(id) ON DELETE SET NULL' },
      { name: 'support_message', type: 'TEXT' }
    ];

    for (const col of columnsToAdd) {
      try {
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} ${col.default ? `DEFAULT ${col.default}` : ''}`);
      } catch (e) {
        console.log(`Column ${col.name} might already exist or error:`, e instanceof Error ? e.message : e);
      }
    }

    // Ensure new tables exist
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS premium_purchases (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          plan_tier TEXT NOT NULL,
          amount DECIMAL(20, 2) NOT NULL,
          purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expiry_date TIMESTAMP WITH TIME ZONE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS referrals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
          referred_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          status TEXT DEFAULT 'unpaid',
          commission_amount DECIMAL(20, 2) DEFAULT 0.00,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(referred_user_id)
        );
        CREATE TABLE IF NOT EXISTS support_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          message TEXT NOT NULL,
          sender_type TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS positions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          symbol TEXT NOT NULL,
          exchange TEXT NOT NULL,
          market TEXT NOT NULL,
          side TEXT NOT NULL,
          entry_price DECIMAL(20, 10) NOT NULL,
          liquidation_price DECIMAL(20, 10) NOT NULL,
          take_profit DECIMAL(20, 10),
          stop_loss DECIMAL(20, 10),
          amount DECIMAL(20, 2) NOT NULL,
          leverage INTEGER DEFAULT 1,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS pending_orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          symbol TEXT NOT NULL,
          exchange TEXT NOT NULL,
          market TEXT NOT NULL,
          side TEXT NOT NULL,
          limit_price DECIMAL(20, 10) NOT NULL,
          initial_price DECIMAL(20, 10) NOT NULL,
          amount DECIMAL(20, 2) NOT NULL,
          leverage INTEGER DEFAULT 1,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          settings JSONB NOT NULL DEFAULT '{}',
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          symbol TEXT NOT NULL,
          price DECIMAL(20, 10) NOT NULL,
          type TEXT NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS withdrawals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(20, 2) NOT NULL,
          address TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {
      console.warn('Error creating additional tables:', e instanceof Error ? e.message : e);
    }

    // Ensure sender_role and sender_type exist in support_messages
    try {
      await query("ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS sender_role TEXT DEFAULT 'user'");
      await query("ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS sender_type TEXT DEFAULT 'user'");
      await query("ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false");
    } catch (e) {
      console.log('Error adding columns to support_messages:', e instanceof Error ? e.message : e);
    }

    console.log('Database initialized and migrated successfully.');

    // Apply Russian comments to columns
    try {
      await query(`
        COMMENT ON COLUMN users.id IS 'Уникальный идентификатор пользователя';
        COMMENT ON COLUMN users.email IS 'Электронная почта';
        COMMENT ON COLUMN users.password IS 'Пароль (хэш)';
        COMMENT ON COLUMN users.username IS 'Имя пользователя';
        COMMENT ON COLUMN users.subscription_tier IS 'Уровень подписки: free, pro, whale';
        COMMENT ON COLUMN users.avatar_tier IS 'Тип рамки аватара';
        COMMENT ON COLUMN users.premium_end_date IS 'Дата окончания премиум-подписки';
        COMMENT ON COLUMN users.balance IS 'Баланс для демо-трейдинга';
        COMMENT ON COLUMN users.role IS 'Роль: пользователь или админ';
        COMMENT ON COLUMN users.referrer_id IS 'ID того, кто пригласил пользователя';
        COMMENT ON COLUMN users.created_at IS 'Дата и время регистрации';
        
        COMMENT ON COLUMN withdrawals.id IS 'ID заявки на вывод';
        COMMENT ON COLUMN withdrawals.user_id IS 'ID пользователя';
        COMMENT ON COLUMN withdrawals.amount IS 'Сумма вывода';
        COMMENT ON COLUMN withdrawals.address IS 'Адрес кошелька';
        COMMENT ON COLUMN withdrawals.status IS 'Статус заявки (pending, completed, rejected)';
        COMMENT ON COLUMN withdrawals.created_at IS 'Дата создания заявки';
      `);
      console.log('Russian column comments applied to database.');
    } catch (e) {
      console.warn('Error applying column comments:', e instanceof Error ? e.message : e);
    }
  } else {
    console.warn('schema.sql not found, skipping initialization.');
  }
}
