// index.js
import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import AuthEndpoint from './AuthEndpoint.js';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '.env') });
console.log("✅ Loaded Mongo URI:", process.env.MONGO_URI);
console.log("✅ Current Working Directory:", process.cwd());

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

// Init Auth Handler
const authAPI = new AuthEndpoint();

// ✅ CORS Fix (Allow hyprmtrx.com)
const corsOptions = {
    origin: 'https://hyprmtrx.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // 🔥 FIXES preflight

// ✅ Middleware
app.use(express.json());
app.use(express.static("public"));

// ✅ Rate Limiter
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    message: { status: "failure", message: "Too many authentication attempts. Try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

// ✅ API Routes
app.post(['/', '/api/auth/'], authLimiter, async (req, res) => {
    try {
        await authAPI.handleRequest(req, res);
    } catch (e) {
        console.error("❌ API Error in /api/auth:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/.well-known/walletconnect.txt", (req, res) => {
    res.sendFile(path.resolve(process.cwd(), "public", "walletconnect.txt"));
});

app.get("/", (req, res) => {
    res.status(200).json({ message: "Auth API is working!" });
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

// ✅ WebSocket Integration
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
    authAPI.handleWebSocketConnection(ws);
});

// ✅ Start server
server.listen(port, () => {
    console.log(`🚀 Auth API running on http://localhost:${port}`);
});
