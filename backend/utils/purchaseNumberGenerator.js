const { Op } = require('sequelize');
const Purchase = require('../models/Purchase');
const GoodsReceipt = require('../models/GoodsReceipt');

/**
 * Generates a persistent, sequential, unique purchase number.
 * Format: PUR-YYYYMM-XXXX (e.g., PUR-202610-0001)
 *
 * @param {Object} transaction - Sequelize transaction for concurrency lock
 * @returns {Promise<string>}
 */
const generateUniquePurchaseNumber = async (transaction) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `PUR-${year}${month}-`;

  const findOptions = {
    where: {
      purchaseNumber: { [Op.like]: `${prefix}%` }
    },
    order: [['purchaseNumber', 'DESC']]
  };

  if (transaction) {
    findOptions.transaction = transaction;
    if (transaction.LOCK && transaction.LOCK.UPDATE) {
      findOptions.lock = transaction.LOCK.UPDATE;
    }
  }

  const latestPurchase = await Purchase.findOne(findOptions);

  let nextSequence = 1;
  if (latestPurchase && latestPurchase.purchaseNumber) {
    const parts = latestPurchase.purchaseNumber.split('-');
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

/**
 * Generates a persistent, sequential, unique goods receipt number.
 * Format: REC-YYYYMM-XXXX (e.g., REC-202610-0001)
 *
 * @param {Object} transaction - Sequelize transaction for concurrency lock
 * @returns {Promise<string>}
 */
const generateUniqueReceiptNumber = async (transaction) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `REC-${year}${month}-`;

  const findOptions = {
    where: {
      receiptNumber: { [Op.like]: `${prefix}%` }
    },
    order: [['receiptNumber', 'DESC']]
  };

  if (transaction) {
    findOptions.transaction = transaction;
    if (transaction.LOCK && transaction.LOCK.UPDATE) {
      findOptions.lock = transaction.LOCK.UPDATE;
    }
  }

  const latestReceipt = await GoodsReceipt.findOne(findOptions);

  let nextSequence = 1;
  if (latestReceipt && latestReceipt.receiptNumber) {
    const parts = latestReceipt.receiptNumber.split('-');
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
  generateUniquePurchaseNumber,
  generateUniqueReceiptNumber
};
