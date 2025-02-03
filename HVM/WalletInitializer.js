import dag4 from "@stardust-collective/dag4";
import { ethers } from "ethers";
import SystemConfig from "../systemConfig.js";

console.log("Ethers Module:", ethers);

class WalletInitializer {
    constructor(userId) {
        this.userId = userId;
        this.systemConfig = new SystemConfig(); // Use SystemConfig for configurations

        // Providers mapped by network
        this.providers = {};
        ["ETH", "BNB", "AVAX", "Base"].forEach(network => {
            this.providers[network] = this.getProviderForNetwork(network);
        });

        // Initialized wallets
        this.initializedWallets = {};
    }

    /**
     * Retrieve provider for a given network.
     * @param {string} network - The network key (e.g., 'ETH', 'BNB').
     * @returns {ethers.JsonRpcProvider} - The provider instance.
     */
    getProviderForNetwork(network) {
        const config = this.systemConfig.getNetworkConfig(network);
        if (!config || !config.rpcUrl) {
            throw new Error(`No configuration found for network: ${network}`);
        }
        return new ethers.JsonRpcProvider(config.rpcUrl);
    }

    /**
     * Initialize all wallets provided.
     * @param {Array} wallets - Array of wallets with network, address, and private key.
     */
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

    /**
     * Initialize a DAG wallet.
     * @param {Object} wallet - The wallet object (network, address, private key).
     */
    initializeDAGWallet(wallet) {
        try {
            const dagWallet = new dag4.Wallet();
            dagWallet.loginWithPrivateKey(wallet.private_key);
            this.initializedWallets[wallet.network] = {
                address: dagWallet.getAddress(),
                wallet: dagWallet,
            };
            console.log(`DAG wallet initialized successfully for user: ${this.userId}`);
        } catch (error) {
            console.error(`Error initializing DAG wallet for user: ${this.userId}`, error.message);
            throw error;
        }
    }

    /**
     * Initialize Ethereum-compatible wallets (ETH, BNB, AVAX, Base).
     * @param {Object} wallet - The wallet object (network, address, private key).
     */
    initializeEthereumCompatibleWallet(wallet) {
        try {
            const provider = this.providers[wallet.network];
            if (!provider) {
                throw new Error(`No provider found for network: ${wallet.network}`);
            }

            const ethWallet = new ethers.Wallet(wallet.private_key, provider);
            this.initializedWallets[wallet.network] = {
                address: ethWallet.address,
                wallet: ethWallet,
            };
            console.log(`${wallet.network} wallet initialized successfully for user: ${this.userId}`);
        } catch (error) {
            console.error(`Error initializing ${wallet.network} wallet for user: ${this.userId}`, error.message);
            throw error;
        }
    }

    /**
     * Get initialized wallets.
     * @returns {Object} - A mapping of network to initialized wallet details.
     */
    getInitializedWallets() {
        return this.initializedWallets;
    }
}

export default WalletInitializer;
