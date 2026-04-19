import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import jwt from "jsonwebtoken";
import TelegramBot from 'node-telegram-bot-api';
import { query, initializeDatabase } from "./src/lib/db.ts";
import { MarketType, ExchangeConfig, SYMBOLS, getConfigsForMarket } from "./models/index.ts";
import { ServerSmarteyeEngine } from "./src/lib/server-engine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Telegram Bot Setup
const DEFAULT_BOT_TOKEN = '8277095257:AAG_5Xw_pLGQNqOH27guqfuNQ3fJV9OCbn0';
const botToken = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;

if (botToken === DEFAULT_BOT_TOKEN) {
  console.warn('WARNING: Using default/public Telegram Bot Token. For production, set TELEGRAM_BOT_TOKEN in your environment secrets.');
}

const bot = new TelegramBot(botToken, { polling: true });

// Handle polling errors, specifically the 409 Conflict error which is common during dev server restarts
bot.on('polling_error', (error: any) => {
  if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
    console.warn('[Bot] Polling conflict (409). This usually happens when the dev server restarts and the previous instance is still active. Polling will automatically resume shortly.');
  } else {
    console.error('[Bot] Polling Error:', error.message || error);
  }
});

// Graceful shutdown to stop polling and prevent 409 conflicts on restart
const cleanup = async () => {
  console.log('Shutting down Telegram bot...');
  try {
    await bot.stopPolling();
    console.log('Telegram bot polling stopped.');
  } catch (err) {
    console.error('Error stopping Telegram bot polling:', err);
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

bot.getMe().then(me => {
  console.log(`Telegram Bot started successfully: @${me.username}`);
}).catch(err => {
  console.error('FAILED to start Telegram Bot. Check your TELEGRAM_BOT_TOKEN:', err.message);
});

// UUID validation helper
const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const PLAN_PRICES: Record<string, number> = {
  '1month': 100,
  '3months': 250,
  '1year': 900
};

const PLAN_LABELS: Record<string, string> = {
  '1month': 'Smarteye Pro (1 месяц)',
  '3months': 'Smarteye Pro (3 месяца)',
  '1year': 'Smarteye Whale (1 год)'
};

// Helper to send menu/welcome message
const sendWelcomeMessage = (chatId: number) => {
  bot.sendMessage(chatId, 'Добро пожаловать в Smarteye Скринер! 🚀\n\nЗдесь вы можете приобрести подписку для доступа к профессиональным инструментам анализа криптовалютного рынка.', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '💎 Купить подписку (Stars)',
            callback_data: 'buy_subscription'
          }
        ]
      ]
    }
  }).catch(e => console.error('Error sending welcome message:', e));
};

// Main message handler to catch both commands and plain text
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.toLowerCase() || '';
  const telegramId = msg.from?.id;
  const telegramUsername = msg.from?.username;
  const telegramFirstName = msg.from?.first_name;

  console.log(`[Bot] Received message from ${telegramId} (@${telegramUsername}): "${text}"`);

  // Handle /start with potential deep link payload
  if (text.startsWith('/start')) {
    const payload = text.split(' ')[1];
    
    if (payload && payload.startsWith('pay_')) {
      const parts = payload.split('_');
      const userId = parts[1];
      const plan = parts[2] || '1month';

      console.log(`[Bot] Processing payment deep link: User=${userId}, Plan=${plan}`);

      // Link account
      if (userId && telegramId && isUUID(userId)) {
        try {
          await query(
            "UPDATE users SET telegram_id = $1, telegram_username = $2, telegram_first_name = $3 WHERE id = $4 AND (telegram_id IS NULL OR telegram_id = $1)",
            [telegramId, telegramUsername, telegramFirstName, userId]
          );
        } catch (e) {
          console.error("Error linking telegram account:", e);
        }
      }

      if (PLAN_PRICES[plan]) {
        bot.sendInvoice(
          chatId,
          PLAN_LABELS[plan],
          `Оплата подписки для пользователя ${userId}. Доступ к профессиональным инструментам анализа рынка.`,
          `payload_${userId}_${plan}`,
          '', // Empty for Stars
          'XTR', // Stars currency
          [{ label: PLAN_LABELS[plan], amount: PLAN_PRICES[plan] }]
        ).catch(err => {
          console.error('[Bot] Error sending invoice:', err.message);
          bot.sendMessage(chatId, `❌ Ошибка при создании счета: ${err.message}\n\nПожалуйста, убедитесь, что в боте включены платежи (Telegram Stars).`);
        });
        return;
      }
    }
  }

  // Handle plain keywords or /start without payload
  const keywords = ['/start', 'старт', 'start', 'оплата', 'меню', 'menu', 'привет', 'hi'];
  if (keywords.some(k => text.includes(k))) {
    sendWelcomeMessage(chatId);
  }
});

bot.on('callback_query', async (query_data) => {
  const chatId = query_data.message?.chat.id;
  const telegramId = query_data.from?.id;

  if (query_data.data === 'buy_subscription' && chatId) {
    // Try to find user by telegramId to personalize or check status
    let userId = 'unknown';
    if (telegramId) {
      const userResult = await query("SELECT id FROM users WHERE telegram_id = $1", [telegramId]);
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }

    bot.sendInvoice(
      chatId,
      'Подписка Smarteye Pro',
      'Доступ к скринеру плотностей, AI-аналитике и продвинутым графикам на 1 месяц.',
      `payload_${userId}_1month`,
      '', // Provider token is empty for Telegram Stars
      'XTR', // Currency for Telegram Stars
      [
        { label: 'Smarteye Pro (1 месяц)', amount: 100 } // Amount in Stars
      ]
    ).catch(err => {
      console.error('Error sending invoice:', err);
      bot.sendMessage(chatId, 'Ошибка при создании счета. Пожалуйста, попробуйте позже.');
    });
  }
});

bot.on('pre_checkout_query', (query_data) => {
  bot.answerPreCheckoutQuery(query_data.id, true);
});

bot.on('successful_payment', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id;
  const paymentPayload = msg.successful_payment?.invoice_payload;
  const telegramChargeId = msg.successful_payment?.telegram_payment_charge_id;
  
  if (paymentPayload && paymentPayload.startsWith('payload_')) {
    const parts = paymentPayload.split('_');
    let userId = parts[1];
    const plan = parts[2];

    // If userId is unknown, try to find it by telegramId
    if (userId === 'unknown' && telegramId) {
      const userResult = await query("SELECT id FROM users WHERE telegram_id = $1", [telegramId]);
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
      }
    }

    if (userId !== 'unknown' && PLAN_PRICES[plan]) {
      try {
        const months = plan === '1month' ? 1 : plan === '3months' ? 3 : 12;
        const planTier = plan === '1year' ? 'whale' : 'pro';
        
        let targetUserId = userId;
        
        // If not UUID, we must find the user by telegramId
        if (!isUUID(targetUserId) && telegramId) {
          const userResult = await query("SELECT id FROM users WHERE telegram_id = $1", [telegramId]);
          if (userResult.rows.length > 0) {
            targetUserId = userResult.rows[0].id;
          } else {
            console.error(`Could not fulfill payment: No user linked to Telegram ID ${telegramId} and payload userId ${userId} is not a UUID`);
            bot.sendMessage(chatId, '❌ Ошибка: Не удалось найти пользователя для активации подписки. Пожалуйста, убедитесь, что вы авторизованы в терминале.');
            return;
          }
        }

        const expiryDate = new Date();
        const userResult = await query("SELECT premium_end_date FROM users WHERE id = $1", [targetUserId]);
        if (userResult.rows.length === 0) {
           console.error(`User ${targetUserId} not found in database for payment fulfillment`);
           bot.sendMessage(chatId, '❌ Ошибка: Пользователь не найден.');
           return;
        }

        let currentExpiry = userResult.rows[0]?.premium_end_date;
        let startDate = new Date();
        
        if (currentExpiry && new Date(currentExpiry) > new Date()) {
          startDate = new Date(currentExpiry);
        }
        
        const newExpiryDate = new Date(startDate);
        newExpiryDate.setMonth(newExpiryDate.getMonth() + months);
        
        const avatarTier = plan;

        // Update user in DB
        await query(
          "UPDATE users SET subscription_tier = $1, premium_end_date = $2, avatar_tier = $3, telegram_id = COALESCE(telegram_id, $4) WHERE id = $5",
          [planTier, newExpiryDate, avatarTier, telegramId, targetUserId]
        );

        // Record purchase
        await query(
          "INSERT INTO premium_purchases (user_id, plan_tier, amount, expiry_date, telegram_payment_charge_id) VALUES ($1, $2, $3, $4, $5)",
          [targetUserId, planTier, PLAN_PRICES[plan], newExpiryDate, telegramChargeId]
        );

        console.log(`Successfully activated subscription ${plan} for user ${targetUserId}`);
        bot.sendMessage(chatId, `✨ Оплата прошла успешно! Подписка ${PLAN_LABELS[plan]} активирована до ${newExpiryDate.toLocaleDateString()}.\n\nОбновите страницу в терминале, чтобы изменения вступили в силу.`);
        return;
      } catch (error) {
        console.error('Failed to update subscription after Telegram payment:', error);
        bot.sendMessage(chatId, '❌ Произошла ошибка при активации подписки. Пожалуйста, напишите в поддержку.');
      }
    }
  }
  
  // Generic success message if path above didn't return
  bot.sendMessage(chatId, '✨ Оплата прошла успешно! Если подписка не обновилась в течение нескольких минут, пожалуйста, обратитесь в поддержку.');
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize DB
  try {
    await initializeDatabase();
  } catch (error) {
    console.error("Failed to initialize database:", error);
    // Don't exit, maybe it's already initialized or connection is just slow
  }

  // Ensure public/logos directory exists
  const logosDir = path.join(__dirname, "public", "logos");
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
  }

  // Logo Proxy Route
  app.get("/api/logos/:symbol", async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    
    // 1. Check if logo exists locally (try svg then png)
    const extensions = ["svg", "png", "jpg", "jpeg"];
    for (const ext of extensions) {
      const filePath = path.join(logosDir, `${symbol}.${ext}`);
      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }
    }

    // 2. Try to fetch and save (JIT)
    const sources = [
      { url: `https://bin.bnbstatic.com/static/assets/logos/${symbol}.png`, ext: "png" },
      { url: `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`, ext: "png" },
      { url: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`, ext: "png" },
      { url: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${symbol}/logo.png`, ext: "png" },
      { url: `https://static.okx.com/cdn/oksupport/asset/currency/icon/${symbol.toLowerCase()}.png`, ext: "png" },
      { url: `https://www.gate.io/images/coin_icon/64/${symbol.toLowerCase()}.png`, ext: "png" }
    ];

    for (const source of sources) {
      try {
        const response = await axios.get(source.url, { responseType: "arraybuffer", timeout: 3000 });
        if (response.status === 200) {
          const savePath = path.join(logosDir, `${symbol}.${source.ext}`);
          fs.writeFileSync(savePath, Buffer.from(response.data));
          return res.sendFile(savePath);
        }
      } catch (error) {
        // Continue to next source
      }
    }

    // 3. Fallback to UI Avatars
    res.redirect(`https://ui-avatars.com/api/?name=${symbol}&background=1a1a1a&color=fff&bold=true&font-size=0.33`);
  });

  // Database Routes
  app.get("/api/db/status", async (req, res) => {
    try {
      await query("SELECT 1");
      res.json({ status: "connected" });
    } catch (error) {
      console.error("Database status check failed:", error);
      res.status(500).json({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  });

  const JWT_SECRET = process.env.JWT_SECRET || "smarteye-secret-key-123";
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "115832245724-723777rcgh8heqtd00nhgi92q885jntk.apps.googleusercontent.com";
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

  app.get("/api/auth/google/url", (req, res) => {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account'
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.json({ url: authUrl });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("Code missing");

    try {
      const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
      
      // Exchange code for tokens
      const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });

      const { access_token, id_token } = tokenResponse.data;

      // Get user info
      const userResponse = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const googleUser = userResponse.data;
      const email = googleUser.email;
      const username = googleUser.name || email.split("@")[0];

      // Check if user exists
      let userResult = await query("SELECT * FROM users WHERE email = $1", [email]);
      let user;

      if (userResult.rows.length === 0) {
        // Create user
        const insertResult = await query(
          "INSERT INTO users (email, username, role) VALUES ($1, $2, $3) RETURNING id, email, username, subscription_tier, avatar_tier, premium_end_date, balance, role, referrer_id, created_at",
          [email, username, 'user']
        );
        user = insertResult.rows[0];
      } else {
        user = userResult.rows[0];
        // Remove password from user object if it exists
        delete user.password;
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

      // Send success message to parent window and close popup
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  payload: { user: ${JSON.stringify(user)}, token: '${token}' } 
                }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Google OAuth error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.post("/api/auth/register", express.json(), async (req, res) => {
    const { email, password, username, referrerId } = req.body;
    try {
      const existing = await query("SELECT * FROM users WHERE email = $1", [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "User already exists" });
      }

      // WARNING: Storing passwords in plain text is highly insecure.
      // This was implemented per user request.
      const result = await query(
        "INSERT INTO users (email, password, username, referrer_id) VALUES ($1, $2, $3, $4) RETURNING id, email, username, subscription_tier, avatar_tier, premium_end_date, balance, role, referrer_id, created_at",
        [email, password, username || email.split("@")[0], referrerId || null]
      );

      const user = result.rows[0];

      // If there's a referrer, create a referral record
      if (referrerId) {
        try {
          await query(
            "INSERT INTO referrals (referrer_id, referred_user_id, status) VALUES ($1, $2, $3) ON CONFLICT (referred_user_id) DO NOTHING",
            [referrerId, user.id, 'unpaid']
          );
        } catch (e) {
          console.error("Failed to create referral record:", e);
        }
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ user, token });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", express.json(), async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await query("SELECT * FROM users WHERE email = $1", [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const user = result.rows[0];
      if (!user.password) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Plain text comparison per user request
      const valid = (password === user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _p, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const result = await query("SELECT id, email, username, subscription_tier, avatar_tier, premium_end_date, balance, role, referrer_id, telegram_id, telegram_username, telegram_first_name, support_message, created_at FROM users WHERE id = $1", [decoded.userId]);
      if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Session check failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Partner Routes
  app.get("/api/partner/premium-history/:userId", async (req, res) => {
    const { userId } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }
    try {
      const result = await query(
        "SELECT * FROM premium_purchases WHERE user_id = $1 ORDER BY purchase_date DESC",
        [userId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching premium history:", error);
      res.status(500).json({ error: "Failed to fetch premium history" });
    }
  });

  app.get("/api/partner/referrals/:userId", async (req, res) => {
    const { userId } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }
    try {
      const result = await query(
        `SELECT r.*, u.email as referred_email, u.username as referred_username, u.created_at as joined_at 
         FROM referrals r 
         JOIN users u ON r.referred_user_id = u.id 
         WHERE r.referrer_id = $1 
         ORDER BY r.created_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ error: "Failed to fetch referrals" });
    }
  });

  app.get("/api/partner/earnings-summary/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      let totalEarnings = 0;
      let totalWithdrawn = 0;
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(userId)) {
        const earningsResult = await query(
          "SELECT SUM(commission_amount) as total_earnings FROM referrals WHERE referrer_id = $1",
          [userId]
        );
        const withdrawalsResult = await query(
          "SELECT SUM(amount) as total_withdrawn FROM withdrawals WHERE user_id = $1 AND status != 'rejected'",
          [userId]
        );
        
        totalEarnings = parseFloat(earningsResult.rows[0].total_earnings || 0);
        totalWithdrawn = parseFloat(withdrawalsResult.rows[0].total_withdrawn || 0);
      }
      
      const welcomeBonus = 25.0; // Welcome bonus for all users
      const response = { 
        total_earnings: Math.max(totalEarnings + welcomeBonus, 25.0),
        total_withdrawn: totalWithdrawn,
        available_balance: Math.max((totalEarnings + welcomeBonus) - totalWithdrawn, 25.0)
      };
      console.log(`Earnings summary for user ${userId}:`, response);
      res.json(response);
    } catch (error) {
      console.error("Error fetching earnings summary:", error);
      res.status(500).json({ error: "Failed to fetch earnings summary" });
    }
  });

  app.post("/api/partner/simulate-purchase", express.json(), async (req, res) => {
    const { userId, planTier, amount, months } = req.body;
    try {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + months);
      
      const result = await query(
        "INSERT INTO premium_purchases (user_id, plan_tier, amount, expiry_date) VALUES ($1, $2, $3, $4) RETURNING *",
        [userId, planTier, amount, expiryDate.toISOString()]
      );
      
      // Update user subscription
      const avatarTier = months === 1 ? '1month' : months === 3 ? '3months' : months === 12 ? '1year' : 'free';
      await query(
        "UPDATE users SET subscription_tier = $1, premium_end_date = $2, avatar_tier = $3 WHERE id = $4",
        [planTier, expiryDate.toISOString(), avatarTier, userId]
      );

      // If user has a referrer, update referral status to 'paid' and add commission
      const userResult = await query("SELECT referrer_id FROM users WHERE id = $1", [userId]);
      const referrerId = userResult.rows[0]?.referrer_id;
      if (referrerId) {
        const commission = amount * 0.2; // 20% commission
        await query(
          "UPDATE referrals SET status = 'paid', commission_amount = commission_amount + $1 WHERE referred_user_id = $2",
          [commission, userId]
        );
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Simulate purchase error:", error);
      res.status(500).json({ error: "Failed to simulate purchase" });
    }
  });

  app.post("/api/partner/withdraw", express.json(), async (req, res) => {
    const { userId, amount, address } = req.body;
    try {
      const result = await query(
        "INSERT INTO withdrawals (user_id, amount, address) VALUES ($1, $2, $3) RETURNING *",
        [userId, amount, address]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Withdrawal error:", error);
      res.status(500).json({ error: "Failed to create withdrawal request" });
    }
  });

  app.post("/api/support/message", express.json(), async (req, res) => {
    const { userId, message, senderType = 'user' } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: "User ID and message are required" });
    }
    try {
      // Use both columns for maximum compatibility
      const result = await query(
        "INSERT INTO support_messages (user_id, message, sender_type, sender_role) VALUES ($1, $2, $3, $3) RETURNING *",
        [userId, message, senderType]
      );

      // Also update the users table's support_message column just in case
      try {
        await query("UPDATE users SET support_message = $1 WHERE id = $2", [message, userId]);
      } catch (e) {
        console.warn("Failed to update user support_message column:", e);
      }

      // Notify via WebSocket if possible
      const targetMessage = result.rows[0];
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1 && client.userId === userId) {
          client.send(JSON.stringify({
            type: "SUPPORT_MESSAGE_RECEIVED",
            message: targetMessage
          }));
        }
      });

      // Auto-reply for demo
      setTimeout(async () => {
        try {
          const autoReplyResult = await query(
            "INSERT INTO support_messages (user_id, message, sender_type, sender_role) VALUES ($1, $2, $3, $3) RETURNING *",
            [userId, "Здравствуйте! Мы получили ваше сообщение и ответим в ближайшее время. Спасибо за обращение!", "admin"]
          );
          const replyMessage = autoReplyResult.rows[0];
          wss.clients.forEach((client: any) => {
            if (client.readyState === 1 && client.userId === userId) {
              client.send(JSON.stringify({
                type: "SUPPORT_MESSAGE_RECEIVED",
                message: replyMessage
              }));
            }
          });
        } catch (e) {
          console.error("Auto-reply error:", e);
        }
      }, 2000);

      res.json(targetMessage);
    } catch (error) {
      console.error("Support message error:", error);
      res.status(500).json({ error: "Failed to send support message" });
    }
  });

  app.get("/api/support/history/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await query(
        "SELECT * FROM support_messages WHERE user_id = $1 ORDER BY created_at ASC",
        [userId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Support history error:", error);
      res.status(500).json({ error: "Failed to fetch support history" });
    }
  });

  app.get("/api/users/:email", async (req, res) => {
    const { email } = req.params;
    try {
      let result = await query("SELECT * FROM users WHERE email = $1", [email]);
      if (result.rows.length === 0) {
        // Create user if not exists
        result = await query(
          "INSERT INTO users (email, username) VALUES ($1, $2) RETURNING *",
          [email, email.split("@")[0]]
        );
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error(`Error fetching/creating user ${email}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/alerts/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await query("SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
      res.json(result.rows);
    } catch (error) {
      console.error(`Error fetching alerts for user ${userId}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/alerts", express.json(), async (req, res) => {
    const { userId, symbol, price, type } = req.body;
    try {
      const result = await query(
        "INSERT INTO alerts (user_id, symbol, price, type) VALUES ($1, $2, $3, $4) RETURNING *",
        [userId, symbol, price, type]
      );
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/alerts/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await query("DELETE FROM alerts WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/trades/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await query("SELECT * FROM trades WHERE user_id = $1 ORDER BY timestamp DESC", [userId]);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/positions/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await query("SELECT * FROM positions WHERE user_id = $1 ORDER BY timestamp DESC", [userId]);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/positions", express.json(), async (req, res) => {
    const { userId, symbol, exchange, market, side, entryPrice, liquidationPrice, takeProfit, stopLoss, amount, leverage } = req.body;
    try {
      const result = await query(
        "INSERT INTO positions (user_id, symbol, exchange, market, side, entry_price, liquidation_price, take_profit, stop_loss, amount, leverage) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
        [userId, symbol, exchange, market, side, entryPrice, liquidationPrice, takeProfit, stopLoss, amount, leverage]
      );
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/positions/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await query("DELETE FROM positions WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/pending-orders/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await query("SELECT * FROM pending_orders WHERE user_id = $1 ORDER BY timestamp DESC", [userId]);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/pending-orders", express.json(), async (req, res) => {
    const { userId, symbol, exchange, market, side, limitPrice, initialPrice, amount, leverage } = req.body;
    try {
      const result = await query(
        "INSERT INTO pending_orders (user_id, symbol, exchange, market, side, limit_price, initial_price, amount, leverage) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
        [userId, symbol, exchange, market, side, limitPrice, initialPrice, amount, leverage]
      );
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/pending-orders/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await query("DELETE FROM pending_orders WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/trades", express.json(), async (req, res) => {
    const { userId, symbol, side, entryPrice, exitPrice, amount, leverage, pnl } = req.body;
    try {
      const result = await query(
        "INSERT INTO trades (user_id, symbol, side, entry_price, exit_price, amount, leverage, pnl) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        [userId, symbol, side, entryPrice, exitPrice, amount, leverage, pnl]
      );
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/settings/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const result = await query("SELECT settings FROM user_settings WHERE user_id = $1", [userId]);
      res.json(result.rows[0] || null);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/settings", express.json(), async (req, res) => {
    const { userId, settings } = req.body;
    try {
      await query(
        "INSERT INTO user_settings (user_id, settings) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET settings = $2, updated_at = CURRENT_TIMESTAMP",
        [userId, settings]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Admin Routes
  app.get("/api/admin/users", async (req, res) => {
    // In a real app, you'd check a JWT token for admin role here
    try {
      const result = await query("SELECT * FROM users ORDER BY created_at DESC");
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/admin/update-user", express.json(), async (req, res) => {
    const { userId, tier, role, avatarTier, premiumEndDate } = req.body;
    try {
      await query(
        "UPDATE users SET subscription_tier = $1, role = $2, avatar_tier = $3, premium_end_date = $4 WHERE id = $5",
        [tier, role, avatarTier || 'free', premiumEndDate || '', userId]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // API Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  // Global pool for exchange connections
  const globalExchangeSockets = new Map<string, WebSocket>();
  // Track which clients want which exchange data
  const exchangeSubscribers = new Map<string, Set<WebSocket>>();
  // Track subscription timers to avoid overlapping bursts
  const bybitSubscriptionTimers = new Map<string, NodeJS.Timeout[]>();
  // Cache for the latest snapshot of each symbol to support new client connections
  const snapshotCache = new Map<string, any>();
  // Track ticker subscriptions
  const tickerSubscribers = new Map<string, Set<WebSocket>>();
  // Track last message time from exchanges to detect stalls
  const lastExchangeMsgTime = new Map<string, number>();
  // Track forced alternative URLs for Binance to bypass regional blocks (451)
  const forcedUrlForConfig = new Map<string, string>();

  // Initialize Global Server Engine
  const serverEngine = new ServerSmarteyeEngine();

  // Periodically broadcast engine results to all connected clients
  setInterval(() => {
    if (wss.clients.size > 0) {
      const payload = JSON.stringify({
        type: "ENGINE_UPDATE",
        longs: serverEngine.longs,
        shorts: serverEngine.shorts
      });
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  }, 1000);

  // Proactively connect to major exchanges on startup to feed the global engine
  const startupConfigs: ExchangeConfig[] = [
    ...getConfigsForMarket('SPOT', 'Binance'),
    ...getConfigsForMarket('FUTURES', 'Binance'),
    ...getConfigsForMarket('SPOT', 'Bybit'),
    ...getConfigsForMarket('FUTURES', 'Bybit')
  ];
  
  startupConfigs.forEach(cfg => {
    // Only fetch if not already in globalExchangeSockets (though here it's empty)
    getExchangeSocket(cfg);
  });

  // Periodically fetch rank mapping to keep the engine ratings accurate
  const fetchRanks = async () => {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false');
      if (response.status === 200) {
        const data = response.data;
        // In the future we might want to pass this to a setRankMap method on serverEngine
        // For now, it primarily helps with UI sorting/filtering if we had that on server.
      }
    } catch (error: any) {
      console.error('[Server Engine] Error fetching ranks:', error.message);
    }
  };
  fetchRanks();
  setInterval(fetchRanks, 60 * 60 * 1000); // Once per hour

  const BINANCE_SPOT_ALTS = [
    'wss://stream.binance.com:9443/ws',
    'wss://data-stream.binance.com/ws',
    'wss://stream.binance.com:443/ws',
    'wss://stream1.binance.com:9443/ws',
    'wss://stream2.binance.com:9443/ws',
    'wss://stream3.binance.com:9443/ws'
  ];
  const BINANCE_FUTURES_ALTS = [
    'wss://fstream.binance.com/ws',
    'wss://fstream.binance.com:443/ws',
    'wss://fstream-auth.binance.com/ws',
    'wss://fstream1.binance.com/ws',
    'wss://fstream2.binance.com/ws',
    'wss://fstream3.binance.com/ws'
  ];

  function getNextBinanceUrl(currentUrl: string, marketType: MarketType): string | null {
    const alts = marketType === 'SPOT' ? BINANCE_SPOT_ALTS : BINANCE_FUTURES_ALTS;
    const currentIndex = alts.indexOf(currentUrl);
    if (currentIndex === -1) return alts[0];
    if (currentIndex + 1 < alts.length) return alts[currentIndex + 1];
    return null; // No more alternatives
  }

  function subscribeToBybit(ws: WebSocket, cfg: any) {
    if (!cfg.symbols || cfg.symbols.length === 0) return;
    
    const configKey = `${cfg.exchange}:${cfg.marketType}`;
    console.log(`[Global WS] Subscribing to Bybit symbols for ${configKey} (Count: ${cfg.symbols.length})`);
    
    // Clear existing timers for this socket to avoid overlapping subscription bursts
    if (bybitSubscriptionTimers.has(configKey)) {
      bybitSubscriptionTimers.get(configKey)?.forEach(t => clearTimeout(t));
    }
    const timers: NodeJS.Timeout[] = [];
    bybitSubscriptionTimers.set(configKey, timers);

    const symbols = cfg.symbols;
    const chunkSize = 10;
    const depth = 50; // Use 50 for both to be safe and consistent
    
    for (let i = 0; i < symbols.length; i += chunkSize) {
      const chunk = symbols.slice(i, i + chunkSize);
      const subMsg = {
        op: 'subscribe',
        args: chunk.map((s: string) => `orderbook.${depth}.${s.toUpperCase()}`),
        req_id: `sub_${Date.now()}_${i}`
      };
      
      const timer = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify(subMsg));
          } catch (e) {
            console.error(`[Global WS] Error sending sub to Bybit:`, e);
          }
        }
      }, (i / chunkSize) * 200); // 200ms between chunks
      timers.push(timer);
    }
  }

  function subscribeTickersBybit(ws: WebSocket, exchange: string, marketType: MarketType, tickers: any[]) {
    if (!tickers || tickers.length === 0) return;
    const subMsg = {
      op: 'subscribe',
      args: tickers.map(t => `tickers.${t.symbol.toUpperCase()}`),
      req_id: `sub_tickers_${Date.now()}`
    };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(subMsg));
    }
  }

  function subscribeToBinance(ws: WebSocket, cfg: any) {
    if (!cfg.subscriptionMessages || cfg.subscriptionMessages.length === 0) return;
    
    const configKey = `${cfg.exchange}:${cfg.marketType}`;
    console.log(`[Global WS] Subscribing to Binance symbols for ${configKey}`);
    
    cfg.subscriptionMessages.forEach((msg: any, i: number) => {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify(msg));
          } catch (e) {
            console.error(`[Global WS] Error sending sub to Binance:`, e);
          }
        }
      }, i * 200);
    });
  }

  function subscribeTickersBinance(ws: WebSocket, exchange: string, marketType: MarketType, tickers: any[]) {
    if (!tickers || tickers.length === 0) return;
    const subMsg = {
      method: "SUBSCRIBE",
      params: tickers.map(t => `${t.symbol.toLowerCase()}@ticker`),
      id: Date.now()
    };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(subMsg));
    }
  }

  function getExchangeSocket(cfg: any) {
    const configKey = `${cfg.exchange}:${cfg.marketType}`;
    
    if (globalExchangeSockets.has(configKey)) {
      const socket = globalExchangeSockets.get(configKey);
      if (socket?.readyState === WebSocket.OPEN) {
        // If already open, we MUST re-subscribe for Bybit to trigger a snapshot for the new client
        // This is critical because the client engine ignores deltas until it gets a snapshot
        if (cfg.exchange.startsWith('Bybit')) {
          subscribeToBybit(socket, cfg);
        } else if (cfg.exchange.startsWith('Binance')) {
          subscribeToBinance(socket, cfg);
        }
        return socket;
      }
      if (socket?.readyState === WebSocket.CONNECTING) {
        return socket;
      }
    }

    console.log(`[Global WS] Creating shared connection for ${configKey} -> ${cfg.wsUrl}`);
    
    let targetUrl = cfg.wsUrl;
    if (cfg.exchange.startsWith('Binance') && forcedUrlForConfig.has(configKey)) {
      targetUrl = forcedUrlForConfig.get(configKey)!;
      console.log(`[Global WS] Using forced alternative URL for ${configKey}: ${targetUrl}`);
    }

    const ws = new WebSocket(targetUrl);
    globalExchangeSockets.set(configKey, ws);
    lastExchangeMsgTime.set(configKey, Date.now());

    // Watchdog for this specific exchange connection
    const exchangeWatchdog = setInterval(() => {
      const lastMsg = lastExchangeMsgTime.get(configKey) || 0;
      if (Date.now() - lastMsg > 15000) {
        console.warn(`[Global WS] Stalled connection detected for ${configKey}. Closing...`);
        ws.terminate();
        clearInterval(exchangeWatchdog);
      }
    }, 5000);

    ws.on("open", () => {
      console.log(`[Global WS] Shared connection OPEN for ${configKey}`);
      if (cfg.exchange.startsWith('Bybit')) {
        subscribeToBybit(ws, cfg);
      } else if (cfg.exchange.startsWith('Binance')) {
        subscribeToBinance(ws, cfg);
      }
    });

    ws.on("message", (data) => {
      lastExchangeMsgTime.set(configKey, Date.now());
      
      try {
        const rawData = data.toString();
        // Filter out control messages to save bandwidth
        if (rawData.includes('"op":"pong"') || rawData.includes('"ret_msg":"pong"')) return;
        if (rawData.includes('"success":true') && rawData.includes('"op":"subscribe"')) return;

        const parsed = JSON.parse(rawData);

        // Feed to global engine for server-side processing
        serverEngine.updateData(cfg.exchange, cfg.marketType, parsed);
        
        const subscribers = exchangeSubscribers.get(configKey);
        const tickers = tickerSubscribers.get(configKey);
        
        if ((subscribers && subscribers.size > 0) || (tickers && tickers.size > 0)) {
          // Determine if this is ticker data
          let isTicker = false;
          if (cfg.exchange.startsWith('Bybit')) {
            isTicker = parsed.topic?.startsWith('tickers');
          } else if (cfg.exchange.startsWith('Binance')) {
            isTicker = parsed.e === '24hrTicker' || (parsed.data && parsed.data.e === '24hrTicker');
          }

          if (isTicker) {
            const message = JSON.stringify({
              type: "EXCHANGE_DATA",
              dataType: "TICKER",
              exchange: cfg.exchange,
              marketType: cfg.marketType,
              data: parsed
            });
            tickers?.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(message);
              }
            });
            return;
          }

          // Cache Bybit snapshots
          if (cfg.exchange.startsWith('Bybit') && parsed.type === 'snapshot' && parsed.topic) {
            snapshotCache.set(`${configKey}:${parsed.topic}`, parsed);
          }
          
          // Cache Binance messages (treat as snapshots for new clients)
          if (cfg.exchange.startsWith('Binance')) {
            const symbol = parsed.s || (parsed.data && parsed.data.s);
            if (symbol) {
              snapshotCache.set(`${configKey}:${symbol.toUpperCase()}`, parsed);
            }
          }

          // Wrap the raw data in our protocol
          const message = JSON.stringify({
            type: "EXCHANGE_DATA",
            dataType: "DEPTH",
            exchange: cfg.exchange,
            marketType: cfg.marketType,
            data: parsed
          });
          
          subscribers?.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        }
      } catch (e) {
        // Ignore malformed JSON or other parsing errors
      }
    });

    ws.on("close", () => {
      console.warn(`[Global WS] Shared connection CLOSED for ${configKey}. Reconnecting in 5s...`);
      globalExchangeSockets.delete(configKey);
      lastExchangeMsgTime.delete(configKey);
      clearInterval(exchangeWatchdog);

      // Notify all subscribers about the disconnect
      const subscribers = exchangeSubscribers.get(configKey);
      if (subscribers && subscribers.size > 0) {
        const disconnectPayload = JSON.stringify({
          type: "EXCHANGE_ERROR",
          exchange: cfg.exchange,
          marketType: cfg.marketType,
          message: "Connection lost to exchange. Reconnecting...",
          isRegionalBlock: false,
          isDisconnected: true
        });
        subscribers.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(disconnectPayload);
          }
        });
      }

      // Clear cache for this exchange on close to avoid stale data
      const prefix = `${configKey}:`;
      for (const key of snapshotCache.keys()) {
        if (key.startsWith(prefix)) snapshotCache.delete(key);
      }

      if (bybitSubscriptionTimers.has(configKey)) {
        bybitSubscriptionTimers.get(configKey)?.forEach(t => clearTimeout(t));
        bybitSubscriptionTimers.delete(configKey);
      }
      
      setTimeout(() => {
        const subs = exchangeSubscribers.get(configKey);
        const isStartupConfig = startupConfigs.some(c => `${c.exchange}:${c.marketType}` === configKey);
        
        if (isStartupConfig || (subs && subs.size > 0)) {
          getExchangeSocket(cfg);
        }
      }, 5000);
    });

    ws.on("error", (err) => {
      const errorMessage = err.message;
      const is451 = errorMessage.includes('451');
      console.error(`[Global WS] Shared connection ERROR for ${configKey}:`, errorMessage);
      
      if (is451 && cfg.exchange.startsWith('Binance')) {
        const currentUrl = ws.url;
        const nextUrl = getNextBinanceUrl(currentUrl, cfg.marketType);
        if (nextUrl) {
          console.warn(`[Global WS] Regional block (451) for ${configKey} at ${currentUrl}. Trying alternative: ${nextUrl}`);
          forcedUrlForConfig.set(configKey, nextUrl);
          ws.terminate(); // This will trigger 'close' and then 'getExchangeSocket' will be called with timeout
          return;
        } else {
          console.error(`[Global WS] All Binance alternatives for ${configKey} failed with 451 code.`);
          const subscribers = exchangeSubscribers.get(configKey);
          if (subscribers && subscribers.size > 0) {
            const errorPayload = JSON.stringify({
              type: "EXCHANGE_ERROR",
              exchange: cfg.exchange,
              marketType: cfg.marketType,
              message: "ALL_ALTERNATIVES_FAILED",
              isRegionalBlock: true,
              isDisconnected: true
            });
            subscribers.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(errorPayload);
              }
            });
          }
          return;
        }
      }

      // Notify all subscribers about the error
      const subscribers = exchangeSubscribers.get(configKey);
      if (subscribers && subscribers.size > 0) {
        const errorPayload = JSON.stringify({
          type: "EXCHANGE_ERROR",
          exchange: cfg.exchange,
          marketType: cfg.marketType,
          message: errorMessage,
          isRegionalBlock: is451,
          isDisconnected: true
        });
        subscribers.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(errorPayload);
          }
        });
      }
    });

    // Heartbeat
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        if (cfg.exchange.startsWith('Bybit')) {
          ws.send(JSON.stringify({ op: 'ping' }));
        } else if (cfg.exchange.startsWith('Binance')) {
          ws.ping(); 
        }
      } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        clearInterval(pingInterval);
      }
    }, 20000);

    return ws;
  }

  wss.on("connection", (clientWs: any) => {
    console.log("[WS Proxy] Client connected");
    const clientSubscriptions = new Set<string>();

    clientWs.on("message", (message) => {
      try {
        const payload = JSON.parse(message.toString());
        
        if (payload.type === "IDENTIFY") {
          clientWs.userId = payload.userId;
          console.log(`[WS Support] Client identified as ${payload.userId}`);
          return;
        }

        if (payload.type === "CONNECT_EXCHANGES") {
          const configs = payload.configs;
          const tickers = payload.tickers || [];
          
          // Clear old subscriptions for this client
          clientSubscriptions.forEach(key => {
            exchangeSubscribers.get(key)?.delete(clientWs);
            tickerSubscribers.get(key)?.delete(clientWs);
          });
          clientSubscriptions.clear();

          configs.forEach((cfg: any) => {
            const configKey = `${cfg.exchange}:${cfg.marketType}`;
            clientSubscriptions.add(configKey);
            
            if (!exchangeSubscribers.has(configKey)) {
              exchangeSubscribers.set(configKey, new Set());
            }
            exchangeSubscribers.get(configKey)!.add(clientWs);
            
            // Ensure the shared socket exists
            const ws = getExchangeSocket(cfg);

            // Handle tickers if provided in initial connect
            const relevantTickers = tickers.filter((t: any) => t.exchange === cfg.exchange && t.marketType === cfg.marketType);
            if (relevantTickers.length > 0) {
              if (!tickerSubscribers.has(configKey)) {
                tickerSubscribers.set(configKey, new Set());
              }
              tickerSubscribers.get(configKey)!.add(clientWs);

              if (cfg.exchange.startsWith('Bybit')) {
                subscribeTickersBybit(ws, cfg.exchange, cfg.marketType, relevantTickers);
              } else if (cfg.exchange.startsWith('Binance')) {
                subscribeTickersBinance(ws, cfg.exchange, cfg.marketType, relevantTickers);
              }
            }

            // Send cached snapshots immediately to the new client
            if (cfg.exchange.startsWith('Bybit') || cfg.exchange.startsWith('Binance')) {
              const prefix = `${configKey}:`;
              snapshotCache.forEach((snapshot, key) => {
                if (key.startsWith(prefix)) {
                  clientWs.send(JSON.stringify({
                    type: "EXCHANGE_DATA",
                    dataType: "DEPTH",
                    exchange: cfg.exchange,
                    marketType: cfg.marketType,
                    data: snapshot
                  }));
                }
              });
            }
          });
        }

        if (payload.type === "SUBSCRIBE_TICKERS") {
          const tickers = payload.tickers;
          tickers.forEach((t: any) => {
            const configKey = `${t.exchange}:${t.marketType}`;
            if (!tickerSubscribers.has(configKey)) {
              tickerSubscribers.set(configKey, new Set());
            }
            tickerSubscribers.get(configKey)!.add(clientWs);
            clientSubscriptions.add(configKey);

            // Find or create the exchange socket
            // We need the full config to create it if it doesn't exist
            // For now assume it exists or we have enough info
            // Actually we should probably have a way to get the base URL
            const ws = globalExchangeSockets.get(configKey);
            if (ws) {
              if (t.exchange.startsWith('Bybit')) {
                subscribeTickersBybit(ws, t.exchange, t.marketType, [t]);
              } else if (t.exchange.startsWith('Binance')) {
                subscribeTickersBinance(ws, t.exchange, t.marketType, [t]);
              }
            }
          });
        }
      } catch (e) {
        console.error("[WS Proxy] Error parsing message:", e);
      }
    });

    // Frequent heartbeat to keep client watchdog alive and detect proxy stalls early
    const heartbeatInterval = setInterval(() => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: "HEARTBEAT", timestamp: Date.now() }));
      }
    }, 2000);

    clientWs.on("close", () => {
      console.log("[WS Proxy] Client disconnected");
      clearInterval(heartbeatInterval);
      clientSubscriptions.forEach(key => {
        exchangeSubscribers.get(key)?.delete(clientWs);
      });
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
