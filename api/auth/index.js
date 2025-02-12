import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import AuthEndpoint from './AuthEndpoint.js';

// Load environment variables
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
    allowedHeaders: "Content-Type,Authorization",
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

// ✅ Register Routes
router.post("/", authLimiter, async (req, res) => {
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

router.get("/generate-qr", async (req, res) => {
    try {
        await authAPI.handleQRCode(req, res);
    } catch (e) {
        console.error("❌ API Error in /api/generate-qr:", e);
        res.status(500).json({ error: e.message });
    }
});

router.post("/verify-signature", async (req, res) => {
    try {
        await authAPI.handleVerifySignature(req, res);
    } catch (e) {
        console.error("❌ API Error in /api/verify-signature:", e);
        res.status(500).json({ error: e.message });
    }
});

// ✅ Export the router
export default router;
