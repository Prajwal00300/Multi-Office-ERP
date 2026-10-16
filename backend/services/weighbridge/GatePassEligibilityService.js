/**
 * Gate Pass Eligibility & Validity Service.
 * Evaluates the 10-minute validity rule, weight discrepancy resolution,
 * and lifecycle state transitions.
 */

const DEFAULT_VALIDITY_MINUTES = parseInt(process.env.GATE_PASS_VALIDITY_MINUTES || '10', 10);
const TIME_EXCEEDED_MESSAGE = 'Time exceeded, re-weighing mandatory.';

/**
 * Calculates the validity window for a gate pass.
 * @param {Date|string} startTime
 * @param {number} [validityMinutes]
 * @returns {Object} { validityStart: Date, validityExpiry: Date, validityMinutes: number }
 */
const calculateValidityWindow = (startTime, validityMinutes = DEFAULT_VALIDITY_MINUTES) => {
  const start = startTime ? new Date(startTime) : new Date();
  const expiry = new Date(start.getTime() + validityMinutes * 60 * 1000);

  return {
    validityStart: start,
    validityExpiry: expiry,
    validityMinutes
  };
};

/**
 * Checks if a gate pass or transaction is currently within its validity period.
 * @param {Date|string} expiryTime
 * @returns {Object} { isValid: boolean, isExpired: boolean, remainingMs: number, message: string|null }
 */
const checkValidityPeriod = (expiryTime) => {
  if (!expiryTime) {
    return {
      isValid: false,
      isExpired: true,
      remainingMs: 0,
      message: TIME_EXCEEDED_MESSAGE
    };
  }

  const now = new Date().getTime();
  const expiry = new Date(expiryTime).getTime();
  const remaining = expiry - now;

  if (remaining <= 0) {
    return {
      isValid: false,
      isExpired: true,
      remainingMs: 0,
      message: TIME_EXCEEDED_MESSAGE
    };
  }

  return {
    isValid: true,
    isExpired: false,
    remainingMs: remaining,
    remainingSeconds: Math.floor(remaining / 1000),
    message: null
  };
};

/**
 * Evaluates the appropriate Gate Pass status based on weighing record and validity.
 *
 * @param {Object} weighingRecord - WeighingRecord instance or plain object
 * @param {Date|string} validityExpiry - Expiry timestamp
 * @param {string} [currentStatus] - Current gate pass status if existing
 * @returns {Object} { status: string, isEligibleForDispatch: boolean, reason: string|null }
 */
const evaluateGatePassEligibility = (weighingRecord, validityExpiry, currentStatus = 'DRAFT') => {
  // If already cancelled or dispatched, maintain terminal state
  if (['DISPATCHED', 'CANCELLED'].includes(currentStatus)) {
    return {
      status: currentStatus,
      isEligibleForDispatch: false,
      reason: `Gate pass is already in terminal state: ${currentStatus}`
    };
  }

  // Check 1: Weighing record existence
  if (!weighingRecord) {
    return {
      status: 'PENDING_WEIGHING',
      isEligibleForDispatch: false,
      reason: 'Vehicle has not completed weighbridge weighing.'
    };
  }

  // Check 2: Validity Expiry check (10-minute rule)
  const validity = checkValidityPeriod(validityExpiry);
  if (validity.isExpired) {
    return {
      status: 'REWEIGHING_REQUIRED',
      isEligibleForDispatch: false,
      reason: TIME_EXCEEDED_MESSAGE
    };
  }

  // Check 3: Weight discrepancy check
  if (weighingRecord.status === 'DISCREPANCY_FLAGGED') {
    return {
      status: 'WEIGHT_REVIEW_REQUIRED',
      isEligibleForDispatch: false,
      reason: weighingRecord.discrepancyReason || 'Weight discrepancy flagged. Requires CEO/Admin approval.'
    };
  }

  // Check 4: Approved or Verified weighing within valid time
  if (['VERIFIED', 'APPROVED'].includes(weighingRecord.status)) {
    // If it was already ISSUED, keep ISSUED; otherwise READY_FOR_DISPATCH
    const targetStatus = currentStatus === 'ISSUED' ? 'ISSUED' : 'READY_FOR_DISPATCH';
    return {
      status: targetStatus,
      isEligibleForDispatch: true,
      reason: null
    };
  }

  return {
    status: 'PENDING_WEIGHING',
    isEligibleForDispatch: false,
    reason: `Weighing record is in ${weighingRecord.status} status.`
  };
};

module.exports = {
  DEFAULT_VALIDITY_MINUTES,
  TIME_EXCEEDED_MESSAGE,
  calculateValidityWindow,
  checkValidityPeriod,
  evaluateGatePassEligibility
};
