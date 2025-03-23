// File: /api/auth/index.js
import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import AuthEndpoint from './AuthEndpoint.js';

// Setup __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log("✅ Loaded Mongo URI:", process.env.MONGO_URI);
console.log("✅ Current Working Directory:", process.cwd());

const app = express();
const server = http.createServer(app);
const port = 3000;
const authAPI = new AuthEndpoint();

// ✅ CORS middleware — Must come BEFORE routes
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "https://hyprmtrx.com");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

// ✅ Middleware
app.use(express.json());
app.use(express.static("public"));

// ✅ Rate Limiting
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { status: "failure", message: "Too many authentication attempts. Try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

// ✅ Routes
app.post(['/', '/api/auth/'], authLimiter, async (req, res) => {
    try {
        await authAPI.handleRequest(req, res);
    } catch (e) {
        console.error("❌ API Error in /api/auth:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/", (req, res) => {
    res.status(200).json({ message: "Auth API is working!" });
});

app.get("/api/generate-qr", async (req, res) => {
    try {
        await authAPI.handleQRCodeRequest(res);
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

app.post("/api/check-username", async (req, res) => {
    try {
        const { walletAddress, userName } = req.body;

        if (!walletAddress || !userName) {
            return res.status(400).json({
                status: "failure",
                message: "Missing walletAddress or userName"
            });
        }

        await authAPI.checkUserName.handleREST(req, res);
    } catch (e) {
        console.error("❌ API Error in /api/check-username:", e);
        res.status(500).json({ status: "failure", message: "Server error" });
    }
});

// ✅ Serve .well-known files (WalletConnect)
app.get("/.well-known/walletconnect.txt", (req, res) => {
    res.sendFile(path.resolve(process.cwd(), "public", "walletconnect.txt"));
});

// ✅ WebSocket support
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
    authAPI.handleWebSocketConnection(ws);
});

// ✅ Start server
server.listen(port, () => {
    console.log(`🚀 Auth API running on http://localhost:${port}`);
});
