// Server.js - Fully Restored & Fixed
import dotenv from 'dotenv';
import express from 'express';
import { MongoClient } from 'mongodb';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { generateNonce } from 'siwe';
import {
    verifySignature,
    getAddressFromMessage,
    getChainIdFromMessage,
} from '@reown/appkit-siwe';
import { WebSocketServer } from 'ws';
import http from 'http';
import requestIp from 'request-ip';
import authRoutes from "./api/auth/index.js";
import AuthEndpoint from './api/auth/AuthEndpoint.js';

// Load environment variables
dotenv.config();

// Express & WebSocket Setup
const app = express();
const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'hyprmtrx';
let db;
const authEndpoint = new AuthEndpoint();

// ✅ Ensure CORS is applied first
app.use(cors({
    origin: "https://hyprmtrx.com",
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true
}));
app.options("*", cors());

// Middleware
app.use(bodyParser.json());
app.use(helmet());
app.use(
    session({
        name: 'siwe-session',
        secret: 'siwe-quickstart-secret',
        resave: true,
        saveUninitialized: true,
        cookie: { secure: false, sameSite: true },
    })
);

// ✅ Fix: Register API routes properly
app.use("/api/auth", authRoutes);

// API Routes
app.get('/', (req, res) => {
    res.header("Access-Control-Allow-Origin", "https://hyprmtrx.com");
    res.status(200).send('API is running successfully.');
});

// Handle WebSocket upgrades
server.on('upgrade', (request, socket, head) => {
    if (request.url === "/api/auth") {
        console.log("🔥 Upgrading connection to WebSocket...");
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
        });
    } else {
        socket.destroy();
    }
});

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        await client.connect();
        console.log('✅ Successfully connected to Digital Ocean MongoDB');
        db = client.db(process.env.MONGO_DB_NAME);
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

// WebSocket Handling
wss.on("connection", (ws) => {
    console.log("✅ WebSocket connected.");

    ws.on("message", async (message) => {
        try {
            const { action } = JSON.parse(message);

            if (action === "authenticateUser") {
                console.log("⚡ WebSocket Authentication Request...");
                await authEndpoint.handleWebSocketMessage(ws);
            }
        } catch (error) {
            console.error("❌ Error processing WebSocket message:", error);
            ws.send(JSON.stringify({ error: "Invalid WebSocket message" }));
        }
    });

    ws.on("close", () => console.log("❌ WebSocket connection closed."));
    ws.on("error", (error) => console.error("⚠️ WebSocket Error:", error));
});

// Start Server
(async () => {
    await connectToMongoDB();
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})();
