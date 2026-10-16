const { Op } = require('sequelize');
const WeighingRecord = require('../models/WeighingRecord');

/**
 * Generates a persistent, sequential, unique weighing number.
 * Format: WB-YYYYMM-XXXX (e.g., WB-202610-0001)
 *
 * @param {Object} transaction - Sequelize transaction for concurrency lock
 * @returns {Promise<string>}
 */
const generateUniqueWeighingNumber = async (transaction) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `WB-${year}${month}-`;

  const findOptions = {
    where: {
      weighingNumber: { [Op.like]: `${prefix}%` }
    },
    order: [['weighingNumber', 'DESC']]
  };

  if (transaction) {
    findOptions.transaction = transaction;
    if (transaction.LOCK && transaction.LOCK.UPDATE) {
      findOptions.lock = transaction.LOCK.UPDATE;
    }
  }

  const latest = await WeighingRecord.findOne(findOptions);

  let nextSequence = 1;
  if (latest && latest.weighingNumber) {
    const parts = latest.weighingNumber.split('-');
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
  generateUniqueWeighingNumber
};
