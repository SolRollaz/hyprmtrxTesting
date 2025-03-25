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
        this.webSocketClients = new Map();
    }

    async tryGenerateQRCodeWithRetry(attempts = 3, delayMs = 1000) {
        let lastError = null;
        for (let i = 1; i <= attempts; i++) {
            try {
                const result = await this.qrCodeAuth_NEW.generateQRCode();
                if (result.status === "success") return result;
                console.warn(`⚠️ Attempt ${i} failed:`, result.message);
            } catch (err) {
                lastError = err;
                console.warn(`⚠️ Attempt ${i} threw:`, err.message);
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        throw lastError || new Error("QR code generation failed after retries.");
    }

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

    async handleQRCodeRequest(res) {
        try {
            const qrCodeResult = await this.tryGenerateQRCodeWithRetry();

            const qrCodePath = path.join(process.cwd(), "QR_Codes", `${qrCodeResult.sessionId}.png`);
            if (!fs.existsSync(qrCodePath)) {
                console.error("❌ QR Code file not found at path:", qrCodePath);
                return res.status(500).json({ status: "failure", message: "QR Code file not found." });
            }

            console.log(`✅ Streaming QR Code from path: ${qrCodePath}`);
            res.setHeader("Content-Type", "image/png");
            res.setHeader("Content-Disposition", `inline; filename=${path.basename(qrCodePath)}`);
            fs.createReadStream(qrCodePath).pipe(res);
        } catch (error) {
            console.error("❌ QR generation error:", error.message);
            return res.status(500).json({ status: "failure", message: "Failed to generate QR code." });
        }
    }

    async handleWebSocketConnection(ws) {
        console.log("✅ WebSocket Client Connected");
        const clientId = Date.now().toString();
        this.webSocketClients.set(clientId, ws);

        ws.on("message", async (message) => {
            try {
                const data = JSON.parse(message);
                console.log("📩 WebSocket Received:", data);

                if (data.action === "ping") {
                    return ws.send(JSON.stringify({ type: "pong" }));
                }

                if (data.action === "authenticateUser") {
                    const qrCodeResult = await this.tryGenerateQRCodeWithRetry();

                    ws.send(JSON.stringify({
                        qrCodeUrl: qrCodeResult.qrCodeUrl,
                        sessionId: qrCodeResult.sessionId,
                        walletConnectUri: qrCodeResult.walletConnectUri,
                    }));
                }
            } catch (error) {
                console.error("❌ WebSocket message error:", error.message);
                ws.send(JSON.stringify({ error: "QR Code generation failed." }));
            }
        });

        ws.on("close", () => {
            console.log("❌ WebSocket Client Disconnected");
            this.webSocketClients.delete(clientId);
        });

        ws.on("error", (error) => {
            console.error("⚠️ WebSocket Error:", error.message);
        });
    }

    async sendJWTToClient(sessionId, token) {
        for (const [clientId, ws] of this.webSocketClients) {
            if (ws.readyState === ws.OPEN) {
                console.log("✅ Sending JWT to client:", clientId);
                ws.send(JSON.stringify({ token }));
                ws.close();
                this.webSocketClients.delete(clientId);
            }
        }
    }
}

export default AuthEndpoint;
