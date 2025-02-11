import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import AuthEndpoint from './AuthEndpoint.js';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log("Loaded Mongo URI:", process.env.MONGO_URI);
console.log("Current Working Directory:", process.cwd());

// Create Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Enable CORS
app.use(
    cors({
        origin: "https://hyprmtrx.com",
        methods: "GET,POST,PUT,DELETE,OPTIONS",
        allowedHeaders: "Content-Type,Authorization",
        credentials: true,
    })
);

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.static("public"));

// Initialize AuthEndpoint instance
const authAPI = new AuthEndpoint();

// Rate Limiting: Restrict /api/auth requests to 5 per minute per IP
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 requests per windowMs
    message: { status: "failure", message: "Too many authentication attempts. Try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

// API Routes
app.post('/api/auth', authLimiter, (req, res) => {
    try {
        authAPI.handleRequest(req, res);
    } catch (e) {
        console.error("❌ API Error in /api/auth:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/.well-known/walletconnect.txt", (req, res) => {
    res.sendFile(path.resolve(process.cwd(), "public", "walletconnect.txt"));
});

app.get("/api/generate-qr", async (req, res) => {
    try {
        await authAPI.handleQRCode(req, res);
    } catch (e) {
        console.error("❌ API Error in /api/generate-qr:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/verify-signature", async (req, res) => {
    try {
        await authAPI.handleVerifySignature(req, res);
    } catch (e) {
        console.error("❌ API Error in /api/verify-signature:", e);
        res.status(500).json({ error: e.message });
    }
});

// WebSocket Handling
server.on('upgrade', (request, socket, head) => {
    if (request.url === "/api/auth") {
        console.log("🔥 Upgrading connection to WebSocket...");
        wss.handleUpgrade(request, socket, head, (ws) => {
            authAPI.handleWebSocketMessage(ws);
        });
    } else {
        socket.destroy();
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Authentication API running at http://127.0.0.1:${PORT}/api/auth`);
    console.log(`🌐 Public access at https://hyprmtrx.xyz/api/auth`);
});


Then QRCodeAuth.js is called to create a qr code and send it to the game.
The user scans it with a web3 wallet, to authenticate it.

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
        if (!fs.existsSync(this.qrCodeDir)) {
            fs.mkdirSync(this.qrCodeDir, { recursive: true });
            console.log("📁 QR code directory created.");
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
