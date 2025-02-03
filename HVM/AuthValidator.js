import { MetaMaskSDK } from "@metamask/sdk";
import { ethers } from "ethers";
import SystemConfig from "../systemConfig.js";

class AuthValidator {
    constructor() {
        this.systemConfig = new SystemConfig();
        this.metaMaskSDK = new MetaMaskSDK({
            dappMetadata: {
                name: "HyperMatrix",
                description: "Web3 authentication via MetaMask",
                url: "https://hyprmtrx.xyz",
            },
        });
        this.ethereum = this.metaMaskSDK.getProvider(); // MetaMask SDK provider
        console.log("MetaMaskSDK Initialized for Web3 Authentication:", this.metaMaskSDK);
    }

    /**
     * Authenticate the wallet using MetaMask (signature-based verification).
     * @param {string} message - Message to be signed.
     * @param {string} signature - Wallet signature.
     * @param {string} walletAddress - Wallet address for verification.
     * @returns {boolean} - True if the signature is valid, otherwise false.
     */
    async authenticateWithMetamask(message, signature, walletAddress) {
        try {
            if (!message || !signature || !walletAddress) {
                throw new Error("Message, signature, and wallet address are required for MetaMask authentication.");
            }

            const signerAddress = ethers.verifyMessage(message, signature);
            console.log("MetaMask signer address:", signerAddress);
            return signerAddress.toLowerCase() === walletAddress.toLowerCase();
        } catch (error) {
            console.error("Error during MetaMask authentication:", error.message);
            return false;
        }
    }

    /**
     * Create an authentication message for the user to sign.
     * @param {string} walletAddress - Wallet address of the user.
     * @returns {string} - Message for the user to sign.
     */
    createAuthenticationMessage(walletAddress) {
        const timestamp = Date.now();
        return `Sign this message to authenticate with HyperMatrix: ${walletAddress} - ${timestamp}`;
    }

    /**
     * Request the MetaMask wallet to sign a message.
     * @param {string} message - Message to be signed.
     * @returns {object|null} - The signed message and wallet address or null if signing fails.
     */
    async requestSignature(message) {
        try {
            console.log("Requesting signature from MetaMask with message:", message);

            const accounts = await this.ethereum.request({ method: "eth_requestAccounts" });
            const walletAddress = accounts[0];

            const signature = await this.ethereum.request({
                method: "personal_sign",
                params: [message, walletAddress],
            });

            console.log("Signed message from MetaMask:", signature);
            return { signature, walletAddress };
        } catch (error) {
            console.error("Error requesting signature from MetaMask:", error.message);
            return null;
        }
    }

    /**
     * Centralized method to validate a wallet.
     * @param {string} authType - Type of authentication (e.g., metamask).
     * @param {string} walletAddress - Wallet address.
     * @param {string} signature - Wallet signature.
     * @param {string} message - Message for verification.
     * @returns {boolean} - True if the wallet is validated, otherwise false.
     */
    async validateWallet(authType, walletAddress, signature, message) {
        try {
            if (!walletAddress) throw new Error("Wallet address is missing.");

            if (authType.toLowerCase() === "metamask") {
                console.log(`Validating wallet with MetaMask. Wallet: ${walletAddress}`);
                return await this.authenticateWithMetamask(message, signature, walletAddress);
            } else {
                console.error("Unsupported authentication type:", authType);
                return false;
            }
        } catch (error) {
            console.error("Error during wallet validation:", error.message);
            return false;
        }
    }
}

export default AuthValidator;
