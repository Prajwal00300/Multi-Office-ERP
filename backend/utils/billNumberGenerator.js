const { Op } = require('sequelize');
const Bill = require('../models/Bill');

/**
 * Generates a persistent, sequential, unique bill number.
 * Format: BILL-YYYYMM-XXXX (e.g., BILL-202610-0001)
 *
 * @param {Object} transaction - Sequelize transaction for concurrency row lock
 * @returns {Promise<string>}
 */
const generateUniqueBillNumber = async (transaction) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `BILL-${year}${month}-`;

  const findOptions = {
    where: {
      billNumber: { [Op.like]: `${prefix}%` }
    },
    order: [['billNumber', 'DESC']]
  };

  if (transaction) {
    findOptions.transaction = transaction;
    if (transaction.LOCK && transaction.LOCK.UPDATE) {
      findOptions.lock = transaction.LOCK.UPDATE;
    }
  }

  const latestBill = await Bill.findOne(findOptions);

  let nextSequence = 1;
  if (latestBill && latestBill.billNumber) {
    const parts = latestBill.billNumber.split('-');
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
  generateUniqueBillNumber
};
