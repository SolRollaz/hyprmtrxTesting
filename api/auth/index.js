// Load environment variables from the .env file
import dotenv from 'dotenv';
import path from 'path';
import express from 'express'; // Use `import` for consistency in ES modules
import AuthEndpoint from './AuthEndpoint.js'; // Correct path to AuthEndpoint

// Specify the path to .env explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log("Loaded Mongo URI:", process.env.MONGO_URI);
console.log("Current Working Directory:", process.cwd());

// Create an Express app
const app = express();

// Middleware to parse JSON requests
app.use(express.json());

// Create an instance of the AuthEndpoint class
const authAPI = new AuthEndpoint();

// Define the API route
app.post('/api/auth', (req, res) => {
    authAPI.handleRequest(req, res); // Delegate to the AuthEndpoint handler
});

// Generate QR Code API
app.get("/api/generate-qr", async (req, res) => {
    authAPI.handleQRCode(req, res);
});

// Verify Signature API
app.post("/api/verify-signature", async (req, res) => {
    authAPI.handleVerifySignature(req, res);
});

// Define the port for the API
const PORT = process.env.PORT || 3000; // Use environment variable or default to 3000

// Start the server
app.listen(PORT, () => {
    console.log(`Authentication API running at http://127.0.0.1:${PORT}/api/auth`);
    console.log(`Public access via Nginx at https://hyprmtrx.xyz/api/auth`);
});
