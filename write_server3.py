content = r'''
// ===== API Routes - Products =====

// GET all products (with optional tier filter)
app.get('/api/products', async (req, res) => {
  const tier = req.query.tier;
  let query = 'SELECT * FROM products WHERE is_active = 1';
  const params = [];

  if (tier) {
    query += ' AND tier = ?';
    params.push(tier);
  }

  query += ' ORDER BY tier, price_tzs ASC';
  const products = await db.all(query, params);
  res.json({ success: true, products });
});

// GET single product
app.get('/api/products/:id', async (req, res) => {
  const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
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

  const result = await db.run(
    "INSERT INTO products (name, tier, price_tzs, price_usd, description) VALUES (?, ?, ?, ?, ?)",
    [name, tier, price_tzs, price_usd || null, description || '']
  );

  const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);
  res.json({ success: true, product: newProduct });
});

// PUT - Admin: Update product
app.put('/api/products/:id', async (req, res) => {
  const { name, tier, price_tzs, price_usd, description, is_active } = req.body;
  await db.run(
    "UPDATE products SET name = ?, tier = ?, price_tzs = ?, price_usd = ?, description = ?, is_active = ? WHERE id = ?",
    [name, tier, price_tzs, price_usd, description, is_active === true ? 1 : 0, req.params.id]
  );

  const updatedProduct = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json({ success: true, product: updatedProduct });
});

// DELETE - Admin: Delete product (soft delete)
app.delete('/api/products/:id', async (req, res) => {
  await db.run('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
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
  const { title, description, discount_percent, min_tier, start_date, end_date } = req.body;
  if (!title || discount_percent === undefined) {
    return res.status(400).json({ success: false, message: 'Missing required fields: title, discount_percent' });
  }

  await db.run(
    "INSERT INTO offers (title, description, discount_percent, min_tier, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
    [title, description || '', discount_percent, min_tier || 'both', start_date || null, end_date || null]
  );

  const newOffer = await db.get('SELECT * FROM offers WHERE id = last_insert_rowid()');
  res.json({ success: true, offer: newOffer });
});

// PUT - Admin: Update offer
app.put('/api/offers/:id', async (req, res) => {
  const { title, description, discount_percent, min_tier, start_date, end_date, is_active } = req.body;
  await db.run(
    "UPDATE offers SET title = ?, description = ?, discount_percent = ?, min_tier = ?, start_date = ?, end_date = ?, is_active = ? WHERE id = ?",
    [title, description, discount_percent, min_tier, start_date, end_date, is_active === true ? 1 : 0, req.params.id]
  );

  const updatedOffer = await db.get('SELECT * FROM offers WHERE id = ?', [req.params.id]);
  res.json({ success: true, offer: updatedOffer });
});

// DELETE - Admin: Delete offer
app.delete('/api/offers/:id', async (req, res) => {
  await db.run('UPDATE offers SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ===== API Routes - Campaigns =====

// GET all active campaigns
app.get('/api/campaigns', async (req, res) => {
  const campaigns = await db.all('SELECT * FROM campaigns WHERE is_active = 1');
  res.json({ success: true, campaigns });
});

// POST - Admin: Add new campaign
app.post('/api/campaigns', async (req, res) => {
  const { title, description, start_date, end_date } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: 'Missing required field: title' });
  }

  await db.run(
    "INSERT INTO campaigns (title, description, start_date, end_date) VALUES (?, ?, ?, ?)",
    [title, description || '', start_date || null, end_date || null]
  );

  const newCampaign = await db.get('SELECT * FROM campaigns WHERE id = last_insert_rowid()');
  res.json({ success: true, campaign: newCampaign });
});

// PUT - Admin: Update campaign
app.put('/api/campaigns/:id', async (req, res) => {
  const { title, description, start_date, end_date, is_active } = req.body;
  await db.run(
    "UPDATE campaigns SET title = ?, description = ?, start_date = ?, end_date = ?, is_active = ? WHERE id = ?",
    [title, description, start_date, end_date, is_active === true ? 1 : 0, req.params.id]
  );

  const updatedCampaign = await db.get('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
  res.json({ success: true, campaign: updatedCampaign });
});

// DELETE - Admin: Delete campaign
app.delete('/api/campaigns/:id', async (req, res) => {
  await db.run('UPDATE campaigns SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});
'''

with open('server.js', 'a') as f:
    f.write(content)
print('Part 3 - API routes written')
