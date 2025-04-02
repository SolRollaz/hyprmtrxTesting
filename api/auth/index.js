// File: /api/auth/index.js
import dotenv from "dotenv";
import path from "path";
import express from "express";
import rateLimit from "express-rate-limit";
import http from "http";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import AuthEndpoint from "./AuthEndpoint.js";
import SessionStore from "../../HVM/SessionStore.js";
import { isDomainWhitelisted, validateApiKey } from "../../HVM/authMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();
const server = http.createServer(app);
const port = 4000;
const authAPI = new AuthEndpoint();

// ✅ Strict CORS with domain or API key
app.use(async (req, res, next) => {
  const origin = req.headers.origin;
  const apiKey = req.headers["x-api-key"];

  const allowDomain = origin && isDomainWhitelisted(origin);
  const allowKey = await validateApiKey(apiKey);

  if (allowDomain || allowKey) {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  }

  return res.status(403).json({ status: "failure", message: "Unauthorized origin or missing API key" });
});

app.use(express.json({ limit: "1kb" }));
app.use(express.static("public"));

// ✅ Rate limiter
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { status: "failure", message: "Too many authentication attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

// ✅ Auth main route (restore original working flow)
app.post(["/", "/api/auth/"], authLimiter, async (req, res) => {
  try {
    await authAPI.handleRequest(req, res); // original logic restored
  } catch (e) {
    console.error("❌ /api/auth:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => res.status(200).json({ message: "Auth API is working!" }));

app.get("/api/generate-qr", async (_, res) => {
  try {
    await authAPI.handleQRCodeRequest(res);
  } catch (e) {
    console.error("❌ /api/generate-qr:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/verify-signature", async (req, res) => {
  try {
    await authAPI.handleVerifySignature(req, res);
  } catch (e) {
    console.error("❌ /api/verify-signature:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/.well-known/walletconnect.txt", (req, res) => {
  res.sendFile(path.resolve(process.cwd(), "public", "walletconnect.txt"));
});

// ✅ WebSocket origin check
const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => {
  const origin = req.headers.origin;
  if (!isDomainWhitelisted(origin)) {
    ws.close(1008, "Forbidden origin");
    return;
  }
  authAPI.handleWebSocketConnection(ws);
});

// ✅ Session cleanup
setInterval(() => {
  SessionStore.clearExpired();
}, 5 * 60 * 1000);

// ✅ Start server
server.listen(port, () => {
  console.log(`🚀 Auth API running on http://localhost:${port}`);
});
