const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const ejs = require('ejs');
const { giftOptions } = require('../gift-options');

const viewPath = path.join(__dirname, '..', 'views', 'index.ejs');

async function renderStorefront(data) {
  return ejs.renderFile(viewPath, { giftOptions, ...data });
}

test('renders live storefront data and safely serializes it for client-side interactions', async () => {
  const product = {
    id: 8,
    name: 'Gift </script><script>alert(1)</script>',
    tier: 'premium',
    price_tzs: 180000,
    price_usd: 72,
    description: 'Live product',
    image_url: null,
    occasions: ['souvenir']
  };
  const html = await renderStorefront({
    products: [product],
    offers: [{ id: 1, title: 'Weekend offer', description: 'Live offer', discount_percent: 15 }],
    campaigns: [{ id: 1, title: 'Seasonal campaign', description: 'Live campaign' }],
    whatsappNumber: '255712345678'
  });

  assert.match(html, /Gift &lt;\/script&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Weekend offer - Live offer/);
  assert.match(html, /Seasonal campaign: Live campaign/);
  assert.match(html, /id="filterResultCount"/);
  assert.match(html, /All Collections/);
  assert.match(html, /Give a little Tanzania\./);
  assert.match(html, /class="hero-gallery"/);
  assert.match(html, /src="\/assets\/images\/zanzibar-spice\.jpg"/);
  assert.match(html, /src="\/assets\/images\/thinking-of-you\.jpg"/);
  assert.match(html, /Photo credits/);
  assert.match(html, /visitors finding a meaningful keepsake/);
  assert.match(html, /Shop by occasion or find a Tanzania keepsake/);
  assert.match(html, /build a hamper of your own/);
  assert.match(html, /Gift wrapping/);
  assert.match(html, /Upgrade your note to a printed greeting card/);
  assert.match(html, /Gift message <span class="font-normal normal-case text-gray-500">\(free\)<\/span>/);
  assert.match(html, /id="checkoutTotalSummary"/);
  assert.match(html, /id="orderGiftWrap"/);
  assert.match(html, /id="orderCardUpgrade"/);
  assert.match(html, /href="\/assets\/styles\.css"/);
  assert.match(html, /https:\/\/wa\.me\/255712345678/);
  assert.doesNotMatch(html, /cdn\.tailwindcss\.com|255700000000/);
  assert.doesNotMatch(html, /class="tier-pill/);
  assert.match(html, /id="sortSelect"/);
  assert.ok(html.indexOf('id="gridTitle"') < html.indexOf('id="sortSelect"'));
  assert.ok(html.indexOf('id="sortSelect"') < html.indexOf('id="productsGrid"'));

  const dataBlock = html.match(/<script id="storefrontData" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(dataBlock);
  assert.equal(JSON.parse(dataBlock[1]).products[0].name, product.name);
  assert.deepEqual(JSON.parse(dataBlock[1]).products[0].occasions, ['souvenir']);
  assert.equal(JSON.parse(dataBlock[1]).whatsappNumber, '255712345678');
  assert.deepEqual(JSON.parse(dataBlock[1]).giftOptions, giftOptions);
  assert.ok(!dataBlock[1].includes('</script>'));

  const applicationScript = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(applicationScript);
  assert.doesNotThrow(() => new Function(applicationScript[1]));

  const productCardTemplate = applicationScript[1].match(
    /grid\.innerHTML = filtered\.map\(p => `([\s\S]*?)`\)\.join\(''\);/
  );
  assert.ok(productCardTemplate);
  assert.match(productCardTemplate[1], /productWhatsAppUrl\(p\)/);
  assert.match(applicationScript[1], /Array\.isArray\(p\.occasions\) && p\.occasions\.includes\(currentOccasion\)/);
  assert.match(applicationScript[1], /function setOccasionFilter\(occasion\)/);
});

test('renders the empty catalog and hides the offers ribbon when no active records exist', async () => {
  const html = await renderStorefront({ products: [], offers: [], campaigns: [], whatsappNumber: '' });
  const offersRibbon = html.match(/<div id="offersRibbon" class="([^"]*)"/);
  const emptyState = html.match(/<div id="emptyState" class="([^"]*)"/);

  assert.ok(offersRibbon);
  assert.match(offersRibbon[1], /\bhidden\b/);
  assert.ok(emptyState);
  assert.doesNotMatch(emptyState[1], /\bhidden\b/);
  assert.match(html, /build a hamper of your own/);
  assert.doesNotMatch(html, /WhatsApp help/);
});

test('keeps the Konyagi bottle fully visible in product cards', async () => {
  const html = await renderStorefront({
    products: [{
      id: 1,
      name: 'Whisky & Chill Gift for Him',
      tier: 'premium',
      price_tzs: 65000,
      price_usd: 26,
      description: '',
      image_url: '/assets/images/konyagi-gin.jpg',
      occasions: ['birthday', 'celebration']
    }],
    offers: [],
    campaigns: [],
    whatsappNumber: ''
  });

  assert.match(html, /class="product-image product-image--contain/);
});

test('does not expose WhatsApp contact links without a configured number', async () => {
  const html = await renderStorefront({
    products: [{
      id: 1,
      name: 'Local gift',
      tier: 'budget',
      price_tzs: 30000,
      price_usd: 12,
      description: '',
      image_url: null,
      occasions: []
    }],
    offers: [],
    campaigns: [],
    whatsappNumber: ''
  });
  const serverRenderedMarkup = html.split('<script id="storefrontData"')[0];

  assert.doesNotMatch(serverRenderedMarkup, /href="https:\/\/wa\.me\//);
});
