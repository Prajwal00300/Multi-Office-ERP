/**
 * Estimate Calculation Service
 * 
 * Centralizes all mathematical and financial calculation logic for the Estimate module.
 * 
 * UNRESOLVED CLIENT BUSINESS RULES & DOCUMENTATION:
 * 1. Line Item Amount:
 *    The client's actual document "Estimate (K)" shows Quantity, Rate, and Amount.
 *    The standard provisional formula implemented here is:
 *      Amount = Quantity * Negotiated Rate
 *    Rounded to 2 decimal places.
 *    NOTE: If the client uses a specific weight conversion factor (e.g. Kg to Ton, or weight per meter)
 *    or bundle factor, this must be confirmed by the client.
 * 
 * 2. "Btls" Column:
 *    The client document contains a "Btls" column (likely Bundles in steel/pipe trade).
 *    Per prompt instructions, we DO NOT invent a multiplication formula for Btls.
 *    Btls is stored as an independent quantity/count field without altering the Amount calculation.
 * 
 * 3. "Basic" Header Field:
 *    Displayed in the header of the client's document.
 *    Stored as an independent value and not assumed to be a sum or tax base until confirmed.
 * 
 * 4. "Others" Bottom Field:
 *    Displayed below "Total" in the client document.
 *    Treated as an additional charge/adjustment to determine Grand Total:
 *      Grand Total = Total + Others
 *    Until the client confirms whether it represents freight, loading charges, tax, or discount.
 */

// Safe 2-decimal rounding to prevent floating-point anomalies
const roundTo2Decimals = (num) => {
  if (isNaN(num) || num === null || num === undefined) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
};

// Safe 3-decimal rounding for quantities (e.g. metric tons with kg precision: 1.250 MT)
const roundTo3Decimals = (num) => {
  if (isNaN(num) || num === null || num === undefined) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 1000) / 1000;
};

/**
 * Calculates authoritative values for estimate line items and overall totals.
 * @param {Array} items - Array of raw item rows { quantity, negotiatedRate, btls, ... }
 * @param {number|string} others - Additional charges or adjustments
 * @returns {Object} - Calculated items, totalQuantity, total, grandTotal
 */
const calculateEstimateTotals = (items = [], others = 0) => {
  let totalQuantity = 0;
  let totalAmount = 0;

  const calculatedItems = items.map((item, index) => {
    const rawQty = parseFloat(item.quantity);
    const rawRate = parseFloat(item.negotiatedRate || item.rate || 0);

    const quantity = isNaN(rawQty) || rawQty < 0 ? 0 : roundTo3Decimals(rawQty);
    const negotiatedRate = isNaN(rawRate) || rawRate < 0 ? 0 : roundTo2Decimals(rawRate);

    // Provisional calculation formula: Quantity * Negotiated Rate
    const amount = roundTo2Decimals(quantity * negotiatedRate);

    totalQuantity += quantity;
    totalAmount += amount;

    return {
      ...item,
      quantity,
      negotiatedRate,
      amount,
      btls: item.btls !== undefined && item.btls !== null ? String(item.btls).trim() : null
    };
  });

  const parsedOthers = parseFloat(others);
  const validatedOthers = isNaN(parsedOthers) ? 0 : roundTo2Decimals(parsedOthers);

  const finalTotalQuantity = roundTo3Decimals(totalQuantity);
  const finalTotal = roundTo2Decimals(totalAmount);
  const finalGrandTotal = roundTo2Decimals(finalTotal + validatedOthers);

  return {
    calculatedItems,
    totalQuantity: finalTotalQuantity,
    total: finalTotal,
    others: validatedOthers,
    grandTotal: finalGrandTotal
  };
};

module.exports = {
  roundTo2Decimals,
  roundTo3Decimals,
  calculateEstimateTotals
};
