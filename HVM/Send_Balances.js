import dag4 from "@stardust-collective/dag4";
const { WalletClient } = dag4;

import { ethers } from "ethers";
import axios from "axios";
import SystemConfig from "../systemConfig.js"; // Import SystemConfig for configurations

class Send_Balances {
    constructor(systemConfig) {
        if (!systemConfig) {
            throw new Error("SystemConfig is required to initialize Send_Balances.");
        }
        this.systemConfig = systemConfig;

        // Ensure `getGameAPIBaseUrl` is defined in `SystemConfig`
        if (typeof this.systemConfig.getGameAPIBaseUrl !== "function") {
            throw new Error("SystemConfig is missing the method getGameAPIBaseUrl.");
        }

        this.baseGameAPIEndpoint = this.systemConfig.getGameAPIBaseUrl();
        if (!this.baseGameAPIEndpoint) {
            throw new Error("Game API base URL is not defined in SystemConfig.");
        }
    }

    /**
     * Send balances and token logos to the game API.
     */
    async sendBalances(user_name, hyprmtrx_wallets, game_name) {
        try {
            if (!user_name || !hyprmtrx_wallets || !game_name) {
                throw new Error("Invalid input: user_name, hyprmtrx_wallets, and game_name are required.");
            }

            const balances = await this._getWalletBalances(hyprmtrx_wallets);
            const tokenLogos = await this._getTokenLogos(hyprmtrx_wallets);

            const gameData = {
                user_name,
                balances,
                tokenLogos,
            };

            const gameAPIEndpoint = `${this.baseGameAPIEndpoint}/${game_name}/auth`;

            const response = await axios.post(gameAPIEndpoint, gameData);
            console.log("Sent balances and token logos to the game:", response.data);
            return { status: "success", message: "Balances and token logos sent successfully." };
        } catch (error) {
            console.error("Error sending balances and token logos:", error.message);
            return { status: "failure", message: "Failed to send balances and token logos to the game." };
        }
    }

    async _getWalletBalances(hyprmtrx_wallets) {
        const balances = [];
        for (const wallet of hyprmtrx_wallets) {
            try {
                const balance = await this._fetchBalance(wallet.address, wallet.network);
                balances.push({ network: wallet.network, balance });
            } catch (error) {
                console.error(`Error fetching balance for wallet (Network: ${wallet.network}, Address: ${wallet.address}):`, error.message);
            }
        }
        return balances;
    }

    async _fetchBalance(address, network) {
        switch (network) {
            case "ETH":
            case "BNB":
            case "AVAX":
            case "Base":
                return await this._fetchEthereumBalance(address, network);
            case "DAG":
                return await this._fetchDAG4Balance(address);
            default:
                throw new Error(`Unsupported network: ${network}`);
        }
    }

    async _fetchEthereumBalance(address, network) {
        try {
            const provider = this.systemConfig.getProvider(network);
            const balance = await provider.getBalance(address);
            return ethers.utils.formatEther(balance);
        } catch (error) {
            console.error(`Error fetching ${network} balance for address ${address}:`, error.message);
            throw error;
        }
    }

    async _fetchDAG4Balance(address) {
        try {
            const client = new WalletClient();
            return await client.getBalance(address);
        } catch (error) {
            console.error(`Error fetching DAG balance for address ${address}:`, error.message);
            throw error;
        }
    }

    async _getTokenLogos(hyprmtrx_wallets) {
        const tokenLogos = [];
        for (const wallet of hyprmtrx_wallets) {
            try {
                const logoUrl = `https://constellationnetwork.io.s3-website.us-west-1.amazonaws.com/currency/v1/l1/public/${wallet.tokenSymbol}_${wallet.network}.png`;
                const logoData = await axios.get(logoUrl, { responseType: "arraybuffer" });
                const base64Logo = Buffer.from(logoData.data, "binary").toString("base64");
                tokenLogos.push({ network: wallet.network, logo: `data:image/png;base64,${base64Logo}` });
            } catch (error) {
                console.error(`Error fetching logo for ${wallet.tokenSymbol}_${wallet.network}:`, error.message);
                tokenLogos.push({ network: wallet.network, logo: null });
            }
        }
        return tokenLogos;
    }
}

export default Send_Balances;
