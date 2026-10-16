const WeighbridgeProvider = require('./WeighbridgeProvider');

/**
 * Future API Weighbridge Provider Template.
 * Demonstrates architectural readiness for real IoT / RS232 / REST scale hardware
 * without claiming fake integration or mock values.
 */
class FutureApiWeighbridgeProvider extends WeighbridgeProvider {
  constructor(config = {}) {
    super();
    this.endpoint = config.endpoint || process.env.WEIGHBRIDGE_API_URL;
    this.deviceModel = config.deviceModel || 'Scale-IoT-Adapter';
  }

  getName() {
    return 'Digital Scale API';
  }

  /**
   * Placeholder for future digital scale integration.
   * Currently throws descriptive error until actual hardware is deployed.
   */
  async readWeight(input) {
    if (!this.endpoint) {
      const err = new Error(
        'Digital Scale API integration is configured for future deployment. Please use Manual Entry for operational weighing.'
      );
      err.statusCode = 501;
      throw err;
    }

    // Future implementation: Fetch tare/gross from physical scale interface
    throw new Error('Hardware API integration pending device calibration and testing.');
  }
}

module.exports = FutureApiWeighbridgeProvider;
