import { Core } from "@walletconnect/core";
import qrCode from "qrcode";
import path from "path";
import fs from "fs";
import systemConfig from "../systemConfig.js";

class QRCodeAuth {
    constructor(client, dbName, systemConfig) {
        if (!client || !dbName || !systemConfig) {
            throw new Error("MongoClient, dbName, and systemConfig are required to initialize QRCodeAuth.");
        }

        this.client = client;
        this.dbName = dbName;
        this.systemConfig = systemConfig;

        this.qrCodeDir = path.join(process.cwd(), "QR_Codes");
        this.ensureQRCodeDirectory();
        this.core = this.initializeCore();
        this.sessions = new Map(); // Store active Web3 authentication sessions
    }

    ensureQRCodeDirectory() {
    const fs = require("fs");
    if (!fs.existsSync(this.qrCodeDir)) {
        fs.mkdirSync(this.qrCodeDir, { recursive: true });
        console.log("✅ QR Code directory created.");
    }
}

    initializeCore() {
        console.log("🔄 Initializing WalletConnect Core...");
        const core = new Core({
            projectId: this.systemConfig.walletConnect.projectId,
        });

        core.relayer.on("relayer_connect", () => console.log("✅ Connected to WalletConnect relay server."));
        core.relayer.on("relayer_disconnect", () => console.log("⚠️ Disconnected from WalletConnect relay server."));

        return core;
    }

    async generateQRCode() {
        try {
            console.log("🚀 Starting QR Code Generation...");

            // Step 1: Create a WalletConnect pairing URI
            const pairing = await this.core.pairing.create();
            const uri = pairing.uri;

            if (!uri) {
                throw new Error("❌ Failed to generate WalletConnect URI.");
            }

            console.log("🔗 WalletConnect URI Created:", uri);

            // Step 2: Generate a unique session ID
            const sessionId = `session_${Date.now()}`;
            this.sessions.set(sessionId, { uri, status: "pending" });

            // Step 3: Save QR code to file
            const filePath = path.join(this.qrCodeDir, `${sessionId}.png`);
            await qrCode.toFile(filePath, uri);

            console.log(`✅ QR Code saved: ${filePath}`);

            // Step 4: Generate a public URL for the QR code
            const publicUrl = `${this.systemConfig.walletConnect.qrCodeBaseUrl}/${path.basename(filePath)}`;

            return { 
                status: "success",
                sessionId, 
                qrCodeUrl: publicUrl, 
                walletConnectUri: uri 
            };

        } catch (error) {
            console.error("❌ Error generating QR code:", error.message);
            return { status: "failure", message: "QR Code generation error" };
        }
    }

    async verifySignature(sessionId, signature, message) {
        if (!this.sessions.has(sessionId)) {
            throw new Error("❌ Invalid session ID.");
        }

        try {
            // Retrieve session info
            const session = this.sessions.get(sessionId);
            console.log("🔎 Verifying signature for session:", sessionId);

            // Validate signature using WalletConnect
            const verified = this.core.verify({
                uri: session.uri,
                signature,
                message
            });

            if (!verified) {
                throw new Error("❌ Invalid signature.");
            }

            // Mark session as authenticated
            session.status = "authenticated";
            console.log(`✅ Session ${sessionId} authenticated successfully.`);
            return { status: "success", message: "Authentication successful." };

        } catch (error) {
            console.error("❌ Error verifying signature:", error.message);
            throw new Error("Signature verification failed.");
        }
    }
}

export default QRCodeAuth;
