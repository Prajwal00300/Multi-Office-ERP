/**
 * Weighbridge Calculation Service.
 * Centralizes net weight calculation, unit standardization,
 * and expected weight extraction from Bills and Estimates.
 */

const WEIGHT_UNITS = {
  KG: ['kg', 'kgs', 'kilogram', 'kilograms'],
  TON: ['ton', 'tons', 'mt', 'metric ton', 'metric tons'],
  QUINTAL: ['quintal', 'quintals', 'qtl']
};

/**
 * Standardizes a unit string to canonical key: 'Kg', 'Ton', 'Quintal', or null if non-weight.
 * @param {string} rawUnit
 * @returns {string|null}
 */
const standardizeWeightUnit = (rawUnit) => {
  if (!rawUnit || typeof rawUnit !== 'string') return null;
  const lower = rawUnit.trim().toLowerCase();

  for (const alias of WEIGHT_UNITS.KG) {
    if (lower === alias) return 'Kg';
  }
  for (const alias of WEIGHT_UNITS.TON) {
    if (lower === alias) return 'Ton';
  }
  for (const alias of WEIGHT_UNITS.QUINTAL) {
    if (lower === alias) return 'Quintal';
  }

  return null; // Not a compatible weight unit (e.g. Piece, Bundle, Meter)
};

/**
 * Converts a weight value to kilograms (Kg) for consistent mathematical comparison.
 * @param {number} value
 * @param {string} unit
 * @returns {number|null}
 */
const convertToKg = (value, unit) => {
  const num = parseFloat(value);
  if (isNaN(num)) return null;

  const std = standardizeWeightUnit(unit);
  if (!std) return null;

  if (std === 'Kg') return num;
  if (std === 'Ton') return num * 1000;
  if (std === 'Quintal') return num * 100;

  return null;
};

/**
 * Calculates Net Goods Weight: Gross Weight - Tare Weight.
 * @param {number} gross
 * @param {number} tare
 * @returns {number}
 */
const calculateNetWeight = (gross, tare) => {
  const g = parseFloat(gross) || 0;
  const t = parseFloat(tare) || 0;
  const net = Math.max(0, g - t);
  return Math.round((net + Number.EPSILON) * 1000) / 1000;
};

/**
 * Extracts and sums expected goods weight from line items of a Bill or Estimate.
 * Strictly adheres to rule: Do not assume product quantity automatically represents weight.
 * If any line item is in non-weight units (e.g. Piece, Bundle, Meter), expected weight is unavailable.
 *
 * @param {Array<Object>} items
 * @param {string} targetUnit - Default 'Kg'
 * @returns {Object} { expectedWeight: number|null, unit: string, isAvailable: boolean, reason: string|null }
 */
const extractExpectedWeight = (items, targetUnit = 'Kg') => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      expectedWeight: null,
      unit: targetUnit,
      isAvailable: false,
      reason: 'Expected weight unavailable — transaction contains no line items.'
    };
  }

  let totalKg = 0;
  const nonWeightItems = [];

  for (let i = 0; i < items.length; i++) {
    const itm = items[i];
    const stdUnit = standardizeWeightUnit(itm.unit);

    if (!stdUnit) {
      nonWeightItems.push(`Item #${i + 1} (${itm.productNameSnapshot || 'Item'} - unit: ${itm.unit || 'N/A'})`);
      continue;
    }

    const itemKg = convertToKg(itm.quantity, stdUnit);
    if (itemKg !== null) {
      totalKg += itemKg;
    } else {
      nonWeightItems.push(`Item #${i + 1} (${itm.productNameSnapshot || 'Item'} - invalid quantity)`);
    }
  }

  if (nonWeightItems.length > 0) {
    return {
      expectedWeight: null,
      unit: targetUnit,
      isAvailable: false,
      reason: `Expected weight unavailable — manual verification required (${nonWeightItems.length} item(s) measured in non-weight units: ${nonWeightItems.join(', ')}).`
    };
  }

  const roundedKg = Math.round((totalKg + Number.EPSILON) * 1000) / 1000;

  if (targetUnit.toLowerCase() === 'ton') {
    return {
      expectedWeight: Math.round(((roundedKg / 1000) + Number.EPSILON) * 1000) / 1000,
      unit: 'Ton',
      isAvailable: true,
      reason: null
    };
  }

  return {
    expectedWeight: roundedKg,
    unit: 'Kg',
    isAvailable: true,
    reason: null
  };
};

/**
 * Calculates weight difference: Actual Net Weight - Expected Weight.
 * Both weights are standardized to Kg before comparison.
 *
 * @param {number} actualNetWeight
 * @param {string} actualUnit
 * @param {number|null} expectedWeight
 * @param {string} expectedUnit
 * @returns {number|null} Difference in actualUnit, or null if expectedWeight is unavailable
 */
const calculateWeightDifference = (actualNetWeight, actualUnit = 'Kg', expectedWeight, expectedUnit = 'Kg') => {
  if (expectedWeight === null || expectedWeight === undefined) {
    return null;
  }

  const actualKg = convertToKg(actualNetWeight, actualUnit);
  const expectedKg = convertToKg(expectedWeight, expectedUnit);

  if (actualKg === null || expectedKg === null) {
    return null;
  }

  const diffKg = actualKg - expectedKg;
  const roundedDiffKg = Math.round((diffKg + Number.EPSILON) * 1000) / 1000;

  if (standardizeWeightUnit(actualUnit) === 'Ton') {
    return Math.round(((roundedDiffKg / 1000) + Number.EPSILON) * 1000) / 1000;
  }

  return roundedDiffKg;
};

module.exports = {
  standardizeWeightUnit,
  convertToKg,
  calculateNetWeight,
  extractExpectedWeight,
  calculateWeightDifference
};
