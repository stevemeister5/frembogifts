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
