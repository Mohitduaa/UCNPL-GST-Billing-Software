import assert from 'assert';
import {
  toBaseQuantity,
  toSecondaryQuantity,
  getEffectiveItemRate,
  formatDualStock,
  hasAlternateUnit
} from '../src/utils/units.js';
import { stockEffect } from '../src/utils.js';

console.log('Testing Multi-Unit & Alternate Unit Engine...\n');

// 1. toBaseQuantity
console.log('1. toBaseQuantity()');
{
  const product = { unit: 'Pcs', secondaryUnit: 'Box', conversionFactor: 12 };
  assert.strictEqual(toBaseQuantity(2, 'Box', product), 24);
  assert.strictEqual(toBaseQuantity(5, 'Pcs', product), 5);
  assert.strictEqual(toBaseQuantity(1.5, 'Box', product), 18);
  console.log('   ✓ Base quantity conversion passed');
}

// 2. toSecondaryQuantity
console.log('2. toSecondaryQuantity()');
{
  const product = { unit: 'Pcs', secondaryUnit: 'Box', conversionFactor: 12 };
  const res1 = toSecondaryQuantity(26, product);
  assert.strictEqual(res1.secondaryQty, 2);
  assert.strictEqual(res1.remainderBaseQty, 2);
  assert.strictEqual(res1.formatted, '2 Box 2 Pcs');

  const res2 = toSecondaryQuantity(24, product);
  assert.strictEqual(res2.secondaryQty, 2);
  assert.strictEqual(res2.remainderBaseQty, 0);
  assert.strictEqual(res2.formatted, '2 Box');

  const res3 = toSecondaryQuantity(5, product);
  assert.strictEqual(res3.secondaryQty, 0);
  assert.strictEqual(res3.remainderBaseQty, 5);
  assert.strictEqual(res3.formatted, '5 Pcs');
  console.log('   ✓ Secondary quantity breakdown & formatting passed');
}

// 3. getEffectiveItemRate
console.log('3. getEffectiveItemRate()');
{
  const productWithCustomRate = {
    sellingPrice: 10,
    unit: 'Pcs',
    secondaryUnit: 'Box',
    conversionFactor: 10,
    secondaryRate: 95 // wholesale discount for box
  };
  assert.strictEqual(getEffectiveItemRate(productWithCustomRate, 'Pcs'), 10);
  assert.strictEqual(getEffectiveItemRate(productWithCustomRate, 'Box'), 95);

  const productDefaultRate = {
    sellingPrice: 10,
    unit: 'Pcs',
    secondaryUnit: 'Box',
    conversionFactor: 10
  };
  assert.strictEqual(getEffectiveItemRate(productDefaultRate, 'Box'), 100);
  console.log('   ✓ Effective rate scaling passed');
}

// 4. formatDualStock
console.log('4. formatDualStock()');
{
  const product = { unit: 'Pcs', secondaryUnit: 'Box', conversionFactor: 12 };
  assert.strictEqual(formatDualStock(26, product), '26 Pcs (2 Box 2 Pcs)');
  assert.strictEqual(formatDualStock(24, product), '24 Pcs (2 Box)');
  assert.strictEqual(formatDualStock(0, product), '0 Pcs');
  console.log('   ✓ Dual stock formatting passed');
}

// 5. stockEffect with alternate unit
console.log('5. stockEffect() with alternate units');
{
  const items = [
    {
      productId: 'prod-1',
      quantity: 2,
      unit: 'Box',
      selectedUnit: 'Box',
      secondaryUnit: 'Box',
      conversionFactor: 12,
      baseQuantity: 24
    },
    {
      productId: 'prod-2',
      quantity: 5,
      unit: 'Pcs',
      selectedUnit: 'Pcs'
    }
  ];

  // Regular tax invoice -> reduces stock (negative sign)
  const effect1 = stockEffect(items, 'tax-invoice', 'active');
  assert.strictEqual(effect1['prod-1'], -24); // 2 Box * 12 = 24
  assert.strictEqual(effect1['prod-2'], -5);

  // Credit note -> returns stock (positive sign)
  const effect2 = stockEffect(items, 'credit-note', 'active');
  assert.strictEqual(effect2['prod-1'], 24);
  assert.strictEqual(effect2['prod-2'], 5);

  // Cancelled invoice -> 0 effect
  const effect3 = stockEffect(items, 'tax-invoice', 'cancelled');
  assert.deepStrictEqual(effect3, {});

  console.log('   ✓ stockEffect with secondary unit deduction passed');
}

console.log('\nAll Multi-Unit & Alternate Unit tests passed successfully!');
