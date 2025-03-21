// HVM/WalletManager.js
import { MongoClient } from "mongodb";
import { ethers } from "ethers";
import { dag4 } from "@stardust-collective/dag4";
import VaultHandler from "./VaultHandler.js";
import AddUser from "./AddUser.js";
import QRCodeManager from "./QRCodeManager.js";

class WalletManager {
    constructor(systemConfig) {
        if (!systemConfig) {
            throw new Error("SystemConfig is required to initialize WalletManager.");
        }

        this.systemConfig = systemConfig;
        this.dbClient = new MongoClient(systemConfig.getMongoUri(), { useUnifiedTopology: true });
        this.dbName = systemConfig.getMongoDbName();
        this.privateKeyCollection = "private_keys";

        this.vaultHandler = new VaultHandler();
        this.addUser = new AddUser(systemConfig);
        this.qrCodeManager = new QRCodeManager();

        this.connectToDatabase();
    }

    async connectToDatabase() {
        try {
            await this.dbClient.connect();
            console.log("✅ MongoDB connected.");
        } catch (err) {
            console.error("❌ MongoDB connection error:", err.message);
            throw err;
        }
    }

    async close() {
        await this.dbClient.close();
        console.log("🛑 MongoDB connection closed.");
    }

    async storePrivateKeys(userName, generatedWallets) {
        const db = this.dbClient.db(this.dbName);
        const encryptedWallets = generatedWallets.map(wallet => ({
            network: wallet.network,
            address: wallet.address,
            encryptedPrivateKey: this.vaultHandler.encrypt(wallet.private_key),
        }));

        await db.collection(this.privateKeyCollection).updateOne(
            { userName },
            { $set: { wallets: encryptedWallets } },
            { upsert: true }
        );
    }

    async generateWalletsForNetworks(userName, walletAddress, networks = ["DAG", "ETH", "BNB", "AVAX"]) {
        if (!userName || !walletAddress) throw new Error("Missing userName or walletAddress.");
        const generatedWallets = [];

        for (const network of networks) {
            const wallet = await this._generateWalletForNetwork(network);
            if (wallet) generatedWallets.push(wallet);
        }

        await this.storePrivateKeys(userName, generatedWallets);
        await this.addUser.addNewUser(userName, generatedWallets, walletAddress);
        await this.qrCodeManager.generateQRCodeForWallets(userName, generatedWallets);

        return generatedWallets;
    }

    async _generateWalletForNetwork(network) {
        switch (network) {
            case "ETH":
            case "BNB":
            case "AVAX": {
                const wallet = ethers.Wallet.createRandom();
                return { network, address: wallet.address, private_key: wallet.privateKey };
            }
            case "DAG": {
                const pk = dag4.keyStore.generatePrivateKey();
                dag4.account.loginPrivateKey(pk);
                dag4.account.connect({ networkVersion: "2.0", testnet: true });

                return {
                    network: "DAG",
                    address: dag4.account.address,
                    private_key: pk,
                };
            }
            default:
                console.warn(`Unsupported network: ${network}`);
                return null;
        }
    }

    async retrievePrivateKeys(userName) {
        const db = this.dbClient.db(this.dbName);
        const result = await db.collection(this.privateKeyCollection).findOne({ userName });

        if (!result?.wallets) return [];

        return result.wallets.map(wallet => ({
            network: wallet.network,
            address: wallet.address,
            private_key: this.vaultHandler.decrypt(wallet.encryptedPrivateKey),
        }));
    }

    async updateWalletAddress(userName, network, newAddress) {
        const db = this.dbClient.db(this.dbName);

        const result = await db.collection(this.privateKeyCollection).updateOne(
            { userName, "wallets.network": network },
            { $set: { "wallets.$.address": newAddress } }
        );

        if (result.modifiedCount === 0) {
            console.warn(`⚠️ Wallet address not updated for ${userName}, ${network}`);
        }
    }
}

export default WalletManager;
