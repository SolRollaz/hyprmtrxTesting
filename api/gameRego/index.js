// File: /api/game_registration/index.js
import dotenv from "dotenv";
import path from "path";
import express from "express";
import rateLimit from "express-rate-limit";
import http from "http";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import GameRegistration from "./GameRegistration.js";
import SessionStore from "../../HVM/SessionStore.js";
import { isDomainWhitelisted } from "../../HVM/authMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();
const server = http.createServer(app);
const port = 5000;
const gameRegistrationAPI = new GameRegistration();

// ✅ Strict CORS with domain validation only
app.use(async (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isDomainWhitelisted(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  }
  return res.status(403).json({ status: "failure", message: "Unauthorized origin" });
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

// ✅ Rate limiter
const registrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { status: "failure", message: "Too many registration attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

// ✅ Game Registration route
app.post(["/", "/api/game/register"], registrationLimiter, async (req, res) => {
  try {
    await gameRegistrationAPI.handleRegistration(req, res);
  } catch (e) {
    console.error("❌ /api/game/register:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (req, res) => res.status(200).json({ message: "Game Registration API is working!" }));

// ✅ WebSocket support (optional, can be expanded)
const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => {
  const origin = req.headers.origin;
  if (!isDomainWhitelisted(origin)) {
    ws.close(1008, "Forbidden origin");
    return;
  }
  gameRegistrationAPI.handleWebSocketConnection?.(ws);
});

// ✅ Session cleanup every 5 minutes
setInterval(() => {
  SessionStore.clearExpired();
}, 5 * 60 * 1000);

// ✅ Start server
server.listen(port, () => {
  console.log(`🚀 Game Registration API running on http://localhost:${port}`);
});
