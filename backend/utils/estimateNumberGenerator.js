const sequelize = require('../config/database');
const Estimate = require('../models/Estimate');

/**
 * Generates a persistent, sequential, unique estimate number for a specific office,
 * refreshed daily per estimateDate (1, 2, 3, 4, 5... each day).
 *
 * @param {number|string} [organizationId] - Office ID to scope the estimate number sequence
 * @param {Object} [transaction] - Sequelize transaction for concurrency lock
 * @param {string|Date} [targetDate] - Date of the estimate (defaults to today)
 * @returns {Promise<string>}
 */
const generateUniqueEstimateNumber = async (organizationId, transaction, targetDate) => {
  // If only 1 argument passed and it's a transaction object
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
    query = "SELECT MAX(CAST(estimateNumber AS UNSIGNED)) AS maxNum FROM estimates WHERE organizationId = ? AND estimateDate = ? AND estimateNumber REGEXP '^[0-9]+$'";
    replacements = [parseInt(organizationId, 10), effectiveDate];
  } else {
    query = "SELECT MAX(CAST(estimateNumber AS UNSIGNED)) AS maxNum FROM estimates WHERE estimateDate = ? AND estimateNumber REGEXP '^[0-9]+$'";
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

  // Safety check: ensure string sequence doesn't collide within this organization and date
  while (true) {
    const candidate = String(nextSequence);
    const where = { estimateNumber: candidate, estimateDate: effectiveDate };
    if (organizationId) {
      where.organizationId = parseInt(organizationId, 10);
    }
    const existing = await Estimate.findOne({
      where,
      transaction
    });
    if (!existing) {
      return candidate;
    }
    nextSequence++;
  }
};

module.exports = {
  generateUniqueEstimateNumber
};
