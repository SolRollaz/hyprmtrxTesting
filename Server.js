// Load dependencies
import dotenv from 'dotenv';
import express from 'express';
import { MongoClient } from 'mongodb';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { WebSocketServer } from 'ws';
import http from 'http';
import authRoutes from './api/auth/index.js';

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

// ✅ Connect to MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        console.log('✅ Connected to MongoDB');
        db = client.db(dbName);
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

// ✅ Apply Middleware
app.use(bodyParser.json());
app.use(cors());
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

// ✅ Mount API Routes (Delegating to `index.js`)
console.log("✅ Registering auth routes at /api/auth");
app.use("/api/auth", authRoutes);

// ✅ Root Route
app.get('/', (req, res) => res.status(200).send('API is running successfully.'));

// ✅ Handle WebSocket Upgrades
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

// ✅ WebSocket Handling
wss.on("connection", (ws) => {
    console.log("✅ WebSocket connected.");
    ws.on("close", () => console.log("❌ WebSocket connection closed."));
    ws.on("error", (error) => console.error("⚠️ WebSocket Error:", error));
});

// ✅ Start Server
(async () => {
    await connectToMongoDB();
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})();
