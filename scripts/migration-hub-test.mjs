import assert from 'node:assert/strict';
import { MIGRATION_SOFTWARES, getSoftwaresByRegion, getSoftwareById } from '../src/utils/migrationGuides.js';
import { normalizeMigrationRows, buildMigrationPlan, detectEntityType, fillClientBlanks } from '../src/utils/migrationParsers.js';
import { tallyMastersToRows } from '../src/utils/tallyXml.js';
import { parseGstrJsonToPurchases } from '../src/utils/gstrImport.js';

console.log('Testing MigrationHub integration and logic...');

// 1. Check software catalog integration
assert.equal(MIGRATION_SOFTWARES.length, 11, 'Catalog has exactly 11 software definitions');
const indiaSoftwares = getSoftwaresByRegion('india');
const globalSoftwares = getSoftwaresByRegion('global');
const allSoftwares = getSoftwaresByRegion('all');

assert(indiaSoftwares.length >= 6, 'India view contains at least 6 softwares');
assert(globalSoftwares.length >= 5, 'Global view contains at least 5 softwares');
assert.equal(allSoftwares.length, 11, 'All view contains 11 softwares');

// Universal Excel is included in both India and Global
assert(indiaSoftwares.some(s => s.id === 'universal-excel'), 'Universal is in India view');
assert(globalSoftwares.some(s => s.id === 'universal-excel'), 'Universal is in Global view');

// Search query lookup
const tallyMatches = getSoftwaresByRegion('all', 'tally');
assert.equal(tallyMatches.length, 1, 'Search for tally returns Tally Prime');
assert.equal(tallyMatches[0].id, 'tally-prime');

const qbMatches = getSoftwaresByRegion('all', 'quickbooks');
assert.equal(qbMatches.length, 1, 'Search for quickbooks returns QuickBooks');

// 2. Test Tally Masters XML parsing in MigrationHub flow
const sampleTallyXml = `<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Apex Enterprises Pvt Ltd" RESERVEDNAME="">
            <PARENT>Sundry Debtors</PARENT>
            <PARTYGSTIN>27AAAAA0000A1Z5</PARTYGSTIN>
            <LEDGERMOBILE>9820012345</LEDGERMOBILE>
            <EMAIL>accounts@apexenterprises.example</EMAIL>
            <LEDSTATENAME>Maharashtra</LEDSTATENAME>
            <ADDRESS.LIST>
              <ADDRESS>Plot 12, Commercial Hub</ADDRESS>
              <ADDRESS>Andheri East, Mumbai</ADDRESS>
            </ADDRESS.LIST>
            <PINCODE>400069</PINCODE>
          </LEDGER>
          <STOCKITEM NAME="Industrial Ball Bearing 6205" RESERVEDNAME="">
            <BASEUNITS>Nos</BASEUNITS>
            <OPENINGRATE>180.00</OPENINGRATE>
            <STANDARDPRICELIST.LIST>
              <RATE>240.00</RATE>
            </STANDARDPRICELIST.LIST>
            <GSTDETAILS.LIST>
              <APPLICABLEFROM>20240401</APPLICABLEFROM>
              <HSNCODE>8482</HSNCODE>
              <TAXABILITY>Taxable</TAXABILITY>
              <RATEDETAILS.LIST>
                <GSTRATEDUTYHEAD>Integrated Tax</GSTRATEDUTYHEAD>
                <GSTRATE>18</GSTRATE>
              </RATEDETAILS.LIST>
            </GSTDETAILS.LIST>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

const tallyParsed = tallyMastersToRows(sampleTallyXml);
assert(tallyParsed.clients.length >= 2, 'Tally XML parsed client rows');
assert(tallyParsed.products.length >= 2, 'Tally XML parsed product rows');

// Test normalizing Tally client rows
const normTallyClients = normalizeMigrationRows(tallyParsed.clients, 'tally-prime', 'clients');
assert.equal(normTallyClients.validCount, 1, '1 valid client in Tally XML');
assert.equal(normTallyClients.valid[0].name, 'Apex Enterprises Pvt Ltd');
assert.equal(normTallyClients.valid[0].gstin, '27AAAAA0000A1Z5');

// Test scorecard plan for Tally clients
const existingClients = [{ name: 'Existing Firm', gstin: '27XXXXX0000X1Z1' }];
const clientPlan = buildMigrationPlan(normTallyClients, { clients: existingClients });
assert.equal(clientPlan.scorecard.readyToAdd, 1, '1 new client ready to add');
assert.equal(clientPlan.scorecard.readyToUpdate, 0, '0 clients to update');

// 3. Test GSTR-2B JSON parsing in MigrationHub flow
const sampleGstrJson = JSON.stringify({
  gstin: '27AAAAA0000A1Z5',
  fp: '102026',
  data: {
    b2b: [
      {
        ctin: '29BBBBB1111B1Z2',
        trdnm: 'Global Industrial Suppliers',
        inv: [
          {
            inum: 'INV-2026-904',
            idt: '10-10-2026',
            val: 28320,
            pos: '27',
            itms: [
              {
                num: 1,
                itm_det: {
                  txval: 24000,
                  rt: 18,
                  cgst: 0,
                  sgst: 0,
                  igst: 4320,
                  cess: 0
                }
              }
            ]
          }
        ]
      }
    ]
  }
});

const gstrResult = parseGstrJsonToPurchases(sampleGstrJson, {
  existingPurchases: [],
  profile: { gstin: '27AAAAA0000A1Z5', businessName: 'My Business' },
});
assert.equal(gstrResult.toImport.length, 1, '1 purchase invoice ready from GSTR JSON');
assert.equal(gstrResult.toImport[0].invoiceNumber, 'INV-2026-904');
assert.equal(gstrResult.toImport[0].totalAmount, 28320);

// 4. Test Universal CSV / Excel normalizing & scorecard for clients (blank filling)
const clientCsvRows = [
  ['Customer Name', 'GSTIN', 'Phone Numbers', 'Email Address', 'Billing Address', 'State'],
  ['Apex Enterprises Pvt Ltd', '27AAAAA0000A1Z5', '9820012345', 'info@apex.example', 'Plot 12, Mumbai', 'Maharashtra'],
  ['Existing Firm', '27XXXXX0000X1Z1', '9899000000', 'newmail@firm.example', 'New Address 42', 'Maharashtra'],
];

const normClients = normalizeMigrationRows(clientCsvRows, 'universal', 'clients');
assert.equal(normClients.validCount, 2, '2 valid clients in CSV');

const planWithUpdate = buildMigrationPlan(normClients, {
  clients: [
    { name: 'Existing Firm', gstin: '27XXXXX0000X1Z1', phone: '' }, // has blank phone & email
  ],
});
assert.equal(planWithUpdate.scorecard.readyToAdd, 1, 'Apex is ready to add');
assert.equal(planWithUpdate.scorecard.readyToUpdate, 1, 'Existing Firm is ready to update blanks');
assert.equal(planWithUpdate.updatedItems[0].phone, '9899000000', 'Blank phone filled');
assert.equal(planWithUpdate.updatedItems[0].email, 'newmail@firm.example', 'Blank email filled');

// 5. Test Product migration plan and stock adjustment
const productCsvRows = [
  ['Item Name', 'HSN/SAC', 'Unit Price', 'Cost Price', 'Tax Rate', 'Opening Stock'],
  ['Industrial Ball Bearing 6205', '8482', '240', '180', '18%', '50'],
  ['Existing Tool', '8203', '500', '350', '18%', '20'],
];

const normProducts = normalizeMigrationRows(productCsvRows, 'universal', 'products');
assert.equal(normProducts.validCount, 2);

const productPlan = buildMigrationPlan(normProducts, {
  products: [{ name: 'Existing Tool', sellingPrice: 500, stock: 10, hsn: '8203' }],
  opts: { adjustStock: true },
});
assert.equal(productPlan.scorecard.readyToAdd, 1, 'Bearing is new');
assert.equal(productPlan.scorecard.readyToUpdate, 1, 'Existing Tool has stock updated');
assert.equal(productPlan.updatedItems[0].stock, 30, 'Stock adjusted (10 + 20 = 30)');

console.log('✓ MigrationHub test suite passed all integration checks!');
