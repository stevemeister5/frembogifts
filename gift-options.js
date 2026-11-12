const giftOptions = Object.freeze({
  giftWrapFeeTzs: 5000,
  cardUpgradeFeeTzs: 3000
});

function getGiftOptionFees(options = {}) {
  const giftWrap = options.gift_wrap === true;
  const cardUpgrade = options.card_upgrade === true;

  return {
    gift_wrap: giftWrap,
    gift_wrap_fee_tzs: giftWrap ? giftOptions.giftWrapFeeTzs : 0,
    card_upgrade: cardUpgrade,
    card_upgrade_fee_tzs: cardUpgrade ? giftOptions.cardUpgradeFeeTzs : 0
  };
}

function calculateOrderTotal(baseTotalTzs, options = {}) {
  const fees = getGiftOptionFees(options);
  return {
    ...fees,
    total_tzs: Math.max(0, Math.round(Number(baseTotalTzs) || 0))
      + fees.gift_wrap_fee_tzs
      + fees.card_upgrade_fee_tzs
  };
}

module.exports = { giftOptions, getGiftOptionFees, calculateOrderTotal };
