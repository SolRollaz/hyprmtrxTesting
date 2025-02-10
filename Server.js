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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'hyprmtrx';
let db;

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

async function connectToMongoDB() {
    try {
        const client = new MongoClient(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        await client.connect();
        console.log('✅ Connected to MongoDB');
        db = client.db(dbName);
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

// API ROUTES
app.get('/', (req, res) => res.status(200).send('API is running successfully.'));

app.get('/users', async (req, res) => {
    try {
        if (!db) return res.status(500).json({ error: 'Database connection not established.' });
        const usersCollection = db.collection('users');
        const users = await usersCollection.find({}).toArray();
        res.json(users);
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

app.get('/nonce', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(generateNonce());
});

app.post('/verify', async (req, res) => {
    try {
        const { message, signature } = req.body;
        if (!message || !signature) return res.status(400).json({ error: 'Message or signature is missing.' });

        const address = getAddressFromMessage(message);
        const chainId = getChainIdFromMessage(message);
        const isValid = await verifySignature({
            address,
            message,
            signature,
            chainId,
            projectId: '1b54a5d583ce208cc28c1362cdd3d437',
        });

        if (!isValid) throw new Error('Invalid signature');

        req.session.siwe = { address, chainId };
        req.session.save(() => res.status(200).send(true));
    } catch (error) {
        console.error('❌ Verification error:', error.message);
        req.session.siwe = null;
        req.session.save(() => res.status(500).json({ message: error.message }));
    }
});

app.get('/session', (req, res) => res.json(req.session.siwe || null));
app.get('/signout', (req, res) => req.session.destroy(() => res.status(200).send(true)));

// 🔥 FIX WEBSOCKET UPGRADE (NO MORE 404s)
server.on('upgrade', (request, socket, head) => {
    if (request.url === "/api/auth") {
        console.log("🔄 WebSocket upgrade request received on /api/auth");
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
        });
    } else {
        console.log(`🚨 Invalid WebSocket request: ${request.url}`);
        socket.destroy();
    }
});

// 🔥 WebSocket Connection Tracking
const connections = new Map();

wss.on('connection', (ws, req) => {
    const ip = requestIp.getClientIp(req) || req.socket.remoteAddress;

    if (!connections.has(ip)) connections.set(ip, 0);
    if (connections.get(ip) >= 3) {
        console.log(`🚨 Too many connections from ${ip}, closing WebSocket.`);
        ws.close(1008, "Too many connections");
        return;
    }

    connections.set(ip, connections.get(ip) + 1);
    console.log(`✅ WebSocket connected from ${ip} (Connections: ${connections.get(ip)})`);

    ws.send(JSON.stringify({ message: 'Connected to WebSocket server.' }));

    ws.on('message', (message) => console.log(`📩 Received from ${ip}: ${message}`));
    ws.on('close', () => {
        connections.set(ip, Math.max(0, connections.get(ip) - 1));
        console.log(`❌ WebSocket closed from ${ip}. Remaining connections: ${connections.get(ip)}`);
    });
});

// Start Server
(async () => {
    await connectToMongoDB();
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})();
