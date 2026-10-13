const { Op } = require('sequelize');
const Estimate = require('../models/Estimate');

/**
 * Generates a persistent, sequential, unique estimate number.
 * Format: EST-YYYYMM-XXXX (e.g., EST-202610-0001)
 *
 * @param {Object} transaction - Sequelize transaction for concurrency lock
 * @returns {Promise<string>}
 */
const generateUniqueEstimateNumber = async (transaction) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `EST-${year}${month}-`;

  // Find the latest estimate for the current year/month with row locking if available
  const findOptions = {
    where: {
      estimateNumber: { [Op.like]: `${prefix}%` }
    },
    order: [['estimateNumber', 'DESC']]
  };

  if (transaction) {
    findOptions.transaction = transaction;
    if (transaction.LOCK && transaction.LOCK.UPDATE) {
      findOptions.lock = transaction.LOCK.UPDATE;
    }
  }

  const latestEstimate = await Estimate.findOne(findOptions);

  let nextSequence = 1;
  if (latestEstimate && latestEstimate.estimateNumber) {
    const parts = latestEstimate.estimateNumber.split('-');
    if (parts.length === 3) {
      const parsedSeq = parseInt(parts[2], 10);
      if (!isNaN(parsedSeq)) {
        nextSequence = parsedSeq + 1;
      }
    }
  }

  const paddedSeq = String(nextSequence).padStart(4, '0');
  return `${prefix}${paddedSeq}`;
};

module.exports = {
  generateUniqueEstimateNumber
};
