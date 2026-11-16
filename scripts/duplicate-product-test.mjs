import assert from 'node:assert/strict';
import {
  findDuplicateProduct,
  formatDuplicateProductDetails,
  calculateUpdatedStock,
  reconcilePurchaseProducts,
} from '../src/utils/products.js';

console.log('Testing Issue #199: Duplicate Product Detection in Purchase Module...\n');

// Mock existing inventory
const sampleProducts = [
  {
    id: 'prod_samsung_s24',
    name: 'Samsung Galaxy S24 Ultra',
    brand: 'Samsung',
    modelNumber: 'SM-S928B',
    barcode: '8806095312345',
    sku: 'SAM-S24U-256',
    stock: 12,
    unit: 'Pcs',
    purchasePrice: 95000,
    sellingPrice: 129999,
    taxPercent: 18,
    hsn: '8517',
  },
  {
    id: 'prod_hp_laptop',
    name: 'HP Pavilion 15',
    brand: 'HP',
    modelNumber: '15-eg3000',
    barcode: '196548721345',
    sku: 'HP-PAV-15',
    stock: 5,
    unit: 'Nos',
    purchasePrice: 52000,
    sellingPrice: 65000,
    taxPercent: 18,
    hsn: '8471',
  },
  {
    id: 'prod_unbranded_cable',
    name: 'USB-C Fast Charging Cable',
    brand: '',
    modelNumber: '',
    barcode: '',
    sku: '',
    stock: 50,
    unit: 'Nos',
    purchasePrice: 120,
    sellingPrice: 299,
    taxPercent: 18,
    hsn: '8544',
  },
];

// 1. Detection by exact name (case-insensitive and trimmed)
{
  const item = { name: '  samsung galaxy s24 ultra  ', quantity: 5, rate: 94000 };
  const result = findDuplicateProduct(item, sampleProducts);
  assert.equal(result.isDuplicate, true, 'Should detect duplicate by lowercase trimmed name');
  assert.equal(result.existingProduct.id, 'prod_samsung_s24');
  assert.equal(result.matchReason, 'name');
  console.log('✓ 1. Detects duplicate product by case-insensitive trimmed name');
}

// 2. Detection with internal whitespace differences
{
  const item = { name: 'Samsung   Galaxy    S24 Ultra', quantity: 3, rate: 94500 };
  const result = findDuplicateProduct(item, sampleProducts);
  assert.equal(result.isDuplicate, true, 'Should detect duplicate despite extra internal spaces');
  assert.equal(result.existingProduct.id, 'prod_samsung_s24');
  console.log('✓ 2. Detects duplicate product with multiple internal spaces');
}

// 3. Detection by Barcode / SKU
{
  const item = { name: 'Galaxy Phone', barcode: '8806095312345', quantity: 2, rate: 95000 };
  const result = findDuplicateProduct(item, sampleProducts);
  assert.equal(result.isDuplicate, true, 'Should detect duplicate by matching barcode');
  assert.equal(result.existingProduct.id, 'prod_samsung_s24');
  assert.equal(result.matchReason, 'barcode');

  const itemBySku = { name: 'Generic HP Laptop', sku: 'HP-PAV-15', quantity: 1, rate: 52000 };
  const skuResult = findDuplicateProduct(itemBySku, sampleProducts);
  assert.equal(skuResult.isDuplicate, true, 'Should detect duplicate by SKU');
  assert.equal(skuResult.existingProduct.id, 'prod_hp_laptop');
  assert.equal(skuResult.matchReason, 'sku');
  console.log('✓ 3. Detects duplicate product by Barcode and SKU');
}

// 4. Detection by Model Number
{
  const item = { name: 'Pavilion Laptop', modelNumber: '15-eg3000', quantity: 4, rate: 51000 };
  const result = findDuplicateProduct(item, sampleProducts);
  assert.equal(result.isDuplicate, true, 'Should detect duplicate by model number');
  assert.equal(result.existingProduct.id, 'prod_hp_laptop');
  assert.equal(result.matchReason, 'modelNumber');
  console.log('✓ 4. Detects duplicate product by Model Number');
}

// 5. Detection by explicit productId
{
  const item = { productId: 'prod_unbranded_cable', name: 'Custom Cable Name', quantity: 20, rate: 110 };
  const result = findDuplicateProduct(item, sampleProducts);
  assert.equal(result.isDuplicate, true, 'Should detect duplicate by productId');
  assert.equal(result.existingProduct.id, 'prod_unbranded_cable');
  assert.equal(result.matchReason, 'productId');
  console.log('✓ 5. Detects duplicate product by explicit productId');
}

// 6. Truly new product should NOT be flagged as duplicate
{
  const item = { name: 'Logitech MX Master 3S', barcode: '5099206085817', sku: 'LOGI-MX3S', quantity: 10, rate: 7500 };
  const result = findDuplicateProduct(item, sampleProducts);
  assert.equal(result.isDuplicate, false, 'Truly new product must not be flagged as duplicate');
  assert.equal(result.existingProduct, null);
  console.log('✓ 6. Correctly identifies new products without false duplicate positives');
}

// 7. Product details formatting for warning display
{
  const details = formatDuplicateProductDetails(sampleProducts[0]);
  assert.equal(details.name, 'Samsung Galaxy S24 Ultra');
  assert.equal(details.brand, 'Samsung');
  assert.equal(details.modelNumber, 'SM-S928B');
  assert.equal(details.sku, 'SAM-S24U-256');
  assert.equal(details.stock, 12);
  assert.equal(details.unit, 'Pcs');

  // For unbranded product without model/sku
  const unbrandedDetails = formatDuplicateProductDetails(sampleProducts[2]);
  assert.equal(unbrandedDetails.name, 'USB-C Fast Charging Cable');
  assert.equal(unbrandedDetails.brand, '—');
  assert.equal(unbrandedDetails.modelNumber, '—');
  assert.equal(unbrandedDetails.sku, '—');
  assert.equal(unbrandedDetails.stock, 50);
  assert.equal(unbrandedDetails.unit, 'Nos');
  console.log('✓ 7. Formats product details (Name, Brand, Model, SKU, Stock) accurately for UI warning');
}

// 8. Stock calculation upon purchasing existing product
{
  const currentStock = 12;
  const purchasedQty = 8;
  const updatedStock = calculateUpdatedStock(currentStock, purchasedQty);
  assert.equal(updatedStock, 20, 'Stock should be 12 + 8 = 20');
  console.log('✓ 8. Accurately calculates updated stock quantity');
}

// 9. Reconcile purchase items against inventory:
// Ensures NO duplicates created for existing products, updates their stock & cost,
// and seeds only new products.
{
  const purchaseItems = [
    // Matches existing Samsung phone (should update stock: 12 + 5 = 17, cost: 93000)
    {
      name: 'Samsung Galaxy S24 Ultra',
      quantity: 5,
      rate: 93000,
      unit: 'Pcs',
      hsn: '8517',
      taxPercent: 18,
    },
    // Matches existing HP laptop by SKU (should update stock: 5 + 3 = 8, cost: 51000)
    {
      name: 'HP Pavilion 15 Notebook',
      sku: 'HP-PAV-15',
      quantity: 3,
      rate: 51000,
      unit: 'Nos',
      hsn: '8471',
      taxPercent: 18,
    },
    // Truly new product (should be prepared for insertion with stock = 10)
    {
      name: 'Sony WH-1000XM5 Headphones',
      brand: 'Sony',
      sku: 'SONY-XM5',
      quantity: 10,
      rate: 24000,
      unit: 'Nos',
      hsn: '8518',
      taxPercent: 18,
    },
  ];

  const { productsToSave, linkedItems } = reconcilePurchaseProducts({
    items: purchaseItems,
    existingProducts: sampleProducts,
    isEdit: false,
    priorItems: [],
  });

  // Verify linked items have productId bound
  assert.equal(linkedItems[0].productId, 'prod_samsung_s24');
  assert.equal(linkedItems[1].productId, 'prod_hp_laptop');
  assert.equal(linkedItems[2].productId, undefined, 'New item has no existing productId yet');

  // Verify productsToSave contains 2 existing updates + 1 new product
  const updatedSamsung = productsToSave.find(p => p.id === 'prod_samsung_s24');
  assert.ok(updatedSamsung, 'Existing Samsung product must be in upsert list');
  assert.equal(updatedSamsung.stock, 17, 'Samsung stock should be updated from 12 to 17');
  assert.equal(updatedSamsung.purchasePrice, 93000, 'Samsung purchase price updated to latest purchase rate');
  assert.equal(updatedSamsung.sellingPrice, 129999, 'Selling price must NOT be overwritten');

  const updatedHp = productsToSave.find(p => p.id === 'prod_hp_laptop');
  assert.ok(updatedHp, 'Existing HP product must be in upsert list');
  assert.equal(updatedHp.stock, 8, 'HP stock should be updated from 5 to 8');
  assert.equal(updatedHp.purchasePrice, 51000);

  const newSony = productsToSave.find(p => p.name === 'Sony WH-1000XM5 Headphones');
  assert.ok(newSony, 'New Sony product must be created');
  assert.equal(newSony.stock, 10, 'New Sony product initial stock should be 10');
  assert.equal(newSony.id, undefined, 'New product has no id assigned before save');

  // Verify total products to save = 3 (NO duplicate samsung or hp created!)
  assert.equal(productsToSave.length, 3);

  console.log('✓ 9. reconcilePurchaseProducts prevents duplicates and correctly updates existing stock and cost');
}

console.log('\nAll Duplicate Product Detection tests passed!');
