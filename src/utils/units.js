// src/utils/units.js
// Multi-Unit / Alternate Unit & Packaging Conversion Engine

export function hasAlternateUnit(product) {
  return Boolean(
    product?.secondaryUnit &&
    String(product.secondaryUnit).trim() &&
    Number(product?.conversionFactor) > 0
  );
}

/**
 * Converts a quantity from the chosen unit (e.g. Box) to the base/primary unit (e.g. Pcs)
 */
export function toBaseQuantity(quantity, selectedUnit, product) {
  const q = Number(quantity) || 0;
  if (!selectedUnit || !product || !hasAlternateUnit(product)) {
    return q;
  }

  const cleanSelected = String(selectedUnit).trim().toLowerCase();
  const cleanSecondary = String(product.secondaryUnit).trim().toLowerCase();

  if (cleanSelected === cleanSecondary) {
    const factor = Number(product.conversionFactor) || 1;
    return Math.round(q * factor * 1000) / 1000;
  }

  return q;
}

/**
 * Breaks down a base unit quantity into secondary units and remainder base units
 */
export function toSecondaryQuantity(baseQuantity, product) {
  const baseQty = Number(baseQuantity) || 0;
  const primaryUnit = product?.unit || 'Pcs';

  if (!product || !hasAlternateUnit(product)) {
    return {
      secondaryQty: 0,
      remainderBaseQty: baseQty,
      formatted: `${baseQty} ${primaryUnit}`.trim(),
    };
  }

  const factor = Number(product.conversionFactor) || 1;
  const secondaryUnit = product.secondaryUnit;

  const rawRatio = factor > 0 ? baseQty / factor : 0;
  // Guard against IEEE-754 precision artifacts (e.g. 1 / 0.25 = 3.9999999999999996 or 0.6 / 0.2 = 2.9999999999999996)
  const secondaryQty = Math.floor(Math.round(rawRatio * 1e6) / 1e6);
  const remainderBaseQty = Math.round(Math.max(0, baseQty - secondaryQty * factor) * 1000) / 1000;

  let formatted = '';
  if (secondaryQty > 0 && remainderBaseQty > 0) {
    formatted = `${secondaryQty} ${secondaryUnit} ${remainderBaseQty} ${primaryUnit}`;
  } else if (secondaryQty > 0) {
    formatted = `${secondaryQty} ${secondaryUnit}`;
  } else {
    formatted = `${remainderBaseQty} ${primaryUnit}`;
  }

  return {
    secondaryQty,
    remainderBaseQty,
    formatted,
  };
}

/**
 * Calculates the selling rate for the selected unit (primary vs secondary)
 * Supports both signatures: (rate, selectedUnit, product) and (product, selectedUnit)
 */
export function getEffectiveItemRate(rateOrProduct, selectedUnit, optionalProduct) {
  let baseRate = 0;
  let product = optionalProduct;

  if (rateOrProduct && typeof rateOrProduct === 'object') {
    product = rateOrProduct;
    baseRate = Number(product.sellingPrice ?? product.rate ?? 0);
  } else {
    baseRate = Number(rateOrProduct) || 0;
  }

  if (!selectedUnit || !product || !hasAlternateUnit(product)) {
    return baseRate;
  }

  const cleanSelected = String(selectedUnit).trim().toLowerCase();
  const cleanSecondary = String(product.secondaryUnit).trim().toLowerCase();

  if (cleanSelected === cleanSecondary) {
    if (Number(product.secondaryRate) > 0) {
      return Number(product.secondaryRate);
    }
    const factor = Number(product.conversionFactor) || 1;
    return Math.round(baseRate * factor * 100) / 100;
  }

  return baseRate;
}

/**
 * Formats stock displaying both primary and secondary units (e.g. "120 Pcs (10 Box)")
 */
export function formatDualStock(stock, product) {
  const baseQty = Number(stock) || 0;
  const primaryUnit = product?.unit || 'Nos';

  if (!product || !hasAlternateUnit(product)) {
    return `${baseQty} ${primaryUnit}`;
  }

  const sec = toSecondaryQuantity(baseQty, product);
  if (sec.secondaryQty > 0) {
    return `${baseQty} ${primaryUnit} (${sec.formatted})`;
  }

  return `${baseQty} ${primaryUnit}`;
}
