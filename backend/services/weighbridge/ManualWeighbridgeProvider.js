const WeighbridgeProvider = require('./WeighbridgeProvider');

/**
 * Concrete Manual Weighbridge Provider.
 * Allows authorized operators to record weights entered manually at the scale console.
 * Explicitly declares source as "Manual Entry".
 */
class ManualWeighbridgeProvider extends WeighbridgeProvider {
  getName() {
    return 'Manual Entry';
  }

  /**
   * Processes manually submitted weights into standardized format.
   * @param {Object} input - { tareWeight, grossWeight, unit, vehicleNumber, driverName, driverPhone }
   * @returns {Promise<Object>} Standardized weight reading
   */
  async readWeight(input) {
    const tare = parseFloat(input.tareWeight);
    const gross = parseFloat(input.grossWeight);
    const unit = input.unit ? input.unit.trim() : 'Kg';

    const reading = {
      tareWeight: Math.round((tare + Number.EPSILON) * 1000) / 1000,
      grossWeight: Math.round((gross + Number.EPSILON) * 1000) / 1000,
      unit,
      weightSource: this.getName(),
      readingTimestamp: new Date(),
      deviceReference: null,
      vehicleNumber: input.vehicleNumber ? input.vehicleNumber.trim().toUpperCase() : '',
      driverName: input.driverName ? input.driverName.trim() : null,
      driverPhone: input.driverPhone ? input.driverPhone.trim() : null,
      remarks: input.remarks ? input.remarks.trim() : null
    };

    const validation = this.validateReading(reading);
    if (!validation.isValid) {
      const err = new Error(validation.error);
      err.statusCode = 400;
      throw err;
    }

    return reading;
  }
}

module.exports = ManualWeighbridgeProvider;
