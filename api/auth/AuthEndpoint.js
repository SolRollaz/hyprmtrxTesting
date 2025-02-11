import express from "express";
import QR_Code_Auth from "../../HVM/QRCode_Auth.js";
import QRCodeAuth from "../../HVM/QRCode_Auth_new.js";
import SystemConfig from "../../systemConfig.js";
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";

class AuthEndpoint {
    constructor() {
        this.systemConfig = new SystemConfig();
        this.mongoUri = process.env.MONGO_URI || this.systemConfig.getMongoUri();
        this.dbName = process.env.MONGO_DB_NAME || this.systemConfig.getMongoDbName();

        if (!this.mongoUri || !this.dbName) {
            throw new Error("❌ Mongo URI or DB Name is not defined.");
        }

        this.client = new MongoClient(this.mongoUri, { useUnifiedTopology: true });
        this.qrCodeAuth_NEW = new QRCodeAuth(this.client, this.dbName, this.systemConfig);
        this.qrCodeAuth = new QR_Code_Auth(this.client, this.dbName, this.systemConfig);
    }

    /**
     * 🔥 Handles incoming authentication requests.
     * - Checks if the request contains the correct auth parameter.
     * - Generates and sends a QR Code if valid.
     */
    async handleRequest(req, res) {
        console.log("📩 Incoming Auth Request:", req.body);

        if (!req.body.auth || req.body.auth !== "auth") {
            return res.status(400).json({ status: "failure", message: "Invalid or missing 'auth' parameter." });
        }

        try {
            return await this.handleQRCodeRequest(res);
        } catch (error) {
            console.error("❌ Error handling request:", error.message);
            return res.status(500).json({ status: "failure", message: "Internal server error." });
        }
    }

    /**
     * ✅ Generates and returns a QR Code via HTTP response.
     * - Fetches QR code path from `QRCodeAuth`.
     * - Streams the QR code as an image response.
     */
    async handleQRCodeRequest(res) {
        try {
            const qrCodeResult = await this.qrCodeAuth.generateAuthenticationQRCode();

            if (qrCodeResult.status !== "success") {
                console.error("❌ QR Code generation failed:", qrCodeResult.message);
                return res.status(500).json({ status: "failure", message: qrCodeResult.message });
            }

            const qrCodePath = qrCodeResult.qr_code_path;

            if (!fs.existsSync(qrCodePath)) {
                console.error("❌ QR Code file not found at path:", qrCodePath);
                return res.status(500).json({ status: "failure", message: "QR Code file not found." });
            }

            console.log(`✅ Streaming QR Code from path: ${qrCodePath}`);

            res.setHeader("Content-Type", "image/png");
            res.setHeader("Content-Disposition", `inline; filename=${path.basename(qrCodePath)}`);

            const qrStream = fs.createReadStream(qrCodePath);
            qrStream.pipe(res);

            qrStream.on("close", () => {
                console.log(`✅ QR Code successfully streamed to the client: ${qrCodePath}`);
            });

            qrStream.on("error", (error) => {
                console.error("❌ Error streaming the QR Code file:", error.message);
                res.status(500).json({ status: "failure", message: "Error streaming the QR Code file." });
            });
        } catch (error) {
            console.error("❌ Error generating QR code:", error.message);
            return res.status(500).json({ status: "failure", message: "Failed to generate QR code." });
        }
    }

    /**
     * ✅ Handles QR Code retrieval (for alternative method).
     */
    async handleQRCode(req, res) {
        try {
            const result = await this.qrCodeAuth_NEW.generateAuthenticationQRCode();
            res.json(result);
        } catch (error) {
            res.status(500).json({ status: "failure", message: error.message });
        }
    }

    /**
     * ✅ Verifies Web3 signatures via QR authentication.
     */
    async handleVerifySignature(req, res) {
        const { sessionId, signature, message } = req.body;
        try {
            if (!sessionId || !signature || !message) {
                throw new Error("Missing sessionId, signature, or message.");
            }
            const result = await this.qrCodeAuth_NEW.verifySignature(sessionId, signature, message);
            res.json(result);
        } catch (error) {
            res.status(400).json({ status: "failure", message: error.message });
        }
    }

    /**
     * ✅ Handles WebSocket messages for QR authentication.
     * - Generates and sends QR Code to WebSocket clients.
     */
    async handleWebSocketMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            console.log("📩 WebSocket Received:", data);

            if (data.action === "authenticateUser") {
                console.log("⚡ Generating QR Code...");
                const qrCodeResult = await this.qrCodeAuth.generateAuthenticationQRCode();

                if (qrCodeResult.status !== "success") {
                    console.error("❌ QR Code generation failed:", qrCodeResult.message);
                    return ws.send(JSON.stringify({ error: "Failed to generate QR Code" }));
                }

                ws.send(JSON.stringify({ qrCodeUrl: qrCodeResult.qrCodeUrl }));
            }
        } catch (error) {
            console.error("❌ Error processing WebSocket message:", error);
            ws.send(JSON.stringify({ error: "Invalid WebSocket message" }));
        }
    }
}

export default AuthEndpoint;
