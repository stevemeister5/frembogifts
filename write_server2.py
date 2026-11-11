content = r'''

// ===== Database Setup =====
async function setupDatabase() {
  db = await open({
    driver: sqlite3.Database,
    filename: dbPath,
  });

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
'''

with open('server.js', 'a') as f:
    f.write(content)
print('Part 2 written')
