// File: /api/auth/index.js

import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import AuthEndpoint from './AuthEndpoint.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log("✅ Loaded Mongo URI:", process.env.MONGO_URI);

const app = express();
const server = http.createServer(app);
const port = 4000;
const authAPI = new AuthEndpoint();

// CORS
const allowedOrigins = ["https://hyprmtrx.com", "https://hyprmtrx.xyz"];
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

app.use(express.json());
app.use(express.static("public"));

const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { status: "failure", message: "Too many authentication attempts. Try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth routes
app.post(['/', '/api/auth/'], authLimiter, async (req, res) => {
    try {
        await authAPI.handleRequest(req, res);
    } catch (e) {
        console.error("❌ /api/auth:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/", (req, res) => res.status(200).json({ message: "Auth API is working!" }));

app.get("/api/generate-qr", async (_, res) => {
    try {
        await authAPI.handleQRCodeRequest(res);
    } catch (e) {
        console.error("❌ /api/generate-qr:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/verify-signature", async (req, res) => {
    try {
        await authAPI.handleVerifySignature(req, res);
    } catch (e) {
        console.error("❌ /api/verify-signature:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/check-username", async (req, res) => {
    const { walletAddress, userName } = req.body;
    if (!walletAddress || !userName) {
        return res.status(400).json({ status: "failure", message: "Missing walletAddress or userName" });
    }
    try {
        await authAPI.checkUserName.handleREST(req, res);
    } catch (e) {
        console.error("❌ /api/check-username:", e);
        res.status(500).json({ status: "failure", message: "Server error" });
    }
});

app.get("/.well-known/walletconnect.txt", (req, res) => {
    res.sendFile(path.resolve(process.cwd(), "public", "walletconnect.txt"));
});

// WebSocket
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => authAPI.handleWebSocketConnection(ws));

// Boot
server.listen(port, () => {
    console.log(`🚀 Auth API running on http://localhost:${port}`);
});
