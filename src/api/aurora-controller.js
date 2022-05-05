/**
 * Module dependencies
 */

const auroraHelper = require('../helpers/aurora-helper');
const config = require('config');
const setupApp = require('../providers/provider');
const activePoolIds = config.get('AURORA.ACTIVE_POOL_IDS');


/**
 * Class `Aurora controller`
 */

class AuroraController {
  /**
   * Get aurora APR
   */

  static async getAPR() {
    // wallet provider can be injected here if wanted
    // this will setup the App provider and ethcallProvider
    const App = await setupApp();

    return auroraHelper.getAuroraAPR(App, activePoolIds);
  }
}

module.exports = AuroraController;
