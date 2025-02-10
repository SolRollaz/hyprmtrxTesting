// Load dependencies
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

// ✅ FIX: Handle WebSocket upgrades BEFORE Express middleware
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

// 🔥 Connect to MongoDB
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

// ✅ Express Middleware (After WebSocket Setup)
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

// API Routes
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

// 🔥 WebSocket Connection Handling
const connections = new Map();

wss.on("connection", (ws) => {
    console.log("✅ WebSocket connected.");

    ws.on("message", async (message) => {
        try {
            console.log("📩 Received WebSocket Message:", message);
            const { action } = JSON.parse(message);

            if (action === "authenticateUser") {
                console.log("⚡ Generating QR Code...");

                // ✅ Add this try-catch block to catch errors
                try {
                    const qrCodeResult = await generateQRCode(); // Replace with actual function

                    if (qrCodeResult.status !== "success") {
                        console.error("❌ QR Code generation failed:", qrCodeResult.message);
                        ws.send(JSON.stringify({ error: "Failed to generate QR Code" }));
                        return;
                    }

                    console.log("✅ Sending QR Code:", qrCodeResult.qrCodeUrl);
                    ws.send(JSON.stringify({ qrCodeUrl: qrCodeResult.qrCodeUrl }));
                } catch (error) {
                    console.error("❌ Error generating QR Code:", error);
                    ws.send(JSON.stringify({ error: "QR Code generation error" }));
                }
            }
        } catch (error) {
            console.error("❌ Error processing WebSocket message:", error);
            ws.send(JSON.stringify({ error: "Invalid WebSocket message" }));
        }
    });

    ws.on("close", () => {
        console.log("❌ WebSocket connection closed.");
    });

    ws.on("error", (error) => {
        console.error("⚠️ WebSocket Error:", error);
    });
});


// Start the Server
(async () => {
    await connectToMongoDB();
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})();
