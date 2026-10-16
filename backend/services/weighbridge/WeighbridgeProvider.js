/**
 * Base Abstract Weighbridge Provider.
 * All weighbridge providers (Manual, Future API, or Future Device)
 * must implement this contract.
 */
class WeighbridgeProvider {
  /**
   * Returns human-readable source name of the provider.
   * @returns {string} e.g. "Manual Entry", "Mettler Toledo Scale API", etc.
   */
  getName() {
    throw new Error('getName() must be implemented by subclass');
  }

  /**
   * Processes the raw weight reading into a standardized internal format.
   * @param {Object} input
   * @returns {Promise<Object>} Standardized weight reading
   */
  async readWeight(input) {
    throw new Error('readWeight() must be implemented by subclass');
  }

  /**
   * Validates the weight reading according to basic domain rules.
   * @param {Object} reading
   * @returns {Object} { isValid: boolean, error?: string }
   */
  validateReading(reading) {
    const tare = parseFloat(reading.tareWeight);
    const gross = parseFloat(reading.grossWeight);

    if (isNaN(tare) || tare < 0) {
      return { isValid: false, error: 'Tare weight must be a valid non-negative number.' };
    }
    if (isNaN(gross) || gross < 0) {
      return { isValid: false, error: 'Gross weight must be a valid non-negative number.' };
    }
    if (gross < tare) {
      return { isValid: false, error: 'Gross weight cannot be less than tare weight (empty vehicle weight).' };
    }
    if (!reading.unit || typeof reading.unit !== 'string') {
      return { isValid: false, error: 'Weight unit of measurement is required (e.g. Kg, Ton).' };
    }

    return { isValid: true };
  }
}

module.exports = WeighbridgeProvider;
