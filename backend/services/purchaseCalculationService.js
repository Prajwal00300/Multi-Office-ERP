/**
 * Purchase Calculation Service
 * 
 * Centralizes all mathematical and financial calculations for the Purchase module.
 */

// Safe 2-decimal rounding for currency values
const roundTo2Decimals = (num) => {
  if (isNaN(num) || num === null || num === undefined) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
};

// Safe 3-decimal rounding for physical quantities
const roundTo3Decimals = (num) => {
  if (isNaN(num) || num === null || num === undefined) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 1000) / 1000;
};

/**
 * Calculates authoritative values for purchase line items and totals.
 * 
 * @param {Array} items - Array of item rows { quantity, rate, ... }
 * @param {number|string} manualTotalAmount - Fallback amount if no product items are attached
 * @returns {Object} - Calculated items, totalQuantity, totalAmount
 */
const calculatePurchaseTotals = (items = [], manualTotalAmount = 0) => {
  if (!items || items.length === 0) {
    const parsedManual = parseFloat(manualTotalAmount);
    return {
      calculatedItems: [],
      totalQuantity: 0,
      totalAmount: isNaN(parsedManual) || parsedManual < 0 ? 0 : roundTo2Decimals(parsedManual)
    };
  }

  let totalQuantity = 0;
  let totalAmount = 0;

  const calculatedItems = items.map((item) => {
    const rawQty = parseFloat(item.quantity);
    const rawRate = parseFloat(item.rate || 0);

    const quantity = isNaN(rawQty) || rawQty < 0 ? 0 : roundTo3Decimals(rawQty);
    const rate = isNaN(rawRate) || rawRate < 0 ? 0 : roundTo2Decimals(rawRate);

    // Quantity * Rate
    const amount = roundTo2Decimals(quantity * rate);

    totalQuantity += quantity;
    totalAmount += amount;

    return {
      ...item,
      quantity,
      rate,
      amount
    };
  });

  return {
    calculatedItems,
    totalQuantity: roundTo3Decimals(totalQuantity),
    totalAmount: roundTo2Decimals(totalAmount)
  };
};

module.exports = {
  roundTo2Decimals,
  roundTo3Decimals,
  calculatePurchaseTotals
};
