// QRCodeAuth.js - Fix detecting signed messages
import { Core } from "@walletconnect/core";
import qrCode from "qrcode";
import path from "path";
import fs from "fs";
import systemConfig from "../systemConfig.js";

class QRCodeAuth {
    constructor(client, dbName, systemConfig) {
        if (!client || !dbName || !systemConfig) {
            throw new Error("MongoClient, dbName, and systemConfig are required.");
        }
        this.client = client;
        this.dbName = dbName;
        this.systemConfig = systemConfig;
        this.qrCodeDir = path.join(process.cwd(), "QR_Codes");
        this.ensureQRCodeDirectory();
        this.core = this.initializeCore();
        this.sessions = new Map(); // Store active Web3 authentication sessions
    }

    initializeCore() {
        const core = new Core({
            projectId: this.systemConfig.walletConnect.projectId,
        });

        core.relayer.on("relayer_connect", () => console.log("✅ Connected to WalletConnect relay server."));
        core.relayer.on("session_proposal", async (proposal) => {
            console.log("🔍 Session proposal received:", proposal);
        });

        core.relayer.on("session_update", (update) => {
            console.log("🔄 Session update received:", update);
        });
        return core;
    }

    async generateQRCode() {
        try {
            console.log("🚀 Generating WalletConnect URI...");
            const pairing = await this.core.pairing.create();
            const uri = pairing.uri;
            if (!uri) throw new Error("❌ Failed to generate WalletConnect URI.");

            const sessionId = `session_${Date.now()}`;
            this.sessions.set(sessionId, { uri, status: "pending" });

            const filePath = path.join(this.qrCodeDir, `${sessionId}.png`);
            await qrCode.toFile(filePath, uri);

            console.log(`✅ QR Code saved: ${filePath}`);
            return { status: "success", sessionId, qrCodeUrl: filePath, walletConnectUri: uri };
        } catch (error) {
            console.error("❌ QR Code generation failed:", error);
            return { status: "failure", message: "QR Code generation error" };
        }
    }

    async verifySignature(sessionId, signature, message) {
        if (!this.sessions.has(sessionId)) {
            throw new Error("❌ Invalid session ID.");
        }

        try {
            const session = this.sessions.get(sessionId);
            console.log("🔎 Verifying signature for session:", sessionId);

            const verified = this.core.verify({ uri: session.uri, signature, message });
            if (!verified) {
                throw new Error("❌ Invalid signature.");
            }

            session.status = "authenticated";
            console.log(`✅ Session ${sessionId} authenticated successfully.`);
            return { status: "success", message: "Authentication successful." };
        } catch (error) {
            console.error("❌ Error verifying signature:", error);
            throw new Error("Signature verification failed.");
        }
    }
}
export default QRCodeAuth;
