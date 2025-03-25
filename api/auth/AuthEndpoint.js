import express from "express";
import QRCodeAuth from "../../HVM/QRCode_Auth_new.js";
import SystemConfig from "../../systemConfig.js";
import { MongoClient } from "mongodb";
import MasterAuth from "../../HVM/MasterAuth.js";
import SessionStore from "../../HVM/SessionStore.js";

class AuthEndpoint {
    constructor() {
        this.systemConfig = new SystemConfig();
        this.mongoUri = process.env.MONGO_URI || this.systemConfig.getMongoUri();
        this.dbName = process.env.MONGO_DB_NAME || this.systemConfig.getMongoDbName();

        if (!this.mongoUri || !this.dbName) {
            throw new Error("❌ Mongo URI or DB Name is not defined.");
        }

        this.client = new MongoClient(this.mongoUri, { useUnifiedTopology: true });

        this.qrCodeAuth = new QRCodeAuth(this.client, this.dbName, this.systemConfig);
        this.masterAuth = new MasterAuth(this.client, this.dbName);
        this.webSocketClients = new Map(); // Active WebSocket connections
    }

    async handleRequest(req, res) {
        console.log("📩 Incoming Auth Request:", req.body);

        if (!req.body.auth || req.body.auth !== "auth") {
            return res.status(400).json({ status: "failure", message: "Invalid or missing 'auth' parameter." });
        }

        try {
            const qrCodeResult = await this.qrCodeAuth.generateAuthenticationQRCode();

            if (qrCodeResult.status !== "success") {
                console.error("❌ QR Code generation failed:", qrCodeResult.message);
                return res.status(500).json({ status: "failure", message: qrCodeResult.message });
            }

            return res.status(200).json({
                status: "success",
                qrCodeBase64: qrCodeResult.qrCodeBase64,
                sessionId: qrCodeResult.sessionId,
                walletConnectUri: qrCodeResult.walletConnectUri
            });

        } catch (error) {
            console.error("❌ Error generating QR code:", error.message);
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

                if (data.action === "authenticateUser") {
                    const qrCodeResult = await this.qrCodeAuth.generateAuthenticationQRCode();

                    if (qrCodeResult.status !== "success") {
                        console.error("❌ QR Code generation failed:", qrCodeResult.message);
                        return ws.send(JSON.stringify({ error: "Failed to generate QR Code" }));
                    }

                    ws.send(JSON.stringify({
                        status: "success",
                        qrCodeBase64: qrCodeResult.qrCodeBase64,
                        sessionId: qrCodeResult.sessionId,
                        walletConnectUri: qrCodeResult.walletConnectUri
                    }));

                } else if (data.action === "verifyAuthentication") {
                    const { walletAddress, signedMessage, authType, gameName } = data;

                    const authResult = await this.masterAuth.verifySignedMessage(
                        walletAddress,
                        signedMessage,
                        authType,
                        gameName
                    );

                    if (authResult.status === "success") {
                        SessionStore.set(authResult.token, walletAddress); // ✅ Store JWT + walletAddress
                    }

                    this.sendAuthResponseToGame(ws, authResult);
                }
            } catch (error) {
                console.error("❌ WebSocket processing error:", error);
                ws.send(JSON.stringify({ error: "Invalid WebSocket message" }));
            }
        });

        ws.on("close", () => {
            console.log("❌ WebSocket Client Disconnected");
            this.webSocketClients.delete(clientId);
        });

        ws.on("error", (error) => {
            console.error("⚠️ WebSocket Error:", error);
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
            console.log("✅ Sent authentication response to game:", responsePayload);
        } catch (error) {
            console.error("❌ Error sending authentication response to game:", error.message);
        }
    }

    async sendJWTToClient(sessionId, token) {
        for (const [clientId, ws] of this.webSocketClients) {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ token }));
                ws.close();
                this.webSocketClients.delete(clientId);
            }
        }
    }
}

export default AuthEndpoint;
