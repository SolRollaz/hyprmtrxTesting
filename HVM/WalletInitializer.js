// File: /HVM/WalletInitializer.js

import dag4 from "@stardust-collective/dag4";
import { ethers } from "ethers";
import SystemConfig from "../systemConfig.js";

class WalletInitializer {
  constructor(gameName) {
    if (!gameName) throw new Error("Game name is required for WalletInitializer.");
    this.gameName = gameName;
    this.systemConfig = new SystemConfig();

    this.providers = {};
    ["ETH", "BNB", "AVAX", "Base"].forEach(network => {
      this.providers[network] = this.getProviderForNetwork(network);
    });

    this.initializedWallets = {};
  }

  getProviderForNetwork(network) {
    const config = this.systemConfig.getNetworkConfig(network);
    if (!config || !config.rpcUrl) {
      throw new Error(`No configuration found for network: ${network}`);
    }
    return new ethers.JsonRpcProvider(config.rpcUrl);
  }

  async initializeWallets(wallets) {
    if (!Array.isArray(wallets)) {
      throw new Error("Invalid input: 'wallets' must be an array.");
    }

    for (const wallet of wallets) {
      if (!wallet.network || !wallet.private_key) {
        console.warn("Invalid wallet data. Skipping wallet:", wallet);
        continue;
      }

      switch (wallet.network) {
        case "DAG":
          this.initializeDAGWallet(wallet);
          break;
        case "ETH":
        case "BNB":
        case "AVAX":
        case "Base":
          this.initializeEthereumCompatibleWallet(wallet);
          break;
        default:
          console.warn(`Unsupported network type: ${wallet.network}`);
      }
    }
  }

  initializeDAGWallet(wallet) {
    try {
      const dagWallet = new dag4.Wallet();
      dagWallet.loginWithPrivateKey(wallet.private_key);
      this.initializedWallets[wallet.network] = {
        address: dagWallet.getAddress(),
        wallet: dagWallet,
      };
      console.log(`✅ DAG wallet initialized for game: ${this.gameName}`);
    } catch (error) {
      console.error(`❌ Error initializing DAG wallet for game: ${this.gameName}`, error.message);
      throw error;
    }
  }

  initializeEthereumCompatibleWallet(wallet) {
    try {
      const provider = this.providers[wallet.network];
      if (!provider) throw new Error(`No provider found for network: ${wallet.network}`);

      const ethWallet = new ethers.Wallet(wallet.private_key, provider);
      this.initializedWallets[wallet.network] = {
        address: ethWallet.address,
        wallet: ethWallet,
      };
      console.log(`✅ ${wallet.network} wallet initialized for game: ${this.gameName}`);
    } catch (error) {
      console.error(`❌ Error initializing ${wallet.network} wallet for game: ${this.gameName}`, error.message);
      throw error;
    }
  }

  getInitializedWallets() {
    return this.initializedWallets;
  }
}

export default WalletInitializer;
