import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import AuthEndpoint from './AuthEndpoint.js';
import cors from 'cors';

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

// API Routes
app.post('/api/auth', (req, res) => {
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
