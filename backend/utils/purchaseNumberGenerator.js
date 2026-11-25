const sequelize = require('../config/database');
const { Op } = require('sequelize');
const Purchase = require('../models/Purchase');
const GoodsReceipt = require('../models/GoodsReceipt');

/**
 * Generates a persistent, sequential, unique purchase serial number for a specific office,
 * refreshed daily per purchaseDate (1, 2, 3, 4, 5... each day).
 *
 * @param {number|string} [organizationId] - Office ID to scope the serial number sequence
 * @param {Object} [transaction] - Sequelize transaction for concurrency lock
 * @param {string|Date} [targetDate] - Date of the purchase order (defaults to today)
 * @returns {Promise<string>}
 */
const generateUniquePurchaseNumber = async (organizationId, transaction, targetDate) => {
  if (organizationId && typeof organizationId === 'object' && organizationId.commit) {
    targetDate = transaction;
    transaction = organizationId;
    organizationId = null;
  }

  // Normalize date string (YYYY-MM-DD)
  let effectiveDate = targetDate;
  if (!effectiveDate) {
    effectiveDate = new Date().toISOString().split('T')[0];
  } else if (effectiveDate instanceof Date) {
    effectiveDate = effectiveDate.toISOString().split('T')[0];
  } else {
    effectiveDate = String(effectiveDate).split('T')[0].trim();
  }

  let query;
  let replacements = [];

  if (organizationId) {
    query = "SELECT MAX(CAST(purchaseNumber AS UNSIGNED)) AS maxNum FROM purchases WHERE organizationId = ? AND purchaseDate = ? AND purchaseNumber REGEXP '^[0-9]+$'";
    replacements = [parseInt(organizationId, 10), effectiveDate];
  } else {
    query = "SELECT MAX(CAST(purchaseNumber AS UNSIGNED)) AS maxNum FROM purchases WHERE purchaseDate = ? AND purchaseNumber REGEXP '^[0-9]+$'";
    replacements = [effectiveDate];
  }

  const options = { replacements };
  if (transaction) {
    options.transaction = transaction;
    if (transaction.LOCK && transaction.LOCK.UPDATE) {
      options.lock = transaction.LOCK.UPDATE;
    }
  }

  const [results] = await sequelize.query(query, options);

  let nextSequence = 1;
  if (results && results[0] && results[0].maxNum !== null && results[0].maxNum !== undefined) {
    const currentMax = parseInt(results[0].maxNum, 10);
    if (!isNaN(currentMax) && currentMax >= 1) {
      nextSequence = currentMax + 1;
    }
  }

  // Safety check: ensure string sequence doesn't collide for the same office and same date
  while (true) {
    const candidate = String(nextSequence);
    const where = { purchaseNumber: candidate, purchaseDate: effectiveDate };
    if (organizationId) {
      where.organizationId = parseInt(organizationId, 10);
    }
    const existing = await Purchase.findOne({
      where,
      transaction
    });
    if (!existing) {
      return candidate;
    }
    nextSequence += 1;
  }
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
