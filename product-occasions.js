const productOccasions = ['birthday', 'celebration', 'gratitude', 'love', 'souvenir'];

const legacyOccasionRules = [
  [/\bbirthday\b/i, ['birthday', 'celebration']],
  [/\b(valentines?|anniversary)\b/i, ['love']],
  [/thinking of you|\bcoffee\b/i, ['gratitude']],
  [/\b(kilimanjaro|zanzibar)\b/i, ['souvenir']],
  [/\b(whisky|konyagi)\b/i, ['birthday', 'celebration']]
];

function normalizeProductOccasions(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(occasion => !productOccasions.includes(occasion))) {
    return null;
  }
  return [...new Set(value)];
}

function getProductOccasions(product, inferLegacyOccasions = false) {
  const occasions = normalizeProductOccasions(product.occasions);
  if (occasions?.length || !inferLegacyOccasions) return occasions || [];

  const name = String(product.name || '');
  return legacyOccasionRules.find(([pattern]) => pattern.test(name))?.[1] || [];
}

module.exports = { getProductOccasions, normalizeProductOccasions };
