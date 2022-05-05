/**
 * Module dependencies
 */

const config = require('config');
const ethers = require('ethers');
const ethcall = require('ethcall');

/**
 * Constants
 */

const auroraRpcUrl = config.get('AURORA.RPC.rpcUrl');

/**
 * Export provider
 */
module.exports = async (walletProvider = null) => {
  let App = {};
  if (walletProvider) {
    const accounts = await walletProvider.request({ method: 'eth_requestAccounts' })
    
    App.YOUR_ADDRESS = accounts[0];
    App.provider = new ethers.providers.Web3Provider(walletProvider);
    App.ethcallProvider = new ethcall.Provider();
  } else {
    App.YOUR_ADDRESS = "0x75c014a51a0B946bf6a2B2b2981A7f4d55221cf6";
    App.provider = new ethers.providers.JsonRpcProvider(auroraRpcUrl);
    App.ethcallProvider = new ethcall.Provider();
  }

  App.ethcallProvider.init(App.provider);

  return App;
};
