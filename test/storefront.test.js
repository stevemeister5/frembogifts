const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const ejs = require('ejs');

const viewPath = path.join(__dirname, '..', 'views', 'index.ejs');

async function renderStorefront(data) {
  return ejs.renderFile(viewPath, data);
}

test('renders live storefront data and safely serializes it for client-side interactions', async () => {
  const product = {
    id: 8,
    name: 'Gift </script><script>alert(1)</script>',
    tier: 'premium',
    price_tzs: 180000,
    price_usd: 72,
    description: 'Live product',
    image_url: null
  };
  const html = await renderStorefront({
    products: [product],
    offers: [{ id: 1, title: 'Weekend offer', description: 'Live offer', discount_percent: 15 }],
    campaigns: [{ id: 1, title: 'Seasonal campaign', description: 'Live campaign' }]
  });

  assert.match(html, /Gift &lt;\/script&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Weekend offer - Live offer/);
  assert.match(html, /Seasonal campaign: Live campaign/);
  assert.match(html, /id="filterResultCount"/);

  const dataBlock = html.match(/<script id="storefrontData" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(dataBlock);
  assert.equal(JSON.parse(dataBlock[1]).products[0].name, product.name);
  assert.ok(!dataBlock[1].includes('</script>'));

  const applicationScript = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(applicationScript);
  assert.doesNotThrow(() => new Function(applicationScript[1]));
});

test('renders the empty catalog and hides the offers ribbon when no active records exist', async () => {
  const html = await renderStorefront({ products: [], offers: [], campaigns: [] });
  const offersRibbon = html.match(/<div id="offersRibbon" class="([^"]*)"/);
  const emptyState = html.match(/<div id="emptyState" class="([^"]*)"/);

  assert.ok(offersRibbon);
  assert.match(offersRibbon[1], /\bhidden\b/);
  assert.ok(emptyState);
  assert.doesNotMatch(emptyState[1], /\bhidden\b/);
  assert.match(html, /Same-day delivery in Dar es Salaam/);
});
