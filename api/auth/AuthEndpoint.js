// File: /api/auth/AuthEndpoint.js
import QRCodeAuth from "../../HVM/QRCode_Auth_new.js";
import MasterAuth from "../../HVM/MasterAuth.js";
import SessionStore from "../../HVM/SessionStore.js";
import SystemConfig from "../../systemConfig.js";
import { MongoClient } from "mongodb";

class AuthEndpoint {
  constructor() {
    this.systemConfig = new SystemConfig();
    this.mongoUri = process.env.MONGO_URI || this.systemConfig.getMongoUri();
    this.dbName = process.env.MONGO_DB_NAME || this.systemConfig.getMongoDbName();

    if (!this.mongoUri || !this.dbName) {
      throw new Error("❌ Mongo URI or DB Name is not defined.");
    }

    this.client = new MongoClient(this.mongoUri);
    this.qrCodeAuth = new QRCodeAuth(this.client, this.dbName, this.systemConfig);
    this.masterAuth = new MasterAuth(this.client, this.dbName);
    this.webSocketClients = new Map();
  }

  async handleRequest(req, res) {
    console.log("📩 Incoming Auth Request:", req.body);
    if (!req.body.auth || req.body.auth !== "auth") {
      return res.status(400).json({ status: "failure", message: "Invalid 'auth' param." });
    }

    try {
      const qr = await this.qrCodeAuth.generateAuthenticationQRCode();
      if (qr.status !== "success") {
        return res.status(500).json({ status: "failure", message: qr.message });
      }

      return res.status(200).json({
        status: "success",
        qrCodeBase64: qr.qrCodeBase64,
        sessionId: qr.sessionId,
        walletConnectUri: qr.walletConnectUri,
      });
    } catch (err) {
      console.error("❌ REST QR gen error:", err);
      return res.status(500).json({ status: "failure", message: "Internal error" });
    }
  }

  async handleWebSocketConnection(ws) {
    const clientId = Date.now().toString();
    this.webSocketClients.set(clientId, ws);
    console.log("✅ WebSocket Connected");

    ws.on("message", async (msg) => {
      try {
        const data = JSON.parse(msg);

        if (data.action === "authenticateUser") {
          const qr = await this.qrCodeAuth.generateAuthenticationQRCode();

          if (qr.status !== "success") {
            return ws.send(JSON.stringify({ error: "QR generation failed" }));
          }

          ws.send(JSON.stringify({
            status: "success",
            qrCodeBase64: qr.qrCodeBase64,
            sessionId: qr.sessionId,
            walletConnectUri: qr.walletConnectUri,
          }));
        }

        else if (data.action === "verifyAuthentication") {
          const { walletAddress, signedMessage, authType, gameName } = data;
          const auth = await this.masterAuth.verifySignedMessage(walletAddress, signedMessage, authType, gameName);

          if (auth.status === "success") {
            SessionStore.set(auth.token, walletAddress);
          }

          this.sendAuthResponse(ws, auth);
        }

      } catch (err) {
        console.error("❌ WS error:", err);
        ws.send(JSON.stringify({ error: "Invalid WebSocket message" }));
      }
    });

    ws.on("close", () => this.webSocketClients.delete(clientId));
    ws.on("error", (e) => console.error("⚠️ WebSocket error:", e));
  }

  sendAuthResponse(ws, authResult) {
    const payload = {
      status: authResult.status,
      message: authResult.message,
      token: authResult.token || null,
    };
    ws.send(JSON.stringify(payload));
    console.log("✅ Sent to game:", payload);
  }

  async sendJWTToClient(sessionId, token) {
    for (const [clientId, ws] of this.webSocketClients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ token }));
        ws.close();
        this.webSocketClients.delete(clientId);
      }
    }
  }
}

export default AuthEndpoint;
