import { Core } from "@walletconnect/core";
import qrCode from "qrcode";
import path from "path";
import fs from "fs";
import systemConfig from "../systemConfig.js";

class QRCodeAuth {
    constructor(client, dbName, systemConfig) {
        if (!client || !dbName || !systemConfig) {
            throw new Error("MongoClient, dbName, and systemConfig are required to initialize QR_Code_Auth.");
        }

        this.client = client;
        this.dbName = dbName;
        this.systemConfig = systemConfig;

        this.qrCodeDir = path.join(process.cwd(), "QR_Codes");
        this.ensureQRCodeDirectory();
        this.core = this.initializeCore();
        this.sessions = new Map(); // Store active sessions
    }

    ensureQRCodeDirectory() {
        if (!fs.existsSync(this.qrCodeDir)) {
            fs.mkdirSync(this.qrCodeDir, { recursive: true });
            console.log("QR code directory created.");
        }
    }

    initializeCore() {
        console.log("Initializing WalletConnect Core...");
        const core = new Core({
            projectId: this.systemConfig.walletConnect.projectId,
        });
        core.relayer.on("relayer_connect", () => console.log("Connected to relay server."));
        return core;
    }

    async generateQRCode() {
        try {
            // Connect the relayer
            await this.core.relayer.connect();

            console.log("init paring")
            // Create a pairing URI
            // const pairing = await this.core.pairing.create();
            // const uri = pairing.uri;

            // Generate a unique session ID
            const sessionId = `session_${Date.now()}`;
            // this.sessions.set(sessionId, { uri, status: "pending" });

            // Save QR code to file
            const filePath = path.join(this.qrCodeDir, `${sessionId}.png`);
            await qrCode.toFile(filePath, "uri");

            const publicUrl = `${this.systemConfig.walletConnect.qrCodeBaseUrl}/${path.basename(filePath)}`;
            return { sessionId, qrCodeUrl: publicUrl, walletConnectUri: "uri" };
        } catch (error) {
            console.error("Error generating QR code:", error);
            throw new Error("Failed to generate QR code.");
        }
    }

    async verifySignature(sessionId, signature, message) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error("Invalid session ID.");
        }

        const { uri } = session;

        // Use the WalletConnect SDK to verify the signature
        const verified = this.core.verify({ uri, signature, message });
        if (verified) {
            session.status = "authenticated";
            return { status: "success", message: "Authentication successful." };
        } else {
            throw new Error("Invalid signature.");
        }
    }
}

export default QRCodeAuth;
