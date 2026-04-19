-- SQL Schema for Smarteye Screener
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    username TEXT,
    subscription_tier TEXT DEFAULT 'free',
    avatar_tier TEXT DEFAULT 'free',
    premium_end_date TIMESTAMP WITH TIME ZONE,
    telegram_id BIGINT UNIQUE,
    telegram_username TEXT,
    telegram_first_name TEXT,
    balance DECIMAL(20, 2) DEFAULT 1000.00,
    role TEXT DEFAULT 'user',
    referrer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Comments for users table columns (Russian translations)
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

-- Affiliate Stats (Clicks and earnings)
CREATE TABLE IF NOT EXISTS affiliate_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    earnings DECIMAL(20, 2) DEFAULT 0.00,
    clicks INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Premium Purchases History
CREATE TABLE IF NOT EXISTS premium_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_tier TEXT NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    telegram_payment_charge_id TEXT,
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'unpaid', -- 'unpaid', 'paid'
    commission_amount DECIMAL(20, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referred_user_id)
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    price DECIMAL(20, 10) NOT NULL,
    type TEXT NOT NULL, -- 'above' or 'below'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trades table (Simulator history)
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL, -- 'LONG' or 'SHORT'
    entry_price DECIMAL(20, 10) NOT NULL,
    exit_price DECIMAL(20, 10) NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    leverage INTEGER DEFAULT 1,
    pnl DECIMAL(20, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Active Positions table
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    market TEXT NOT NULL, -- 'SPOT' or 'FUTURES'
    side TEXT NOT NULL, -- 'LONG' or 'SHORT'
    entry_price DECIMAL(20, 10) NOT NULL,
    liquidation_price DECIMAL(20, 10) NOT NULL,
    take_profit DECIMAL(20, 10),
    stop_loss DECIMAL(20, 10),
    amount DECIMAL(20, 2) NOT NULL,
    leverage INTEGER DEFAULT 1,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pending Orders table
CREATE TABLE IF NOT EXISTS pending_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    market TEXT NOT NULL, -- 'SPOT' or 'FUTURES'
    side TEXT NOT NULL, -- 'LONG' or 'SHORT'
    limit_price DECIMAL(20, 10) NOT NULL,
    initial_price DECIMAL(20, 10) NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    leverage INTEGER DEFAULT 1,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(20, 2) NOT NULL,
    address TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Support Messages table
CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    sender_type TEXT NOT NULL, -- 'user' or 'admin'
    sender_role TEXT DEFAULT 'user', -- For broader system compatibility
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN support_messages.id IS 'ID сообщения';
COMMENT ON COLUMN support_messages.user_id IS 'ID пользователя';
COMMENT ON COLUMN support_messages.message IS 'Текст сообщения';
COMMENT ON COLUMN support_messages.sender_type IS 'Тип отправителя: user или admin';
COMMENT ON COLUMN support_messages.created_at IS 'Дата отправки';

COMMENT ON COLUMN withdrawals.id IS 'ID заявки на вывод';
COMMENT ON COLUMN withdrawals.user_id IS 'ID пользователя';
COMMENT ON COLUMN withdrawals.amount IS 'Сумма вывода';
COMMENT ON COLUMN withdrawals.address IS 'Адрес кошелька';
COMMENT ON COLUMN withdrawals.status IS 'Статус заявки (pending, completed, rejected)';
COMMENT ON COLUMN withdrawals.created_at IS 'Дата создания заявки';
