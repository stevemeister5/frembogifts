const assert = require('node:assert/strict');
const test = require('node:test');

const resolveProductImage = require('../product-images');

test('resolves legacy product photos to matching local images', () => {
  assert.equal(
    resolveProductImage({
      name: 'Zanzibar Spice & Stone',
      image_url: 'https://images.unsplash.com/photo-123?auto=format'
    }),
    '/assets/images/zanzibar-spice.jpg'
  );
  assert.equal(
    resolveProductImage({
      name: 'Thinking of You Bouquet',
      image_url: 'http://images.unsplash.com/photo-456'
    }),
    '/assets/images/thinking-of-you.jpg'
  );
  assert.equal(
    resolveProductImage({
      name: 'Kakakuwe Coffee',
      image_url: 'https://via.placeholder.com/400x250?text=Product+Image'
    }),
    '/assets/images/arusha-coffee.jpg'
  );
  assert.equal(
    resolveProductImage({
      name: 'Maasai Beadwork Keepsake',
      image_url: null
    }),
    '/assets/images/maasai-beadwork.jpg'
  );
  assert.equal(
    resolveProductImage({
      name: 'Roasted Cashew Snack Pouch',
      image_url: null
    }),
    '/assets/images/cashew-nuts.jpg'
  );
  assert.equal(
    resolveProductImage({
      name: 'Kilimanjaro Sunset',
      image_url: '/assets/images/giftopia-placeholder.svg'
    }),
    '/assets/images/maasai-shuka.jpg'
  );
  assert.equal(
    resolveProductImage({
      name: 'Whisky & Chill Gift for Him',
      image_url: '/assets/images/giftopia-placeholder.svg'
    }),
    '/assets/images/konyagi-gin.jpg'
  );
});

test('preserves local and custom product image URLs', () => {
  assert.equal(
    resolveProductImage({ name: 'Custom gift', image_url: '/assets/images/custom.jpg' }),
    '/assets/images/custom.jpg'
  );
  assert.equal(
    resolveProductImage({ name: 'Custom gift', image_url: 'https://cdn.example.com/custom.jpg' }),
    'https://cdn.example.com/custom.jpg'
  );
});

test('uses the local placeholder when no matching image is available', () => {
  assert.equal(
    resolveProductImage({ name: 'Unlisted gift', image_url: null }),
    '/assets/images/giftopia-placeholder.svg'
  );
});
