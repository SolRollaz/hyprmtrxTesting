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

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Server port

// MongoDB Configuration
const mongoUri = process.env.MONGO_URI; // Ensure this is set in your .env
const dbName = process.env.MONGO_DB_NAME || 'hyprmtrx'; // Default database name
let db; // Global variable to hold the MongoDB connection

/**
 * Middleware Setup
 */
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(cors()); // Enable CORS
app.use(helmet()); // Secure HTTP headers

// Session Middleware for SIWE
app.use(
    session({
        name: 'siwe-session',
        secret: 'siwe-quickstart-secret', // Replace with a strong secret in production
        resave: true,
        saveUninitialized: true,
        cookie: { secure: false, sameSite: true }, // Adjust for your environment
    })
);

/**
 * Connect to MongoDB.
 */
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
        process.exit(1); // Exit if connection fails
    }
}

/**
 * Route: Health Check
 * Description: Verify if the server is running.
 */
app.get('/', (req, res) => {
    res.status(200).send('API is running successfully.');
});

/**
 * Route: Get All Users
 * Description: Retrieve all users from the database.
 */
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

/**
 * SIWE Routes
 */

// Route: Generate Nonce
app.get('/nonce', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(generateNonce());
});

// Route: Verify Signature
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
            projectId: '1b54a5d583ce208cc28c1362cdd3d437', // Replace with your Reown project ID
        });

        if (!isValid) {
            throw new Error('Invalid signature');
        }

        // Save session
        req.session.siwe = { address, chainId };
        req.session.save(() => res.status(200).send(true));
    } catch (error) {
        console.error('Verification error:', error.message);
        req.session.siwe = null;
        req.session.save(() => res.status(500).json({ message: error.message }));
    }
});

// Route: Retrieve Session
app.get('/session', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(req.session.siwe || null);
});

// Route: Sign Out
app.get('/signout', (req, res) => {
    req.session.destroy(() => res.status(200).send(true));
});

/**
 * Start the Server
 */
(async () => {
    await connectToMongoDB(); // Connect to MongoDB before starting the server
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
})();
