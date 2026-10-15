/**
 * Billing Calculation Service
 * 
 * Centralizes all mathematical and financial calculation logic for the Billing module.
 * 
 * BUSINESS & TAX RULES DOCUMENTATION:
 * 1. Line Item Amount:
 *      Line Amount = round(Quantity * Rate, 2)
 *    Quantity has 3-decimal precision (e.g. Metric Tons with kg precision: 1.250 MT).
 *    Negotiated Rate has 2-decimal precision.
 * 
 * 2. Product Subtotal:
 *      Product Subtotal = Sum of all valid Line Item Amounts
 * 
 * 3. GST Calculation & Taxable Base:
 *      GST Amount = round(Applicable GST Taxable Base * GST Percentage / 100, 2)
 *    The GST percentage is entered manually by the employee (e.g. 5%, 12%, 18%).
 *    NOTE ON TRANSPORTATION TAX TREATMENT:
 *    The client has specified that the employee enters the GST percentage and the system calculates
 *    the GST amount. Currently, the proposed taxable base is the Product Subtotal.
 *    The function `calculateGstTaxableBase` isolates this calculation so that if the client
 *    confirms that GST also applies to transportation charges in the future, it can be updated
 *    in this single place without altering controllers or database queries.
 * 
 * 4. Transportation Cost:
 *    Entered manually by the employee. Stored as an independent monetary field (DECIMAL 15,2).
 *    Never derived automatically from quantity or product price.
 * 
 * 5. Final Bill Amount:
 *      Final Bill Amount = round(Product Subtotal + GST Amount + Transport Cost, 2)
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
 * Calculates the applicable taxable base for GST.
 * Isolated to accommodate future tax rules regarding transportation.
 * 
 * @param {number} productSubtotal - Sum of line item amounts
 * @param {number} transportCost - Transportation cost
 * @returns {number} - Taxable base
 */
const calculateGstTaxableBase = (productSubtotal, transportCost = 0) => {
  // Proposed taxable base is productSubtotal as per initial requirements.
  return roundTo2Decimals(productSubtotal);
};

/**
 * Authoritatively calculates all bill items, product subtotal, GST, transport, and final bill amount.
 * 
 * @param {Array} items - Array of raw item rows { quantity, rate, btls, ... }
 * @param {number|string} gstPercentage - Manually entered GST rate
 * @param {number|string} transportCost - Manually entered transportation cost
 * @returns {Object} - Complete calculated financial breakdown
 */
const calculateBillTotals = (items = [], gstPercentage = 0, transportCost = 0) => {
  let totalQuantity = 0;
  let productSubtotal = 0;

  const calculatedItems = items.map((item) => {
    const rawQty = parseFloat(item.quantity);
    const rawRate = parseFloat(item.rate || item.negotiatedRate || 0);

    const quantity = isNaN(rawQty) || rawQty < 0 ? 0 : roundTo3Decimals(rawQty);
    const rate = isNaN(rawRate) || rawRate < 0 ? 0 : roundTo2Decimals(rawRate);

    // Quantity * Rate
    const amount = roundTo2Decimals(quantity * rate);

    totalQuantity += quantity;
    productSubtotal += amount;

    return {
      ...item,
      quantity,
      rate,
      amount,
      btls: item.btls !== undefined && item.btls !== null ? String(item.btls).trim() : null
    };
  });

  const parsedGstPercent = parseFloat(gstPercentage);
  const validatedGstPercentage = isNaN(parsedGstPercent) || parsedGstPercent < 0 
    ? 0 
    : roundTo2Decimals(Math.min(parsedGstPercent, 100));

  const parsedTransport = parseFloat(transportCost);
  const validatedTransportCost = isNaN(parsedTransport) || parsedTransport < 0 
    ? 0 
    : roundTo2Decimals(parsedTransport);

  const roundedSubtotal = roundTo2Decimals(productSubtotal);
  const taxableBase = calculateGstTaxableBase(roundedSubtotal, validatedTransportCost);
  const calculatedGstAmount = roundTo2Decimals((taxableBase * validatedGstPercentage) / 100);

  const finalAmount = roundTo2Decimals(roundedSubtotal + calculatedGstAmount + validatedTransportCost);

  return {
    calculatedItems,
    totalQuantity: roundTo3Decimals(totalQuantity),
    productSubtotal: roundedSubtotal,
    gstPercentage: validatedGstPercentage,
    gstAmount: calculatedGstAmount,
    transportCost: validatedTransportCost,
    finalAmount
  };
};

module.exports = {
  roundTo2Decimals,
  roundTo3Decimals,
  calculateGstTaxableBase,
  calculateBillTotals
};
