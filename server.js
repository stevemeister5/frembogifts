const express = require('express');
const cors = require('cors');
const { sql } = require('@vercel/postgres');
const path = require('path');
const crypto = require('crypto');
const resolveProductImage = require('./product-images');
const { getProductOccasions, normalizeProductOccasions } = require('./product-occasions');
const { giftOptions, calculateOrderTotal } = require('./gift-options');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'frembogifts-tanzania-auth-secret-key-2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/assets', express.static(path.join(__dirname, 'public')));

// ===== Crypto & Token Helpers =====

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return checkHash === hash;
}

function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days expiration
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// ===== Authentication Middleware =====

function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  let token = null;
  if (authHeader) {
    token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  }
  req.user = verifyToken(token);
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied: Admin privileges required.' });
  }
  next();
}

// Attach auth context to all requests
app.use(authenticateUser);

// ===== Database Setup & Migration =====

async function initDatabaseTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      phone TEXT,
      city TEXT,
      payment_method TEXT DEFAULT 'mpesa',
      mpesa_number TEXT,
      card_last4 TEXT,
      card_holder TEXT,
      card_exp TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_carts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      items TEXT DEFAULT '[]',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      recipient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      gift_message TEXT,
      gift_wrap BOOLEAN NOT NULL DEFAULT false,
      gift_wrap_fee_tzs INTEGER NOT NULL DEFAULT 0,
      card_upgrade BOOLEAN NOT NULL DEFAULT false,
      card_upgrade_fee_tzs INTEGER NOT NULL DEFAULT 0,
      items TEXT NOT NULL,
      total_tzs INTEGER NOT NULL,
      total_usd NUMERIC(10, 2) NOT NULL,
      discount_tzs INTEGER DEFAULT 0,
      payment_method TEXT DEFAULT 'mpesa',
      neighborhood TEXT,
      landmark TEXT,
      is_surprise BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await sql`ALTER TABLE orders ALTER COLUMN total_usd TYPE NUMERIC(10, 2);`;
  } catch (e) {
    // Column might already be numeric
  }

  try {
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS neighborhood TEXT;`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS landmark TEXT;`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_surprise BOOLEAN DEFAULT false;`;
  } catch (e) {
    // Columns might already exist
  }

  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_wrap BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_wrap_fee_tzs INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_upgrade BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_upgrade_fee_tzs INTEGER NOT NULL DEFAULT 0`;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      tier TEXT NOT NULL CHECK(tier IN ('budget', 'premium')),
      price_tzs INTEGER NOT NULL,
      price_usd INTEGER NOT NULL,
      description TEXT,
      image_url TEXT DEFAULT '/assets/images/giftopia-placeholder.svg',
      occasions TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS occasions TEXT NOT NULL DEFAULT '[]'`;
  await sql`
    UPDATE products SET occasions = CASE
      WHEN LOWER(name) LIKE '%birthday%' THEN '["birthday","celebration"]'
      WHEN LOWER(name) LIKE '%valentine%' OR LOWER(name) LIKE '%anniversary%' THEN '["love"]'
      WHEN LOWER(name) LIKE '%thinking of you%' OR LOWER(name) LIKE '%coffee%' THEN '["gratitude"]'
      WHEN LOWER(name) LIKE '%kilimanjaro%' OR LOWER(name) LIKE '%zanzibar%' THEN '["souvenir"]'
      WHEN LOWER(name) LIKE '%whisky%' OR LOWER(name) LIKE '%konyagi%' THEN '["birthday","celebration"]'
      ELSE occasions
    END
    WHERE occasions IS NULL OR occasions = '[]'
  `;
  await sql`
    UPDATE products SET image_url = CASE
      WHEN LOWER(name) LIKE '%thinking of you%' THEN '/assets/images/thinking-of-you.jpg'
      WHEN LOWER(name) LIKE '%birthday%' THEN '/assets/images/birthday-hamper.jpg'
      WHEN LOWER(name) LIKE '%whisky%' OR LOWER(name) LIKE '%konyagi%' THEN '/assets/images/konyagi-gin.jpg'
      WHEN LOWER(name) LIKE '%valentine%' THEN '/assets/images/valentines.jpg'
      WHEN LOWER(name) LIKE '%anniversary%' THEN '/assets/images/anniversary.jpg'
      WHEN LOWER(name) LIKE '%kilimanjaro%' OR LOWER(name) LIKE '%maasai%' OR LOWER(name) LIKE '%shuka%' THEN '/assets/images/maasai-shuka.jpg'
      WHEN LOWER(name) LIKE '%coffee%' THEN '/assets/images/arusha-coffee.jpg'
      WHEN LOWER(name) LIKE '%zanzibar%' THEN '/assets/images/zanzibar-spice.jpg'
      ELSE image_url
    END
    WHERE image_url IS NULL OR image_url LIKE 'https://images.unsplash.com/%'
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS offers (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      discount_percent INTEGER NOT NULL DEFAULT 0,
      min_tier TEXT NOT NULL DEFAULT 'both' CHECK(min_tier IN ('budget', 'premium', 'both')),
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const defaultProducts = [
    { name: 'Thinking of You Bouquet', tier: 'budget', price_tzs: 30000, price_usd: 12, description: '10-12 stems of mixed seasonal flowers, simply wrapped for a thoughtful thank-you or just-because gift.', image_url: '/assets/images/thinking-of-you.jpg', occasions: ['gratitude'] },
    { name: 'Birthday Celebration Hamper', tier: 'budget', price_tzs: 65000, price_usd: 26, description: 'A cheerful birthday set with seasonal flowers and chocolates.', image_url: '/assets/images/birthday-hamper.jpg', occasions: ['birthday', 'celebration'] },
    { name: 'Whisky & Chill Gift for Him', tier: 'premium', price_tzs: 65000, price_usd: 26, description: 'A Konyagi gift set with glasses and snacks. Alcohol orders require applicable licensing and age verification.', image_url: '/assets/images/konyagi-gin.jpg', occasions: ['birthday', 'celebration'] },
    { name: 'Valentines Day Premium', tier: 'premium', price_tzs: 80000, price_usd: 32, description: 'A romantic seasonal arrangement with roses and chocolates.', image_url: '/assets/images/valentines.jpg', occasions: ['love'] },
    { name: 'Anniversary Romantic Package', tier: 'premium', price_tzs: 75000, price_usd: 30, description: 'A romantic rose arrangement with chocolates for an anniversary.', image_url: '/assets/images/anniversary.jpg', occasions: ['love'] },
    { name: 'Kilimanjaro Sunset', tier: 'premium', price_tzs: 180000, price_usd: 72, description: 'A 100% cotton Maasai shuka, a memorable textile keepsake from Tanzania.', image_url: '/assets/images/maasai-shuka.jpg', occasions: ['souvenir'] },
    { name: 'Kakakuwe Coffee', tier: 'budget', price_tzs: 30000, price_usd: 12, description: '250g of Arusha-region coffee from the Kakakuwe cooperative.', image_url: '/assets/images/arusha-coffee.jpg', occasions: ['gratitude', 'souvenir'] },
    { name: 'Zanzibar Spice & Stone', tier: 'premium', price_tzs: 200000, price_usd: 80, description: 'A keepsake collection pairing Zanzibar spices with a Stone Town-inspired memento.', image_url: '/assets/images/zanzibar-spice.jpg', occasions: ['souvenir'] },
    { name: 'Zanzibar Spice Trio', tier: 'budget', price_tzs: 25000, price_usd: 10, description: 'A small set of Zanzibar-inspired spices; an easy individual gift or a flavorful addition to a hamper.', image_url: '/assets/images/zanzibar-spice.jpg', occasions: ['gratitude', 'souvenir'] },
    { name: 'Maasai Beadwork Keepsake', tier: 'budget', price_tzs: 35000, price_usd: 14, description: 'A colorful beadwork keepsake. Artisan patterns and availability may vary; confirm the exact item before fulfillment.', image_url: '/assets/images/maasai-beadwork.jpg', occasions: ['gratitude', 'souvenir'] },
    { name: 'Roasted Cashew Snack Pouch', tier: 'budget', price_tzs: 20000, price_usd: 8, description: 'A pouch of roasted cashews, a simple snack-sized gift to pair with coffee or spices.', image_url: '/assets/images/cashew-nuts.jpg', occasions: ['gratitude', 'souvenir'] }
  ];
  for (const product of defaultProducts) {
    await sql`
      INSERT INTO products (name, tier, price_tzs, price_usd, description, image_url, occasions)
      SELECT ${product.name}, ${product.tier}, ${product.price_tzs}, ${product.price_usd},
        ${product.description}, ${product.image_url}, ${JSON.stringify(product.occasions)}
      WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = ${product.name})
    `;
  }

  // Seed default offers if empty
  const offerCountResult = await sql`SELECT COUNT(*) as count FROM offers`;
  if (parseInt(offerCountResult.rows[0].count, 10) === 0) {
    await sql`INSERT INTO offers (title, description, discount_percent, min_tier, start_date, end_date) VALUES ('Early Bird Discount', '10% off all orders placed before 14:00', 10, 'budget', CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months')`;
    await sql`INSERT INTO offers (title, description, discount_percent, min_tier, start_date, end_date) VALUES ('Weekend Special', '15% off weekend orders', 15, 'both', CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months')`;
  }

  // Seed default campaigns if empty
  const campaignCountResult = await sql`SELECT COUNT(*) as count FROM campaigns`;
  if (parseInt(campaignCountResult.rows[0].count, 10) === 0) {
    await sql`INSERT INTO campaigns (title, description, start_date, end_date) VALUES ('Holiday Season Campaign', 'Special Christmas & New Year gifting options', CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months')`;
    await sql`INSERT INTO campaigns (title, description, start_date, end_date) VALUES ('Valentines Day Campaign', 'Limited edition Valentine arrangements', CURRENT_DATE, CURRENT_DATE + INTERVAL '2 months')`;
  }
}

// Health check
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Giftopia API is running',
    authenticated: !!req.user,
    user: req.user ? { id: req.user.id, email: req.user.email, role: req.user.role } : null
  });
});

// Setup endpoint
app.get('/api/setup', async (req, res) => {
  try {
    await initDatabaseTables();
    res.json({
      success: true,
      message: 'Database tables initialized and seeds initialized successfully'
    });
  } catch (error) {
    console.error('Error during database setup:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', async (req, res) => {
  try {
    const [productsResult, offersResult, campaignsResult] = await Promise.all([
      sql`SELECT * FROM products WHERE is_active = 1 ORDER BY tier, price_tzs ASC`,
      sql`SELECT * FROM offers WHERE is_active = 1 ORDER BY id ASC`,
      sql`SELECT * FROM campaigns WHERE is_active = 1 ORDER BY id ASC`
    ]);
    const whatsappNumber = process.env.WHATSAPP_NUMBER || '';
    if (whatsappNumber && !/^\d{8,15}$/.test(whatsappNumber)) {
      throw new Error('WHATSAPP_NUMBER must use 8 to 15 digits, including the country code.');
    }

    res.set('Cache-Control', 'no-store');
    res.render('index', {
      products: productsResult.rows.map(product => ({
        ...product,
        image_url: resolveProductImage(product),
        occasions: getProductOccasions(product, true)
      })),
      offers: offersResult.rows,
      campaigns: campaignsResult.rows,
      whatsappNumber,
      giftOptions
    });
  } catch (error) {
    console.error('Error rendering storefront:', error);
    res.status(500).send('Unable to load the Giftopia storefront.');
  }
});

// ===== AUTHENTICATION ROUTES =====

// POST /api/auth/register - Sign up new customer
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone, city, payment_method, mpesa_number, card_last4, card_holder, card_exp } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if email already registered
    const existing = await sql`SELECT id FROM users WHERE email = ${cleanEmail}`;
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const { hash, salt } = hashPassword(password);
    const { rows } = await sql`
      INSERT INTO users (
        email, password_hash, salt, name, role, phone, city,
        payment_method, mpesa_number, card_last4, card_holder, card_exp
      ) VALUES (
        ${cleanEmail}, ${hash}, ${salt}, ${name.trim()}, 'user', ${phone || null}, ${city || 'Dar es Salaam'},
        ${payment_method || 'mpesa'}, ${mpesa_number || null}, ${card_last4 || null}, ${card_holder || null}, ${card_exp || null}
      ) RETURNING id, email, name, role, phone, city, payment_method, mpesa_number, card_last4, card_holder, card_exp, created_at
    `;

    const newUser = rows[0];
    const token = generateToken(newUser);
    res.status(201).json({ success: true, message: 'Account registered successfully', token, user: newUser });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/login - Sign in
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];
    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken(user);
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      city: user.city,
      payment_method: user.payment_method,
      mpesa_number: user.mpesa_number,
      card_last4: user.card_last4,
      card_holder: user.card_holder,
      card_exp: user.card_exp
    };

    res.json({ success: true, message: 'Login successful', token, user: safeUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/me - Get current user profile & saved payment details
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await sql`
      SELECT id, email, name, role, phone, city, payment_method, mpesa_number, card_last4, card_holder, card_exp, created_at
      FROM users WHERE id = ${req.user.id}
    `;
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/auth/me - Update profile & saved payment details for later
app.put('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const { name, phone, city, payment_method, mpesa_number, card_last4, card_holder, card_exp, new_password } = req.body;
    
    // Optional password update
    if (new_password) {
      if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      }
      const { hash, salt } = hashPassword(new_password);
      await sql`UPDATE users SET password_hash = ${hash}, salt = ${salt} WHERE id = ${req.user.id}`;
    }

    await sql`
      UPDATE users SET
        name = COALESCE(${name}, name),
        phone = COALESCE(${phone}, phone),
        city = COALESCE(${city}, city),
        payment_method = COALESCE(${payment_method}, payment_method),
        mpesa_number = COALESCE(${mpesa_number}, mpesa_number),
        card_last4 = COALESCE(${card_last4}, card_last4),
        card_holder = COALESCE(${card_holder}, card_holder),
        card_exp = COALESCE(${card_exp}, card_exp),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.user.id}
    `;

    const { rows } = await sql`
      SELECT id, email, name, role, phone, city, payment_method, mpesa_number, card_last4, card_holder, card_exp, created_at
      FROM users WHERE id = ${req.user.id}
    `;
    res.json({ success: true, message: 'Payment details and profile updated', user: rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== PERSISTENT USER CART ROUTES =====

// GET /api/cart - Get user's saved cart
app.get('/api/cart', requireAuth, async (req, res) => {
  try {
    const { rows } = await sql`SELECT items FROM user_carts WHERE user_id = ${req.user.id}`;
    if (rows.length === 0) {
      return res.json({ success: true, items: [] });
    }
    const items = typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items;
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/cart - Save/sync user's cart
app.post('/api/cart', requireAuth, async (req, res) => {
  try {
    const { items } = req.body;
    const itemsJson = JSON.stringify(Array.isArray(items) ? items : []);
    await sql`
      INSERT INTO user_carts (user_id, items, updated_at)
      VALUES (${req.user.id}, ${itemsJson}, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET items = ${itemsJson}, updated_at = CURRENT_TIMESTAMP
    `;
    res.json({ success: true, message: 'Cart saved successfully' });
  } catch (error) {
    console.error('Error saving cart:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== ORDERS ROUTES =====

// POST /api/orders - Place a new order
app.post('/api/orders', async (req, res) => {
  try {
    const { recipient_name, phone, city, neighborhood, landmark, is_surprise, gift_message, gift_wrap, card_upgrade, items, total_tzs, discount_tzs, payment_method } = req.body;
    if (!recipient_name || !phone || !items || !total_tzs) {
      return res.status(400).json({ success: false, message: 'Missing required order details' });
    }

    const orderNumber = 'FG-' + Math.floor(100000 + Math.random() * 900000);
    const userId = req.user ? req.user.id : null;
    const itemsStr = typeof items === 'string' ? items : JSON.stringify(items);
    const orderTotals = calculateOrderTotal(total_tzs, { gift_wrap, card_upgrade });
    const parsedTotalTzs = orderTotals.total_tzs;
    const parsedTotalUsd = (parsedTotalTzs / 2500).toFixed(2);
    const parsedDiscount = Math.round(Number(discount_tzs) || 0);
    const surpriseFlag = Boolean(is_surprise);

    const { rows } = await sql`
      INSERT INTO orders (
        order_number, user_id, recipient_name, phone, city, neighborhood, landmark, is_surprise, gift_message,
        gift_wrap, gift_wrap_fee_tzs, card_upgrade, card_upgrade_fee_tzs,
        items, total_tzs, total_usd, discount_tzs, payment_method, status
      ) VALUES (
        ${orderNumber}, ${userId}, ${recipient_name}, ${phone}, ${city || 'Dar es Salaam'}, ${neighborhood || ''}, ${landmark || ''}, ${surpriseFlag}, ${gift_message || ''},
        ${orderTotals.gift_wrap}, ${orderTotals.gift_wrap_fee_tzs}, ${orderTotals.card_upgrade}, ${orderTotals.card_upgrade_fee_tzs},
        ${itemsStr}, ${parsedTotalTzs}, ${parsedTotalUsd}, ${parsedDiscount}, ${payment_method || 'mpesa'}, 'pending'
      ) RETURNING *
    `;

    // Clear saved cart if logged in
    if (userId) {
      await sql`UPDATE user_carts SET items = '[]' WHERE user_id = ${userId}`;
    }

    res.status(201).json({ success: true, order: rows[0] });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/orders - Get user's orders or all orders for admin
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      const result = await sql`SELECT * FROM orders ORDER BY id DESC`;
      rows = result.rows;
    } else {
      const result = await sql`SELECT * FROM orders WHERE user_id = ${req.user.id} ORDER BY id DESC`;
      rows = result.rows;
    }
    res.json({ success: true, orders: rows });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== ADMIN-PROTECTED USER LIST =====

// GET /api/admin/users - List users for admin
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { rows } = await sql`
      SELECT id, email, name, role, phone, city, payment_method, mpesa_number, card_last4, created_at
      FROM users ORDER BY id DESC
    `;
    res.json({ success: true, users: rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== PRODUCTS API ROUTES =====

// GET /api/products - Public active products, or ?all=true (admin protected)
app.get('/api/products', async (req, res) => {
  try {
    const { tier, all } = req.query;
    let rows;

    if (all === 'true') {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin authentication required to view all products' });
      }
      if (tier) {
        const result = await sql`SELECT * FROM products WHERE tier = ${tier} ORDER BY id DESC`;
        rows = result.rows;
      } else {
        const result = await sql`SELECT * FROM products ORDER BY id DESC`;
        rows = result.rows;
      }
    } else {
      if (tier) {
        const result = await sql`SELECT * FROM products WHERE is_active = 1 AND tier = ${tier} ORDER BY tier, price_tzs ASC`;
        rows = result.rows;
      } else {
        const result = await sql`SELECT * FROM products WHERE is_active = 1 ORDER BY tier, price_tzs ASC`;
        rows = result.rows;
      }
    }
    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      products: rows.map(product => ({
        ...product,
        image_url: resolveProductImage(product),
        occasions: normalizeProductOccasions(product.occasions) || []
      }))
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single product (public)
app.get('/api/products/:id', async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM products WHERE id = ${req.params.id}`;
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({
      success: true,
      product: {
        ...rows[0],
        image_url: resolveProductImage(rows[0]),
        occasions: normalizeProductOccasions(rows[0].occasions) || []
      }
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST - Admin only: Add new product
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const { name, tier, price_tzs, price_usd, description, image_url } = req.body;
    const occasions = normalizeProductOccasions(req.body.occasions);
    if (!name || !tier || price_tzs === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields: name, tier, price_tzs' });
    }
    if (!occasions) {
      return res.status(400).json({ success: false, message: 'Product occasions must be a list of supported occasion tags' });
    }

    const { rows } = await sql`
      INSERT INTO products (name, tier, price_tzs, price_usd, description, image_url, occasions, is_active, created_at)
      VALUES (${name}, ${tier}, ${price_tzs}, ${price_usd || null}, ${description || ''}, ${image_url || '/assets/images/giftopia-placeholder.svg'}, ${JSON.stringify(occasions)}, 1, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    res.json({ success: true, product: { ...rows[0], occasions: normalizeProductOccasions(rows[0].occasions) || [] } });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT - Admin only: Update product
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { name, tier, price_tzs, price_usd, description, image_url, is_active } = req.body;
    const occasions = normalizeProductOccasions(req.body.occasions);
    if (!occasions) {
      return res.status(400).json({ success: false, message: 'Product occasions must be a list of supported occasion tags' });
    }
    const active = is_active === undefined ? 1 : (is_active === true || is_active === 1 || is_active === '1' ? 1 : 0);
    await sql`
      UPDATE products SET
        name = ${name},
        tier = ${tier},
        price_tzs = ${price_tzs},
        price_usd = ${price_usd || null},
        description = ${description || ''},
        image_url = ${image_url || '/assets/images/giftopia-placeholder.svg'},
        occasions = ${JSON.stringify(occasions)},
        is_active = ${active}
      WHERE id = ${req.params.id}
    `;
    const { rows } = await sql`SELECT * FROM products WHERE id = ${req.params.id}`;
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, product: { ...rows[0], occasions: normalizeProductOccasions(rows[0].occasions) || [] } });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE - Admin only: Delete product
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { permanent } = req.query;
    if (permanent === 'true') {
      const { rowCount } = await sql`DELETE FROM products WHERE id = ${req.params.id}`;
      if (rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      return res.json({ success: true, message: 'Product permanently deleted' });
    }
    const { rowCount } = await sql`UPDATE products SET is_active = 0 WHERE id = ${req.params.id}`;
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deactivated' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== OFFERS API ROUTES =====

// GET /api/offers - Public active offers, or ?all=true (admin protected)
app.get('/api/offers', async (req, res) => {
  try {
    const { all } = req.query;
    let rows;
    if (all === 'true') {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin authentication required to view all offers' });
      }
      const result = await sql`SELECT * FROM offers ORDER BY id DESC`;
      rows = result.rows;
    } else {
      const result = await sql`SELECT * FROM offers WHERE is_active = 1 ORDER BY id ASC`;
      rows = result.rows;
    }
    res.json({ success: true, offers: rows });
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST - Admin only: Add offer
app.post('/api/offers', requireAdmin, async (req, res) => {
  try {
    const { title, description, discount_percent, min_tier, start_date, end_date } = req.body;
    if (!title || discount_percent === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields: title, discount_percent' });
    }

    const { rows } = await sql`
      INSERT INTO offers (title, description, discount_percent, min_tier, start_date, end_date, is_active, created_at)
      VALUES (${title}, ${description || ''}, ${discount_percent}, ${min_tier || 'both'}, ${start_date || null}, ${end_date || null}, 1, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    res.json({ success: true, offer: rows[0] });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT - Admin only: Update offer
app.put('/api/offers/:id', requireAdmin, async (req, res) => {
  try {
    const { title, description, discount_percent, min_tier, start_date, end_date, is_active } = req.body;
    const active = is_active === undefined ? 1 : (is_active === true || is_active === 1 || is_active === '1' ? 1 : 0);
    await sql`
      UPDATE offers SET
        title = ${title},
        description = ${description || ''},
        discount_percent = ${discount_percent},
        min_tier = ${min_tier || 'both'},
        start_date = ${start_date || null},
        end_date = ${end_date || null},
        is_active = ${active}
      WHERE id = ${req.params.id}
    `;
    const { rows } = await sql`SELECT * FROM offers WHERE id = ${req.params.id}`;
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    res.json({ success: true, offer: rows[0] });
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE - Admin only: Delete offer
app.delete('/api/offers/:id', requireAdmin, async (req, res) => {
  try {
    const { permanent } = req.query;
    if (permanent === 'true') {
      const { rowCount } = await sql`DELETE FROM offers WHERE id = ${req.params.id}`;
      if (rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Offer not found' });
      }
      return res.json({ success: true, message: 'Offer permanently deleted' });
    }
    const { rowCount } = await sql`UPDATE offers SET is_active = 0 WHERE id = ${req.params.id}`;
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    res.json({ success: true, message: 'Offer deactivated' });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== CAMPAIGNS API ROUTES =====

// GET /api/campaigns - Public active campaigns, or ?all=true (admin protected)
app.get('/api/campaigns', async (req, res) => {
  try {
    const { all } = req.query;
    let rows;
    if (all === 'true') {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin authentication required to view all campaigns' });
      }
      const result = await sql`SELECT * FROM campaigns ORDER BY id DESC`;
      rows = result.rows;
    } else {
      const result = await sql`SELECT * FROM campaigns WHERE is_active = 1 ORDER BY id ASC`;
      rows = result.rows;
    }
    res.json({ success: true, campaigns: rows });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST - Admin only: Add campaign
app.post('/api/campaigns', requireAdmin, async (req, res) => {
  try {
    const { title, description, start_date, end_date } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Missing required field: title' });
    }

    const { rows } = await sql`
      INSERT INTO campaigns (title, description, start_date, end_date, is_active, created_at)
      VALUES (${title}, ${description || ''}, ${start_date || null}, ${end_date || null}, 1, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    res.json({ success: true, campaign: rows[0] });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT - Admin only: Update campaign
app.put('/api/campaigns/:id', requireAdmin, async (req, res) => {
  try {
    const { title, description, start_date, end_date, is_active } = req.body;
    const active = is_active === undefined ? 1 : (is_active === true || is_active === 1 || is_active === '1' ? 1 : 0);
    await sql`
      UPDATE campaigns SET
        title = ${title},
        description = ${description || ''},
        start_date = ${start_date || null},
        end_date = ${end_date || null},
        is_active = ${active}
      WHERE id = ${req.params.id}
    `;
    const { rows } = await sql`SELECT * FROM campaigns WHERE id = ${req.params.id}`;
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    res.json({ success: true, campaign: rows[0] });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE - Admin only: Delete campaign
app.delete('/api/campaigns/:id', requireAdmin, async (req, res) => {
  try {
    const { permanent } = req.query;
    if (permanent === 'true') {
      const { rowCount } = await sql`DELETE FROM campaigns WHERE id = ${req.params.id}`;
      if (rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
      }
      return res.json({ success: true, message: 'Campaign permanently deleted' });
    }
    const { rowCount } = await sql`UPDATE campaigns SET is_active = 0 WHERE id = ${req.params.id}`;
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    res.json({ success: true, message: 'Campaign deactivated' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin Page Routes
app.get('/admin', (req, res) => {
  res.render('admin');
});

app.get('/admin.html', (req, res) => {
  res.redirect(301, '/admin');
});

// Catch-all: serve frontend for any non-API routes
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.status(404).send('Page not found');
});

// Start local server when run directly
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;
