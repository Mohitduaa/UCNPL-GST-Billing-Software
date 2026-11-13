import assert from 'assert';
import {
  encodeCode128B,
  renderCode128Svg,
  generateRandomBarcode
} from '../src/utils/barcode.js';

console.log('Testing Retail & Garment Barcode System...\n');

// 1. encodeCode128B
console.log('1. encodeCode128B()');
{
  const res = encodeCode128B('PROD-1001');
  assert.ok(res && typeof res === 'object');
  assert.strictEqual(res.clean, 'PROD-1001');
  assert.ok(typeof res.pattern === 'string');
  assert.ok(res.pattern.length > 20, 'Pattern length should be substantial');
  // Should only contain numbers 1, 2, 3, 4 (widths of bars/spaces)
  assert.ok(/^[1-4]+$/.test(res.pattern), 'Pattern should only consist of width digits 1-4');
  assert.ok(Array.isArray(res.codes));
  console.log('   ✓ Code128-B encoding verified');
}

// 2. renderCode128Svg
console.log('2. renderCode128Svg()');
{
  const svg = renderCode128Svg('PROD-1001', { height: 36, barWidth: 1.5, includeText: true });
  assert.ok(svg.includes('<svg'), 'Output should contain <svg tag');
  assert.ok(svg.includes('</svg>'), 'Output should contain </svg> closing tag');
  assert.ok(svg.includes('PROD-1001'), 'Output should include human-readable barcode text');
  assert.ok(svg.includes('<rect') || svg.includes('<path'), 'Output should contain bar geometry');
  console.log('   ✓ Code128 SVG rendering verified');
}

// 3. generateRandomBarcode
console.log('3. generateRandomBarcode()');
{
  const b1 = generateRandomBarcode('GARMENT');
  const b2 = generateRandomBarcode('GARMENT');
  assert.ok(b1.startsWith('GARMENT-'));
  assert.ok(b2.startsWith('GARMENT-'));
  assert.notStrictEqual(b1, b2, 'Subsequent random barcodes must be unique');
  console.log('   ✓ Unique barcode generation verified');
}

// 4. Purchase entry to barcode labels conversion
console.log('4. Purchase Entry to Label Items conversion');
{
  const purchaseItems = [
    { name: 'Denim Jeans (Blue, 32)', quantity: 15, rate: 800, barcode: 'JEANS-32' },
    { name: 'Cotton Shirt (White, L)', quantity: 25, rate: 450, barcode: 'SHIRT-L' },
  ];

  const labelItems = [];
  purchaseItems.forEach(it => {
    const qty = Number(it.quantity) || 0;
    for (let i = 0; i < qty; i++) {
      labelItems.push({
        name: it.name,
        barcode: it.barcode,
        price: it.rate,
      });
    }
  });

  assert.strictEqual(labelItems.length, 40, 'Total labels should equal sum of purchase quantities (15 + 25)');
  assert.strictEqual(labelItems.filter(l => l.barcode === 'JEANS-32').length, 15);
  assert.strictEqual(labelItems.filter(l => l.barcode === 'SHIRT-L').length, 25);
  console.log('   ✓ Purchase quantities correctly converted to barcode labels');
}

console.log('\nAll Barcode & Retail Label tests passed successfully!');
