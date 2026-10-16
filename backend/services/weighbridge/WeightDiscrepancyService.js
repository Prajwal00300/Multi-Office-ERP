const { calculateWeightDifference } = require('./WeighbridgeCalculationService');

/**
 * Weight Discrepancy Detection & Evaluation Service.
 * Detects differences between expected and actual net weights,
 * flags discrepancies for review, and enforces tolerance rules.
 */

// Production default tolerance (in Kg). Default is 0 until client confirms an accepted margin.
const DEFAULT_TOLERANCE_KG = parseFloat(process.env.WEIGHBRIDGE_TOLERANCE_KG || '0');

/**
 * Evaluates whether a weighing reading has an unresolved discrepancy.
 *
 * @param {Object} params
 * @param {number} params.actualNetWeight
 * @param {string} params.actualUnit
 * @param {number|null} params.expectedWeight
 * @param {string|null} params.expectedUnit
 * @param {boolean} params.isExpectedWeightAvailable
 * @param {string|null} params.unavailableReason
 * @param {number} [params.toleranceKg] - Configurable tolerance
 * @returns {Object} Evaluation summary
 */
const evaluateDiscrepancy = ({
  actualNetWeight,
  actualUnit = 'Kg',
  expectedWeight = null,
  expectedUnit = 'Kg',
  isExpectedWeightAvailable = true,
  unavailableReason = null,
  toleranceKg = DEFAULT_TOLERANCE_KG
}) => {
  // Case 1: Expected weight is unavailable
  if (!isExpectedWeightAvailable || expectedWeight === null || expectedWeight === undefined) {
    return {
      status: 'DISCREPANCY_FLAGGED',
      isDiscrepancy: true,
      weightDifference: null,
      reason: unavailableReason || 'Expected weight unavailable — manual verification required.',
      requiresApproval: true
    };
  }

  // Case 2: Expected weight is available
  const diff = calculateWeightDifference(actualNetWeight, actualUnit, expectedWeight, expectedUnit);

  if (diff === null) {
    return {
      status: 'DISCREPANCY_FLAGGED',
      isDiscrepancy: true,
      weightDifference: null,
      reason: 'Incompatible weight units prevent automated comparison — manual verification required.',
      requiresApproval: true
    };
  }

  // Check if difference exceeds tolerance
  const absDiff = Math.abs(diff);
  if (absDiff > toleranceKg) {
    const sign = diff > 0 ? '+' : '';
    return {
      status: 'DISCREPANCY_FLAGGED',
      isDiscrepancy: true,
      weightDifference: diff,
      reason: `Weight difference of ${sign}${diff.toFixed(3)} ${actualUnit} detected (Tolerance: ±${toleranceKg} Kg). Discrepancy flagged for CEO/Admin review.`,
      requiresApproval: true
    };
  }

  // Exact match or within acceptable tolerance
  return {
    status: 'VERIFIED',
    isDiscrepancy: false,
    weightDifference: diff,
    reason: null,
    requiresApproval: false
  };
};

module.exports = {
  DEFAULT_TOLERANCE_KG,
  evaluateDiscrepancy
};
