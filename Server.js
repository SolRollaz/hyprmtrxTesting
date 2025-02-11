import { WebSocketServer } from 'ws';
import http from 'http';
import requestIp from 'request-ip';
import AuthEndpoint from './api/auth/AuthEndpoint.js';

// Load environment variables
dotenv.config();
@@ -29,7 +30,9 @@ const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'hyprmtrx';
let db;

// ✅ FIX: Handle WebSocket upgrades BEFORE Express middleware
const authEndpoint = new AuthEndpoint();

// Handle WebSocket upgrades
server.on('upgrade', (request, socket, head) => {
if (request.url === "/api/auth") {
console.log("🔥 Upgrading connection to WebSocket...");
@@ -41,13 +44,10 @@ server.on('upgrade', (request, socket, head) => {
}
});

// 🔥 Connect to MongoDB
// Connect to MongoDB
async function connectToMongoDB() {
try {
        const client = new MongoClient(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
await client.connect();
console.log('✅ Connected to MongoDB');
db = client.db(dbName);
@@ -57,7 +57,7 @@ async function connectToMongoDB() {
}
}

// ✅ Express Middleware (After WebSocket Setup)
// Express Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(helmet());
@@ -74,101 +74,31 @@ app.use(

// API Routes
app.get('/', (req, res) => res.status(200).send('API is running successfully.'));
app.post('/api/auth', (req, res) => authEndpoint.handleRequest(req, res));

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

// WebSocket Handling
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
                console.log("⚡ WebSocket Authentication Request...");
                await authEndpoint.handleWebSocketMessage(ws);
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
    ws.on("close", () => console.log("❌ WebSocket connection closed."));
    ws.on("error", (error) => console.error("⚠️ WebSocket Error:", error));
});


// Start the Server
// Start Server
(async () => {
await connectToMongoDB();
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
