const express = require('express');
const bodyParser = require('body-parser');
const { sql } = require('@vercel/postgres');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database tables are expected to exist in the Vercel Postgres database.
// Create tables manually in the Vercel Postgres dashboard if needed.
// The API routes below assume the following tables exist:
// - products (id, name, tier, price_tzs, price_usd, description, is_active, created_at)
// - offers (id, title, description, discount_percent, min_tier, start_date, end_date, is_active, created_at)
// - campaigns (id, title, description, start_date, end_date, is_active, created_at)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tier TEXT NOT NULL CHECK(tier IN ('budget', 'premium')),
      price_tzs INTEGER NOT NULL,
      price_usd INTEGER NOT NULL,
      description TEXT,
      image_url TEXT DEFAULT 'https://via.placeholder.com/400x250?text=Product+Image',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      discount_percent INTEGER NOT NULL DEFAULT 0,
      min_tier TEXT NOT NULL DEFAULT 'both' CHECK(min_tier IN ('budget', 'premium', 'both')),
      start_date DATETIME,
      end_date DATETIME,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      start_date DATETIME,
      end_date DATETIME,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const productCount = await db.get('SELECT COUNT(*) as count FROM products');
  if (productCount.count === 0) {
    await db.run("INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Thinking of You Bouquet', 'budget', 30000, 12, '10-12 stem mixed seasonal flowers, simple wrapping, recycled paper card')");
    await db.run("INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Birthday Celebration Hamper', 'budget', 65000, 26, '20-stem premium bouquet, 500g premium chocolates, sparkling cider')");
    await db.run("INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Whisky & Chill Gift for Him', 'premium', 65000, 26, 'Premium gift set with Konyagi Gin, glasses, nuts & snacks')");
    await db.run("INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Valentines Day Premium', 'premium', 80000, 32, 'Special Valentine arrangement with premium roses & chocolates')");
    await db.run("INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Anniversary Romantic Package', 'premium', 75000, 30, '33-stem long-stem red roses, premium chocolates, champagne-style cider')");
    await db.run("INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Kilimanjaro Sunset', 'premium', 180000, 72, 'Full Maasai Shuka (100% cotton) - Premium tier centerpiece')");
    await db.run("INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Kakakuwe Coffee', 'budget', 30000, 12, 'Arusha region coffee cooperative, 250g bag with recipe card')");
    await db.run("INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Zanzibar Spice & Stone', 'premium', 200000, 80, 'Zanzibar spice blend & Stone Town souvenir collection')");
  }

  const offerCount = await db.get('SELECT COUNT(*) as count FROM offers');
  if (offerCount.count === 0) {
    await db.run("INSERT INTO offers (title, description, discount_percent, min_tier, start_date, end_date) VALUES ('Early Bird Discount', '10% off all orders placed before 14:00', 10, 'budget', date('now'), date('now', '+3 months'))");
    await db.run("INSERT INTO offers (title, description, discount_percent, min_tier, start_date, end_date) VALUES ('Weekend Special', '15% off weekend orders', 15, 'both', date('now'), date('now', '+3 months'))");
  }

  const campaignCount = await db.get('SELECT COUNT(*) as count FROM campaigns');
  if (campaignCount.count === 0) {
    await db.run("INSERT INTO campaigns (title, description, start_date, end_date) VALUES ('Holiday Season Campaign', 'Special Christmas & New Year gifting options', date('now'), date('now', '+6 months'))");
    await db.run("INSERT INTO campaigns (title, description, start_date, end_date) VALUES ('Valentines Day Campaign', 'Limited edition Valentine arrangements', date('now', '2026-01-01'), date('now', '2026-02-14'))");
  }

  console.log('Database setup complete');
}

setupDatabase();

// ===== API Routes - Products =====

// GET all active products
app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM products WHERE is_active = 1`;
    res.json({ success: true, products: rows });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single product
app.get('/api/products/:id', async (req, res) => {
  const product = await sql`SELECT * FROM products WHERE id = ${req.params.id} AND is_active = 1`;
  if (product) {
    res.json({ success: true, product });
  } else {
    res.status(404).json({ success: false, message: 'Product not found' });
  }
});

// POST - Admin: Add new product
app.post('/api/products', async (req, res) => {
  const { name, tier, price_tzs, price_usd, description } = req.body;
  if (!name || !tier || price_tzs === undefined) {
    return res.status(400).json({ success: false, message: 'Missing required fields: name, tier, price_tzs' });
  }

  await sql`INSERT INTO products (name, tier, price_tzs, price_usd, description, is_active, created_at) VALUES (${name}, ${tier}, ${price_tzs}, ${price_usd}, ${description || ''}, 1, CURRENT_TIMESTAMP) RETURNING *`
  res.json({ success: true, product: newProduct });
});

// PUT - Admin: Update product
app.put('/api/products/:id', async (req, res) => {
  const { name, tier, price_tzs, price_usd, description, is_active } = req.body;
  await sql`UPDATE products SET name = ${name}, tier = ${tier}, price_tzs = ${price_tzs}, price_usd = ${price_usd}, description = ${description || ''}, is_active = ${is_active === true ? 1 : 0}, updated_at = CURRENT_TIMESTAMP WHERE id = ${req.params.id}`
  res.json({ success: true, product: updatedProduct });
});

// DELETE - Admin: Delete product (soft delete)
app.delete('/api/products/:id', async (req, res) => {
  await sql`UPDATE products SET is_active = 0 WHERE id = ${req.params.id}`;
  res.json({ success: true });
});

// ===== API Routes - Offers =====

// GET all active offers
app.get('/api/offers', async (req, res) => {
  const offers = await db.all('SELECT * FROM offers WHERE is_active = 1');
  res.json({ success: true, offers });
});

// POST - Admin: Add new offer
app.post('/api/offers', async (req, res) => {
  // GET all active offers
app.get('/api/offers', async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM offers WHERE is_active = 1`;
    res.json({ success: true, offers: rows });
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST - Admin: Add new offer
app.post('/api/offers', async (req, res) => {
  try {
    const { title, description, discount_percent, min_tier, start_date, end_date } = req.body;
    if (!title || discount_percent === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields: title, discount_percent' });
    }

    const { rows } = await sql`INSERT INTO offers (title, description, discount_percent, min_tier, start_date, end_date, is_active, created_at) VALUES (${title}, ${description || ''}, ${discount_percent}, ${min_tier || 'both'}, ${start_date || null}, ${end_date || null}, 1, CURRENT_TIMESTAMP) RETURNING *`;
    res.json({ success: true, offer: rows[0] });
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT - Admin: Update offer
app.put('/api/offers/:id', async (req, res) => {
  try {
    const { title, description, discount_percent, min_tier, start_date, end_date, is_active } = req.body;
    await sql`UPDATE offers SET title = ${title}, description = ${description || ''}, discount_percent = ${discount_percent}, min_tier = ${min_tier || 'both'}, start_date = ${start_date || null}, end_date = ${end_date || null}, is_active = ${is_active === true ? 1 : 0}, updated_at = CURRENT_TIMESTAMP WHERE id = ${req.params.id}`;
    const { rows } = await sql`SELECT * FROM offers WHERE id = ${req.params.id}`;
    res.json({ success: true, offer: rows[0] });
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE - Admin: Delete offer
app.delete('/api/offers/:id', async (req, res) => {
  try {
    await sql`UPDATE offers SET is_active = 0 WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== API Routes - Campaigns =====

// GET all active campaigns
app.get('/api/campaigns', async (req, res) => {
  await sql`SELECT * FROM campaigns WHERE is_active = 1`;
  res.json({ success: true, campaigns });
});

// POST - Admin: Add new campaign
app.post('/api/campaigns', async (req, res) => {
  const { title, description, start_date, end_date } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: 'Missing required field: title' });
  }

  await sql`INSERT INTO campaigns (title, description, start_date, end_date, is_active, created_at) VALUES (${title}, ${description || ''}, ${start_date || null}, ${end_date || null}, 1, CURRENT_TIMESTAMP) RETURNING *`
  res.json({ success: true, campaign: newCampaign });
});

// PUT - Admin: Update campaign
app.put('/api/campaigns/:id', async (req, res) => {
  const { title, description, start_date, end_date, is_active } = req.body;
  await sql`UPDATE campaigns SET title = ${title}, description = ${description || ''}, start_date = ${start_date || null}, end_date = ${end_date || null}, is_active = ${is_active === true ? 1 : 0}, updated_at = CURRENT_TIMESTAMP WHERE id = ${req.params.id}`
  res.json({ success: true, campaign: updatedCampaign });
});

// DELETE - Admin: Delete campaign
app.delete('/api/campaigns/:id', async (req, res) => {
  try {
    await sql`UPDATE campaigns SET is_active = 0 WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Catch-all: serve frontend for any non-API routes
app.use('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

module.exports = app;
