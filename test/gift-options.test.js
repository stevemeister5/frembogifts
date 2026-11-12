const assert = require('node:assert/strict');
const test = require('node:test');
const { giftOptions, getGiftOptionFees, calculateOrderTotal } = require('../gift-options');

test('gift extras are optional and use the published TZS prices', () => {
  assert.deepEqual(giftOptions, {
    giftWrapFeeTzs: 5000,
    cardUpgradeFeeTzs: 3000
  });
  assert.deepEqual(getGiftOptionFees(), {
    gift_wrap: false,
    gift_wrap_fee_tzs: 0,
    card_upgrade: false,
    card_upgrade_fee_tzs: 0
  });
  assert.deepEqual(getGiftOptionFees({ gift_wrap: true, card_upgrade: true }), {
    gift_wrap: true,
    gift_wrap_fee_tzs: 5000,
    card_upgrade: true,
    card_upgrade_fee_tzs: 3000
  });
  assert.deepEqual(getGiftOptionFees({ gift_wrap: 'true', card_upgrade: 1 }), {
    gift_wrap: false,
    gift_wrap_fee_tzs: 0,
    card_upgrade: false,
    card_upgrade_fee_tzs: 0
  });
  assert.equal(calculateOrderTotal(55000, { gift_wrap: true, card_upgrade: true }).total_tzs, 63000);
  assert.equal(calculateOrderTotal(0, { gift_wrap: true }).total_tzs, 5000);
});
