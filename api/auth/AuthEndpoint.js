import express from "express";
import QR_Code_Auth from "../../HVM/QRCode_Auth.js";
import QRCodeAuth from "../../HVM/QRCode_Auth_new.js";
import SystemConfig from "../../systemConfig.js";
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import MasterAuth from "../../HVM/MasterAuth.js";
import WebSocket from "ws";
import CheckUserName from "./CheckUserName.js";

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
        this.qrCodeAuth = new QR_Code_Auth(this.client, this.dbName, this.systemConfig);
        this.masterAuth = new MasterAuth(this.client); // ✅ FIXED
        this.checkUserName = new CheckUserName(this.client);
        this.webSocketClients = new Map();
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
                    console.log("⚡ Generating QR Code...");
                    const qrCodeResult = await this.qrCodeAuth.generateAuthenticationQRCode();

                    if (qrCodeResult.status !== "success") {
                        console.error("❌ QR Code generation failed:", qrCodeResult.message);
                        return ws.send(JSON.stringify({ error: "Failed to generate QR Code" }));
                    }

                    ws.send(JSON.stringify({ qrCodeUrl: qrCodeResult.qrCodeUrl }));
                } else if (data.action === "verifyAuthentication") {
                    console.log("⚡ Verifying Authentication...");
                    const { walletAddress, signedMessage, authType, gameName, userName } = data;
                    const authResult = await this.masterAuth.verifySignedMessage(walletAddress, signedMessage, authType, gameName, userName);

                    if (authResult.status === "awaiting_username") {
                        return ws.send(JSON.stringify({
                            status: "awaiting_username",
                            message: authResult.message,
                            walletAddress: authResult.walletAddress
                        }));
                    }

                    this.sendAuthResponseToGame(ws, authResult);
                } else if (data.action === "checkUserName") {
                    console.log("🔎 Checking user name...");
                    const { walletAddress, userName } = data;
                    await this.checkUserName.handle(ws, walletAddress, userName);
                }
            } catch (error) {
                console.error("❌ Error processing WebSocket message:", error);
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
            if (ws.readyState === WebSocket.OPEN) {
                console.log("✅ Sending JWT to client:", clientId);
                ws.send(JSON.stringify({ token }));
                ws.close();
                this.webSocketClients.delete(clientId);
            }
        }
    }
}

export default AuthEndpoint;
