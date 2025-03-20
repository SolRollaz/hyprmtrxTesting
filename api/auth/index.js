import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import AuthEndpoint from './AuthEndpoint.js';
import { validateApiKey, isDomainWhitelisted } from './middleware/authMiddleware.js';

// ✅ Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log("✅ Loaded Mongo URI:", process.env.MONGO_URI);
console.log("✅ Current Working Directory:", process.cwd());

// ✅ Create Express Router
const router = express.Router();
const authAPI = new AuthEndpoint();

// ✅ CORS Configuration
const corsOptions = {
    origin: "https://hyprmtrx.com",
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization,x-api-key",
    credentials: true,
};
router.use(cors(corsOptions));

// ✅ Middleware
router.use(express.json());
router.use(express.static("public"));

// ✅ Rate Limiting
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5,
    message: { status: "failure", message: "Too many authentication attempts. Try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * ✅ Middleware to enforce domain-based or API key-based authentication.
 */
router.use((req, res, next) => {
    const origin = req.get("Origin"); // Get domain from request
    const apiKey = req.get("x-api-key"); // Get API key from request headers

    // ✅ Step 1: Allow if the domain is whitelisted (no API key required)
    if (isDomainWhitelisted(origin)) {
        console.log(`✅ Allowed: Whitelisted domain ${origin}`);
        return next();
    }

    // ✅ Step 2: If the request is NOT from a whitelisted domain, require an API key
    if (!apiKey || !validateApiKey(apiKey)) {
        console.warn(`❌ Forbidden: Unauthorized request from ${origin || "unknown source"}`);
        return res.status(403).json({ status: "failure", message: "Access denied. Invalid API key or unregistered domain." });
    }

    console.log(`✅ Allowed: Valid API key authentication from ${origin || "API Client"}`);
    next();
});

// ✅ Fix: Correctly handle `/api/auth`
router.post(['/', '/api/auth/'], authLimiter, async (req, res) => {
    try {
        await authAPI.handleRequest(req, res);
    } catch (e) {
        console.error("❌ API Error in /api/auth:", e);
        res.status(500).json({ error: e.message });
    }
});

router.get("/.well-known/walletconnect.txt", (req, res) => {
    res.sendFile(path.resolve(process.cwd(), "public", "walletconnect.txt"));
});

router.get("/", (req, res) => {
    res.status(200).json({ message: "Auth API is working!" });
});

router.get("/api/generate-qr", async (req, res) => {
    try {
        await authAPI.handleQRCode(req, res);
    } catch (e) {
        console.error("❌ API Error in /api/generate-qr:", e);
        res.status(500).json({ error: e.message });
    }
});

router.post("/api/verify-signature", async (req, res) => {
    try {
        await authAPI.handleVerifySignature(req, res);
    } catch (e) {
        console.error("❌ API Error in /api/verify-signature:", e);
        res.status(500).json({ error: e.message });
    }
});

// ✅ Export the router
export default router;
