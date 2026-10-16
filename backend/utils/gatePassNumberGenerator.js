const { Op } = require('sequelize');
const GatePass = require('../models/GatePass');

/**
 * Generates a persistent, sequential, unique gate pass number.
 * Format: GP-YYYYMM-XXXX (e.g., GP-202610-0001)
 *
 * @param {Object} transaction - Sequelize transaction for concurrency lock
 * @returns {Promise<string>}
 */
const generateUniqueGatePassNumber = async (transaction) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `GP-${year}${month}-`;

  const findOptions = {
    where: {
      gatePassNumber: { [Op.like]: `${prefix}%` }
    },
    order: [['gatePassNumber', 'DESC']]
  };

  if (transaction) {
    findOptions.transaction = transaction;
    if (transaction.LOCK && transaction.LOCK.UPDATE) {
      findOptions.lock = transaction.LOCK.UPDATE;
    }
  }

  const latest = await GatePass.findOne(findOptions);

  let nextSequence = 1;
  if (latest && latest.gatePassNumber) {
    const parts = latest.gatePassNumber.split('-');
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
  generateUniqueGatePassNumber
};
