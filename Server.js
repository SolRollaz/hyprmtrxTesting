import dotenv from 'dotenv'; // Load environment variables
import express from 'express'; // Import Express
import { MongoClient } from 'mongodb'; // MongoDB client
import bodyParser from 'body-parser'; // Parse request bodies
import cors from 'cors'; // Handle cross-origin requests
import helmet from 'helmet'; // Secure HTTP headers
import session from 'express-session'; // Manage user sessions
import { generateNonce } from 'siwe'; // Generate nonce for SIWE
import {
    verifySignature,
    getAddressFromMessage,
    getChainIdFromMessage,
} from '@reown/appkit-siwe'; // SIWE utilities
import { WebSocketServer } from 'ws'; // Import WebSocket Server
import http from 'http'; // Needed to combine Express with WebSockets

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app); // Create HTTP server for WebSockets
const wss = new WebSocketServer({ server, path: "/api/auth" }); // Ensure WebSocket listens on correct path

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
        console.log('Connected to MongoDB');
        db = client.db(dbName);
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

app.get('/', (req, res) => {
    res.status(200).send('API is running successfully.');
});

app.get('/users', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: 'Database connection not established.' });
        }
        const usersCollection = db.collection('users');
        const users = await usersCollection.find({}).toArray();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
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
        if (!message || !signature) {
            return res.status(400).json({ error: 'Message or signature is missing.' });
        }

        const address = getAddressFromMessage(message);
        const chainId = getChainIdFromMessage(message);

        const isValid = await verifySignature({
            address,
            message,
            signature,
            chainId,
            projectId: '1b54a5d583ce208cc28c1362cdd3d437',
        });

        if (!isValid) {
            throw new Error('Invalid signature');
        }

        req.session.siwe = { address, chainId };
        req.session.save(() => res.status(200).send(true));
    } catch (error) {
        console.error('Verification error:', error.message);
        req.session.siwe = null;
        req.session.save(() => res.status(500).json({ message: error.message }));
    }
});

app.get('/session', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(req.session.siwe || null);
});

app.get('/signout', (req, res) => {
    req.session.destroy(() => res.status(200).send(true));
});

const clients = new Map();

wss.on('connection', (ws) => {
    console.log('New WebSocket connection established.');
    const clientId = Math.random().toString(36).substr(2, 9);
    clients.set(clientId, ws);

    ws.send(JSON.stringify({ message: 'Connected to WebSocket server.' }));

    ws.on('close', () => {
        console.log(WebSocket client disconnected: ${clientId});
        clients.delete(clientId);
    });
});

app.post('/api/auth', (req, res) => {
    console.log('Auth request received.');
    res.sendFile('/path/to/generated-qrcode.png');

    setTimeout(() => {
        for (const [clientId, ws] of clients.entries()) {
            ws.send(JSON.stringify({ token: 'your-jwt-token-here' }));
        }
    }, 10000);
});

(async () => {
    await connectToMongoDB();
    server.listen(PORT, () => {
        console.log(Server is running on port ${PORT});
    });
})();
