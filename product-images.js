const fallbackImage = '/assets/images/giftopia-placeholder.svg';

const productImageRules = [
  [/thinking of you/i, '/assets/images/thinking-of-you.jpg'],
  [/birthday/i, '/assets/images/birthday-hamper.jpg'],
  [/\b(whisky|konyagi)\b/i, '/assets/images/konyagi-gin.jpg'],
  [/valentine/i, '/assets/images/valentines.jpg'],
  [/anniversary/i, '/assets/images/anniversary.jpg'],
  [/\b(kilimanjaro|maasai|shuka)\b/i, '/assets/images/maasai-shuka.jpg'],
  [/\bcoffee\b/i, '/assets/images/arusha-coffee.jpg'],
  [/zanzibar/i, '/assets/images/zanzibar-spice.jpg']
];

function resolveProductImage(product) {
  const imageUrl = product.image_url;
  const isLegacyImage = typeof imageUrl === 'string'
    && /^https?:\/\/(?:images\.unsplash\.com|via\.placeholder\.com)\//i.test(imageUrl);
  const isPlaceholderImage = imageUrl === fallbackImage;

  if (imageUrl && !isLegacyImage && !isPlaceholderImage) return imageUrl;

  return productImageRules.find(([pattern]) => pattern.test(product.name))?.[1] || fallbackImage;
}

module.exports = resolveProductImage;
