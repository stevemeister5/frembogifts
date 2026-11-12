const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sql } = require('@vercel/postgres');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database tables are expected to exist in the Vercel Postgres database:
// - products (id, name, tier, price_tzs, price_usd, description, image_url, is_active, created_at)
// - offers (id, title, description, discount_percent, min_tier, start_date, end_date, is_active, created_at)
// - campaigns (id, title, description, start_date, end_date, is_active, created_at)

// API status / health check
app.get('/api', (req, res) => {
  res.json({ success: true, message: 'FremboGifts API is running' });
});

// Database setup / migration endpoint (callable to ensure tables exist in Vercel Postgres)
app.get('/api/setup', async (req, res) => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        tier TEXT NOT NULL CHECK(tier IN ('budget', 'premium')),
        price_tzs INTEGER NOT NULL,
        price_usd INTEGER NOT NULL,
        description TEXT,
        image_url TEXT DEFAULT 'https://via.placeholder.com/400x250?text=Product+Image',
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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

    const productCountResult = await sql`SELECT COUNT(*) as count FROM products`;
    if (parseInt(productCountResult.rows[0].count, 10) === 0) {
      await sql`INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Thinking of You Bouquet', 'budget', 30000, 12, '10-12 stem mixed seasonal flowers, simple wrapping, recycled paper card')`;
      await sql`INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Birthday Celebration Hamper', 'budget', 65000, 26, '20-stem premium bouquet, 500g premium chocolates, sparkling cider')`;
      await sql`INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Whisky & Chill Gift for Him', 'premium', 65000, 26, 'Premium gift set with Konyagi Gin, glasses, nuts & snacks')`;
      await sql`INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Valentines Day Premium', 'premium', 80000, 32, 'Special Valentine arrangement with premium roses & chocolates')`;
      await sql`INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Anniversary Romantic Package', 'premium', 75000, 30, '33-stem long-stem red roses, premium chocolates, champagne-style cider')`;
      await sql`INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Kilimanjaro Sunset', 'premium', 180000, 72, 'Full Maasai Shuka (100% cotton) - Premium tier centerpiece')`;
      await sql`INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Kakakuwe Coffee', 'budget', 30000, 12, 'Arusha region coffee cooperative, 250g bag with recipe card')`;
      await sql`INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES ('Zanzibar Spice & Stone', 'premium', 200000, 80, 'Zanzibar spice blend & Stone Town souvenir collection')`;
    }

    const offerCountResult = await sql`SELECT COUNT(*) as count FROM offers`;
    if (parseInt(offerCountResult.rows[0].count, 10) === 0) {
      await sql`INSERT INTO offers (title, description, discount_percent, min_tier, start_date, end_date) VALUES ('Early Bird Discount', '10% off all orders placed before 14:00', 10, 'budget', CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months')`;
      await sql`INSERT INTO offers (title, description, discount_percent, min_tier, start_date, end_date) VALUES ('Weekend Special', '15% off weekend orders', 15, 'both', CURRENT_DATE, CURRENT_DATE + INTERVAL '3 months')`;
    }

    const campaignCountResult = await sql`SELECT COUNT(*) as count FROM campaigns`;
    if (parseInt(campaignCountResult.rows[0].count, 10) === 0) {
      await sql`INSERT INTO campaigns (title, description, start_date, end_date) VALUES ('Holiday Season Campaign', 'Special Christmas & New Year gifting options', CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months')`;
      await sql`INSERT INTO campaigns (title, description, start_date, end_date) VALUES ('Valentines Day Campaign', 'Limited edition Valentine arrangements', CURRENT_DATE, CURRENT_DATE + INTERVAL '2 months')`;
    }

    res.json({ success: true, message: 'Database setup completed successfully' });
  } catch (error) {
    console.error('Error during database setup:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== API Routes - Products =====

// GET all active products (with optional tier filter)
app.get('/api/products', async (req, res) => {
  try {
    const { tier } = req.query;
    let rows;
    if (tier) {
      const result = await sql`SELECT * FROM products WHERE is_active = 1 AND tier = ${tier} ORDER BY tier, price_tzs ASC`;
      rows = result.rows;
    } else {
      const result = await sql`SELECT * FROM products WHERE is_active = 1 ORDER BY tier, price_tzs ASC`;
      rows = result.rows;
    }
    res.json({ success: true, products: rows });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM products WHERE id = ${req.params.id} AND is_active = 1`;
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, product: rows[0] });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST - Admin: Add new product
app.post('/api/products', async (req, res) => {
  try {
    const { name, tier, price_tzs, price_usd, description, image_url } = req.body;
    if (!name || !tier || price_tzs === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields: name, tier, price_tzs' });
    }

    const { rows } = await sql`INSERT INTO products (name, tier, price_tzs, price_usd, description, image_url, is_active, created_at) VALUES (${name}, ${tier}, ${price_tzs}, ${price_usd || null}, ${description || ''}, ${image_url || 'https://via.placeholder.com/400x250?text=Product+Image'}, 1, CURRENT_TIMESTAMP) RETURNING *`;
    res.json({ success: true, product: rows[0] });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT - Admin: Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, tier, price_tzs, price_usd, description, is_active } = req.body;
    const active = is_active === undefined ? 1 : (is_active === true || is_active === 1 || is_active === '1' ? 1 : 0);
    await sql`UPDATE products SET name = ${name}, tier = ${tier}, price_tzs = ${price_tzs}, price_usd = ${price_usd || null}, description = ${description || ''}, is_active = ${active} WHERE id = ${req.params.id}`;
    const { rows } = await sql`SELECT * FROM products WHERE id = ${req.params.id}`;
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, product: rows[0] });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE - Admin: Delete product (soft delete)
app.delete('/api/products/:id', async (req, res) => {
  try {
    await sql`UPDATE products SET is_active = 0 WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===== API Routes - Offers =====

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
    const active = is_active === undefined ? 1 : (is_active === true || is_active === 1 || is_active === '1' ? 1 : 0);
    await sql`UPDATE offers SET title = ${title}, description = ${description || ''}, discount_percent = ${discount_percent}, min_tier = ${min_tier || 'both'}, start_date = ${start_date || null}, end_date = ${end_date || null}, is_active = ${active} WHERE id = ${req.params.id}`;
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
  try {
    const { rows } = await sql`SELECT * FROM campaigns WHERE is_active = 1`;
    res.json({ success: true, campaigns: rows });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST - Admin: Add new campaign
app.post('/api/campaigns', async (req, res) => {
  try {
    const { title, description, start_date, end_date } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Missing required field: title' });
    }

    const { rows } = await sql`INSERT INTO campaigns (title, description, start_date, end_date, is_active, created_at) VALUES (${title}, ${description || ''}, ${start_date || null}, ${end_date || null}, 1, CURRENT_TIMESTAMP) RETURNING *`;
    res.json({ success: true, campaign: rows[0] });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT - Admin: Update campaign
app.put('/api/campaigns/:id', async (req, res) => {
  try {
    const { title, description, start_date, end_date, is_active } = req.body;
    const active = is_active === undefined ? 1 : (is_active === true || is_active === 1 || is_active === '1' ? 1 : 0);
    await sql`UPDATE campaigns SET title = ${title}, description = ${description || ''}, start_date = ${start_date || null}, end_date = ${end_date || null}, is_active = ${active} WHERE id = ${req.params.id}`;
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
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start local server when run directly
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;
