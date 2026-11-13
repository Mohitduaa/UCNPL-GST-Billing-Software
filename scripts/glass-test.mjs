// v1.10.84 (#140) - size billing (glass, mirror): Length x Width in inches,
// rounded up to 3 or 6 inches, / 144 x pieces = square feet; amount = sq.ft x rate.
// Phase 2 (#140) - Running Feet (RFT) billing for Edge Polish, Beveling, Channels.
//
// Run: `node scripts/glass-test.mjs`

import {
  roundUpTo, sizeSqft, applySize, changeSize, sizeLabel, sizePieces, lineSqft, itemWithUnit,
  glassPerimeterRft, isGlassItem, computeRftForLine, applyRft, changeRft, recalculateRftLines, rftDescription,
} from '../src/utils/glass.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}
const amount = (i) => Math.round(i.quantity * i.rate * 100) / 100;

eq([roundUpTo(25, 6), roundUpTo(30, 6), roundUpTo(31, 6)], [30, 30, 36], '6 inch rounding goes up, an exact size stays');
eq([roundUpTo(25, 3), roundUpTo(27, 3), roundUpTo(27.5, 3)], [27, 27, 30], '3 inch rounding');
eq(roundUpTo(25.5, 0), 25.5, 'No rounding: the size as measured');

// The shop's own example: 25 x 30, Qty 2, 6 inch, Rs 50 = 12.50 SQFT, Rs 625.
const ex = applySize({ id: 'g1', name: '6mm Mirror', rate: 50 }, { l: 25, w: 30, pcs: 2, step: 6 });
eq(ex.quantity, 12.5, "The shop's example: 12.50 sq.ft");
eq(amount(ex), 625, "The shop's example: Rs 625");
eq(ex.unit, 'Sq.ft', 'The line is billed in Sq.ft (GSTR-1 unit SQF)');
eq([sizeLabel(ex.size), sizePieces(ex)], ['25 x 30', 2], 'Size printed as measured, pieces in Qty');

eq(sizeSqft({ l: 25, w: 30, pcs: 2, step: 3 }), 11.25, '3 inch: 27 x 30 / 144 x 2 = 11.25 sq.ft');
eq(sizeSqft({ l: 18, w: 24, pcs: 1, step: 0 }), 3, 'No rounding: 18 x 24 = 3 sq.ft');
eq(sizeSqft({ l: 10, w: 10, pcs: 3, step: 6 }), 3, 'Small piece: 12 x 12 x 3 = 3 sq.ft');
eq(sizeSqft({ l: 25, w: 30, pcs: 0, step: 6 }), 0, 'No pieces: 0');

// Type amount (review MEDIUM-1, -3): quantity stays the sq.ft, the amount stays put.
const on = changeSize(ex, { manual: true });
eq([on.quantity, amount(on), on.size.amount], [12.5, 625, 625], 'Ticking Type amount: still 12.50 sq.ft, amount 625 kept');
const typed = changeSize(on, { amount: 900 });
eq([typed.quantity, amount(typed)], [12.5, 900], 'Amount typed: 900, GSTR-1 and stock still see 12.50 sq.ft');
const off = changeSize(typed, { manual: false });
eq([off.quantity, amount(off)], [12.5, 900], 'Unticking keeps 900 (was multiplied by the sq.ft)');
const bigger = changeSize(off, { l: 31 });
eq(bigger.quantity, 15, 'After unticking, a new size is billed at the rate per sq.ft');
eq(applySize({ rate: 0 }, { l: '', w: '', pcs: 1, manual: true, amount: 400 }).rate, 400, 'Amount typed before any size: billed as one amount');
eq(lineSqft(on), 12.5, 'A manual line still prints its sq.ft');
eq(lineSqft({ name: 'Silicon', quantity: 5 }), null, 'A QTY line has no sq.ft');

// Switching units (review MEDIUM-2).
const plain = { id: 'p3', name: 'Floor tiles', quantity: 250, unit: 'Nos', rate: 60 };
const toSqft = itemWithUnit(plain, 'Sq.ft', { sizeOn: true, step: 6 });
eq([toSqft.quantity, amount(toSqft), sizeLabel(toSqft.size), sizePieces(toSqft)], [250, 15000, '', ''], 'Sq.ft with no size typed: the 250 stays as square feet');
eq(sizeSqft({ ...toSqft.size, sqft: 300 }), 300, 'Square feet typed directly while no size is typed');
eq(itemWithUnit(plain, 'Sq.ft').size, undefined, 'Sq.ft with size billing off: an ordinary unit');
const back = itemWithUnit(ex, 'Nos', { sizeOn: true });
eq([back.size, back.quantity, back.unit], [undefined, 2, 'Nos'], 'Back to Nos: the pieces become the quantity, size gone');
eq(itemWithUnit(toSqft, 'Nos', { sizeOn: true }).quantity, 250, 'Back to Nos with no size typed: the quantity stays');
eq(itemWithUnit(plain, 'NA').quantity, 1, 'NA: quantity held at 1');
eq(itemWithUnit(ex, 'Sq.ft', { sizeOn: true }), { ...ex, unit: 'Sq.ft' }, 'Sq.ft again on a size line: nothing changes');

// --- Phase 2 (#140) Tests: Running Feet (RFT) & Category Calculations ---

// 1. Perimeter in RFT: [2 * (Rounded L + Rounded W) / 12] * pcs
// 25 x 30, 2 pcs, step 6: (30 + 30) * 2 / 12 * 2 = 120 / 12 * 2 = 20 R.ft
eq(glassPerimeterRft(ex.size), 20, 'Perimeter 25 x 30 (6 inch rounded to 30x30), 2 pcs = 20.00 R.ft');
// 25 x 30, 2 pcs, step 3: (27 + 30) * 2 / 12 * 2 = 114 / 12 * 2 = 19 R.ft
eq(glassPerimeterRft({ l: 25, w: 30, pcs: 2, step: 3 }), 19, 'Perimeter 25 x 30 (3 inch rounded to 27x30), 2 pcs = 19.00 R.ft');
// 18 x 24, 1 pc, step 0: (18 + 24) * 2 / 12 * 1 = 84 / 12 = 7 R.ft
eq(glassPerimeterRft({ l: 18, w: 24, pcs: 1, step: 0 }), 7, 'Perimeter 18 x 24 (no rounding), 1 pc = 7.00 R.ft');

// 2. Invoice with Glass items + Polish item
const g1 = applySize({ id: 'g1', name: '6mm Clear Glass', rate: 60 }, { l: 25, w: 30, pcs: 2, step: 6 }); // 12.5 sqft, 20 R.ft
const g2 = applySize({ id: 'g2', name: '8mm Toughened Glass', rate: 100 }, { l: 18, w: 24, pcs: 1, step: 0 }); // 3 sqft, 7 R.ft
const nonGlass = { id: 'ng1', name: 'Silicone Sealant', quantity: 2, rate: 250, unit: 'Nos' };

eq(isGlassItem(g1), true, 'g1 is recognized as glass item');
eq(isGlassItem(nonGlass), false, 'nonGlass is not a glass item');

// Method 1: Perimeter, Scope: All
const polishItem = { id: 'pol1', name: 'Flat Edge Polish', rate: 15, unit: 'R.ft' };
const pol1Applied = applyRft(polishItem, { method: 'perimeter', scope: 'all' }, [g1, g2, nonGlass]);
eq([pol1Applied.unit, pol1Applied.quantity, amount(pol1Applied)], ['R.ft', 27, 405], 'All glass perimeter: 20 + 7 = 27 R.ft, Rs 15/R.ft = Rs 405');

// Method 2: SQFT-based Polish, Scope: All
const polArea = applyRft(polishItem, { method: 'sqft', scope: 'all' }, [g1, g2, nonGlass]);
eq([polArea.quantity, amount(polArea)], [15.5, 232.5], 'All glass area polish: 12.5 + 3 = 15.50 sq.ft, Rs 15 = Rs 232.50');

// Scope: Selected items only
const polSelected = applyRft(polishItem, { method: 'perimeter', scope: 'selected', selectedIds: ['g1'] }, [g1, g2, nonGlass]);
eq(polSelected.quantity, 20, 'Selected glass only (g1): 20 R.ft');

// Scope: Manual custom RFT
const polManual = applyRft(polishItem, { method: 'perimeter', scope: 'manual', manualRft: 35 }, [g1, g2, nonGlass]);
eq(polManual.quantity, 35, 'Manual RFT typed directly: 35 R.ft');

// 3. Dynamic recalculation when glass dimensions/quantities change
const invoiceItems = [g1, g2, pol1Applied, nonGlass];
// User increases g1 pieces from 2 to 4 (perimeter becomes 40 R.ft instead of 20)
const g1Updated = changeSize(g1, { pcs: 4 });
const updatedInvoice = recalculateRftLines([g1Updated, g2, pol1Applied, nonGlass]);
const updatedPolish = updatedInvoice.find(it => it.id === 'pol1');
eq(updatedPolish.quantity, 47, 'Dynamic recalc: g1 pcs 2 -> 4 updates polish from 27 to 47 R.ft (40 + 7)');

// User removes g2 from invoice
const removedG2Invoice = recalculateRftLines([g1Updated, pol1Applied, nonGlass]);
const afterRemovePolish = removedG2Invoice.find(it => it.id === 'pol1');
eq(afterRemovePolish.quantity, 40, 'Dynamic recalc: removing g2 updates polish to 40 R.ft');

// 4. Switching units between R.ft and Nos/Sq.ft
const toRft = itemWithUnit(plain, 'R.ft', { sizeOn: true, allItems: [g1] });
eq([toRft.unit, toRft.quantity, toRft.rft.qty], ['R.ft', 20, 20], 'Switching unit to R.ft auto-initializes RFT and computes 20 R.ft');
const backToNos = itemWithUnit(toRft, 'Nos', { sizeOn: true });
eq([backToNos.unit, backToNos.rft], ['Nos', undefined], 'Switching from R.ft to Nos cleans up rft field');

// 5. rftDescription labels
eq(rftDescription(pol1Applied.rft, 27), 'Edge polish · 27 R.ft (all glass items)', 'Perimeter all description');
eq(rftDescription(polArea.rft, 15.5), 'Area polish · 15.5 Sq.ft (all glass items)', 'Area polish description');
eq(rftDescription(polSelected.rft, 20), 'Edge polish · 20 R.ft (1 selected item)', 'Selected description');
eq(rftDescription(polManual.rft, 35), 'Edge polish · 35 R.ft (manual)', 'Manual description');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
