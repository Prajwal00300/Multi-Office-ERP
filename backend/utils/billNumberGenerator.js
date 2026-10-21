const sequelize = require('../config/database');
const Bill = require('../models/Bill');

/**
 * Generates a persistent, sequential, unique bill number.
 * Format: simple sequential integer string (1, 2, 3, 4, 5...)
 *
 * @param {Object} [transaction] - Sequelize transaction for concurrency row lock
 * @returns {Promise<string>}
 */
const generateUniqueBillNumber = async (transaction) => {
  // Query for the maximum numeric bill number currently existing in the database
  const query = "SELECT MAX(CAST(billNumber AS UNSIGNED)) AS maxNum FROM bills WHERE billNumber REGEXP '^[0-9]+$'";

  const options = {};
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

  // Safety check: ensure string sequence doesn't collide
  while (true) {
    const candidate = String(nextSequence);
    const existing = await Bill.findOne({
      where: { billNumber: candidate },
      transaction
    });
    if (!existing) {
      return candidate;
    }
    nextSequence++;
  }
};

module.exports = {
  generateUniqueBillNumber
};
