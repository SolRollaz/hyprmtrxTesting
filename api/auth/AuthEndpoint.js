import QRCodeAuth from "../../HVM/QRCode_Auth_new.js";
import SystemConfig from "../../systemConfig.js";
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import MasterAuth from "../../HVM/MasterAuth.js";

class AuthEndpoint {
    constructor() {
        this.systemConfig = new SystemConfig();
        this.mongoUri = process.env.MONGO_URI || this.systemConfig.getMongoUri();
        this.dbName = process.env.MONGO_DB_NAME || this.systemConfig.getMongoDbName();

        if (!this.mongoUri || !this.dbName) {
            throw new Error("❌ Mongo URI or DB Name is not defined.");
        }

        this.client = new MongoClient(this.mongoUri, {
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
        });

        this.client.connect()
            .then(() => console.log("✅ MongoDB connected successfully"))
            .catch((err) => {
                console.error("❌ MongoDB connection failed:", err.message);
                process.exit(1);
            });

        this.qrCodeAuth_NEW = new QRCodeAuth(this.client, this.dbName, this.systemConfig);
        this.masterAuth = new MasterAuth(this.client, this.dbName);
        this.webSocketClients = new Map();
    }

    async handleRequest(req, res) {
        if (!req.body.auth || req.body.auth !== "auth") {
            return res.status(400).json({ status: "failure", message: "Invalid or missing 'auth' parameter." });
        }
        try {
            return await this.handleQRCodeRequest(res);
        } catch (error) {
            console.error("❌ handleRequest error:", error.message);
            return res.status(500).json({ status: "failure", message: "Internal server error." });
        }
    }

    async handleQRCodeRequest(res) {
        try {
            const qrCodeResult = await this.qrCodeAuth_NEW.generateQRCode();
            if (qrCodeResult.status !== "success") {
                return res.status(500).json({ status: "failure", message: qrCodeResult.message });
            }

            const qrCodePath = path.join(process.cwd(), "QR_Codes", `${qrCodeResult.sessionId}.png`);
            if (!fs.existsSync(qrCodePath)) {
                return res.status(500).json({ status: "failure", message: "QR Code file not found." });
            }

            res.setHeader("Content-Type", "image/png");
            res.setHeader("Content-Disposition", `inline; filename=${path.basename(qrCodePath)}`);
            fs.createReadStream(qrCodePath).pipe(res);
        } catch (error) {
            console.error("❌ QR generation error:", error.message);
            res.status(500).json({ status: "failure", message: "Failed to generate QR code." });
        }
    }

    async handleWebSocketConnection(ws) {
    const clientId = Date.now().toString();
    this.webSocketClients.set(clientId, ws);
    console.log("✅ WebSocket Client Connected");

    ws.on("message", async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.action === "ping") {
                return ws.send(JSON.stringify({ type: "pong" }));
            }

            if (data.action === "authenticateUser") {
                const qrCodeResult = await this.qrCodeAuth_NEW.generateQRCode();
                if (qrCodeResult.status !== "success") {
                    return ws.send(JSON.stringify({ error: "Failed to generate QR Code" }));
                }
                ws.send(JSON.stringify({ qrCodeUrl: qrCodeResult.qrCodeUrl }));

            } else if (data.action === "verifyAuthentication") {
                const { walletAddress, signedMessage, authType, gameName } = data;
                const authResult = await this.masterAuth.verifySignedMessage(walletAddress, signedMessage, authType, gameName);
                this.sendAuthResponseToGame(ws, authResult);
            }
        } catch (error) {
            console.error("❌ WebSocket processing error:", error.message);
            ws.send(JSON.stringify({ error: "Invalid WebSocket message" }));
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


    sendAuthResponseToGame(ws, authResult) {
        try {
            const responsePayload = {
                status: authResult.status,
                message: authResult.message,
                userName: authResult.userName || null,
                token: authResult.token || null,
            };
            ws.send(JSON.stringify(responsePayload));
            console.log("✅ Auth response sent:", responsePayload);
        } catch (error) {
            console.error("❌ Failed to send auth response:", error.message);
        }
    }

    async sendJWTToClient(sessionId, token) {
        for (const [clientId, ws] of this.webSocketClients) {
            if (ws.readyState === 1) {
                ws.send(JSON.stringify({ token }));
                ws.close();
                this.webSocketClients.delete(clientId);
            }
        }
    }
}

export default AuthEndpoint;
