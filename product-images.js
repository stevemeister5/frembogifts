const fallbackImage = '/assets/images/giftopia-placeholder.svg';

const productImageRules = [
  [/thinking of you/i, '/assets/images/thinking-of-you.jpg'],
  [/birthday/i, '/assets/images/birthday-hamper.jpg'],
  [/whisky/i, fallbackImage],
  [/valentine/i, '/assets/images/valentines.jpg'],
  [/anniversary/i, '/assets/images/anniversary.jpg'],
  [/kilimanjaro/i, fallbackImage],
  [/coffee/i, fallbackImage],
  [/zanzibar/i, '/assets/images/zanzibar-spice.jpg']
];

function resolveProductImage(product) {
  const imageUrl = product.image_url;
  const isLegacyImage = typeof imageUrl === 'string'
    && /^https?:\/\/(?:images\.unsplash\.com|via\.placeholder\.com)\//i.test(imageUrl);

  if (imageUrl && !isLegacyImage) return imageUrl;

  return productImageRules.find(([pattern]) => pattern.test(product.name))?.[1] || fallbackImage;
}

module.exports = resolveProductImage;
