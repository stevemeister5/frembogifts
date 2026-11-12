const assert = require('node:assert/strict');
const test = require('node:test');

const { getProductOccasions, normalizeProductOccasions } = require('../product-occasions');

test('normalizes stored occasion JSON and removes duplicate tags', () => {
  assert.deepEqual(normalizeProductOccasions('["birthday","celebration","birthday"]'), [
    'birthday',
    'celebration'
  ]);
});

test('supplies legacy tags for known catalog products with no stored tags', () => {
  const legacyProducts = [
    ['Thinking of You Bouquet', ['gratitude']],
    ['Birthday Celebration Hamper', ['birthday', 'celebration']],
    ['Whisky & Chill Gift for Him', ['birthday', 'celebration']],
    ['Konyagi Gin Gift Set', ['birthday', 'celebration']],
    ['Valentines Day Premium', ['love']],
    ['Anniversary Romantic Package', ['love']],
    ['Kilimanjaro Sunset', ['souvenir']],
    ['Kakakuwe Coffee', ['gratitude']],
    ['Zanzibar Spice & Stone', ['souvenir']]
  ];

  for (const [name, expected] of legacyProducts) {
    assert.deepEqual(getProductOccasions({ name, occasions: '[]' }, true), expected, name);
  }
});

test('preserves explicit tags and leaves unknown products untagged', () => {
  assert.deepEqual(
    getProductOccasions({ name: 'Birthday Gift', occasions: ['souvenir'] }, true),
    ['souvenir']
  );
  assert.deepEqual(
    getProductOccasions({ name: 'New Product', occasions: [] }, true),
    []
  );
});
