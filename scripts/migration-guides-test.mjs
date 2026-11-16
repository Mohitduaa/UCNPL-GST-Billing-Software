import assert from 'node:assert/strict';
import { MIGRATION_SOFTWARES, getSoftwaresByRegion, getSoftwareById } from '../src/utils/migrationGuides.js';

console.log('Testing migration guides catalog...');

assert.equal(MIGRATION_SOFTWARES.length, 11, 'Must have exactly 11 software definitions');

// Check required fields for every software
for (const sw of MIGRATION_SOFTWARES) {
  assert.ok(sw.id, `Software missing id: ${JSON.stringify(sw)}`);
  assert.ok(sw.name, `Software ${sw.id} missing name`);
  assert.ok(['india', 'global', 'all'].includes(sw.region), `Software ${sw.id} invalid region: ${sw.region}`);
  assert.ok(Array.isArray(sw.extensions) && sw.extensions.length > 0, `Software ${sw.id} missing extensions`);
  assert.ok(Array.isArray(sw.steps) && sw.steps.length >= 3, `Software ${sw.id} must have at least 3 steps`);
  assert.ok(Array.isArray(sw.capabilities) && sw.capabilities.length > 0, `Software ${sw.id} missing capabilities`);
}

// Test filtering by region
const indiaList = getSoftwaresByRegion('india');
assert.ok(indiaList.some(s => s.id === 'tally-prime'), 'India list must contain Tally Prime');
assert.ok(indiaList.some(s => s.id === 'busy'), 'India list must contain Busy');
assert.ok(indiaList.some(s => s.id === 'vyapar'), 'India list must contain Vyapar');
assert.ok(indiaList.some(s => s.id === 'mybillbook'), 'India list must contain myBillBook');
assert.ok(indiaList.some(s => s.id === 'marg'), 'India list must contain Marg');
assert.ok(indiaList.some(s => s.id === 'gst-portal'), 'India list must contain GST Portal');
assert.ok(indiaList.some(s => s.id === 'universal-excel'), 'India list should include Universal Excel');

const globalList = getSoftwaresByRegion('global');
assert.ok(globalList.some(s => s.id === 'quickbooks'), 'Global list must contain QuickBooks');
assert.ok(globalList.some(s => s.id === 'xero'), 'Global list must contain Xero');
assert.ok(globalList.some(s => s.id === 'zoho-books'), 'Global list must contain Zoho Books');
assert.ok(globalList.some(s => s.id === 'wave'), 'Global list must contain Wave');
assert.ok(globalList.some(s => s.id === 'universal-excel'), 'Global list should include Universal Excel');

// Test all region
const allList = getSoftwaresByRegion('all');
assert.equal(allList.length, 11, 'All list must contain 11 softwares');

// Test search filter
const searchResult = getSoftwaresByRegion('all', 'tally');
assert.equal(searchResult.length, 1);
assert.equal(searchResult[0].id, 'tally-prime');

const searchResultUpper = getSoftwaresByRegion('all', 'EXCEL');
assert.ok(searchResultUpper.some(s => s.id === 'universal-excel'));

// Test getSoftwareById
const tally = getSoftwareById('tally-prime');
assert.equal(tally?.id, 'tally-prime');
assert.equal(tally?.name, 'Tally Prime / Tally.ERP 9');

const qb = getSoftwareById('quickbooks');
assert.equal(qb?.id, 'quickbooks');

const nonExistent = getSoftwareById('non-existent-software');
assert.equal(nonExistent, null);

console.log('✓ Migration guides catalog passed all checks!');
