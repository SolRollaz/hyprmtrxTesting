import { MongoClient } from "mongodb";
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

    /**
     * Assigns only the user's authenticated external ETH wallet.
     * No internal private keys are generated or stored.
     */
    async generateWalletsForNetworks(userName, walletAddress) {
        if (!userName || !walletAddress) {
            throw new Error("Missing userName or walletAddress.");
        }

        const ethWallet = {
            network: "ETH",
            address: walletAddress
        };

        // ✅ Create user record using only the external wallet
        await this.addUser.addNewUser(userName, [ethWallet], walletAddress);

        // Optional: still generate QR code representing user/wallet identity
        await this.qrCodeManager.generateQRCodeForWallets(userName, [ethWallet]);

        return [ethWallet];
    }
}

export default WalletManager;
