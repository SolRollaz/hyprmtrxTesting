import { SignClient } from "@walletconnect/sign-client";
import qrCode from "qrcode";
import systemConfig from "../systemConfig.js";

class QRCodeAuth {
  constructor(client, dbName, systemConfig) {
    if (!client || !dbName || !systemConfig) {
      throw new Error("MongoClient, dbName, and systemConfig are required to initialize QRCodeAuth.");
    }

    this.client = client;
    this.dbName = dbName;
    this.systemConfig = systemConfig;

    this.sessions = new Map();       // Tracks pairing URIs
    this.activeSessions = new Map(); // Tracks approval promises
    this.activePairing = null;       // Tracks live pairing

    this.signClient = null;
    this.initializeSignClient();
  }

  async initializeSignClient() {
    if (this.signClient) return;

    this.signClient = await SignClient.init({
      projectId: this.systemConfig.walletConnect.projectId,
      relayUrl: this.systemConfig.walletConnect.relayUrl,
      metadata: {
        name: this.systemConfig.walletConnect.metadata.name || "Default App",
        description: this.systemConfig.walletConnect.metadata.description || "Default Description",
        url: this.systemConfig.walletConnect.metadata.url || "https://example.com",
        icons: this.systemConfig.walletConnect.metadata.icons || ["https://example.com/favicon.png"],
      },
    });
  }

  async generateAuthenticationQRCode() {
    try {
      console.log("🚀 Starting QR code generation...");

      // ✅ Clean up any previous pairing to prevent dangling sessions
      if (this.activePairing) {
        try {
          await this.signClient.disconnect({
            topic: this.activePairing.topic,
            reason: {
              code: 6000,
              message: "Replacing previous WalletConnect pairing",
            },
          });
          console.log("🧹 Cleaned up previous pairing.");
        } catch (err) {
          console.warn("⚠️ Failed to disconnect old pairing:", err.message);
        }
        this.activePairing = null;
      }

      const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sessionId = `session_${uniqueId}`;

      const { uri, approval } = await this.signClient.connect({
        requiredNamespaces: {
          eip155: {
            methods: [
              "eth_sendTransaction",
              "eth_signTransaction",
              "eth_sign",
              "personal_sign",
              "eth_signTypedData",
            ],
            chains: ["eip155:1"],
            events: ["chainChanged", "accountsChanged"],
          },
        },
      });

      // ✅ Store current pairing topic
      const pairings = this.signClient.pairing.getPairings();
      this.activePairing = pairings[pairings.length - 1];

      const qrCodeBase64 = await qrCode.toDataURL(uri);

      // ✅ Track both approval flow and basic session data
      this.activeSessions.set(sessionId, { approval });
      this.sessions.set(sessionId, { uri, status: "pending" });

      return {
        status: "success",
        message: "QR code generated successfully.",
        qrCodeBase64,
        sessionId,
        walletConnectUri: uri,
      };
    } catch (error) {
      console.error("❌ Error generating QR code:", error.message);
      return { status: "failure", message: "Failed to generate QR code." };
    }
  }

  async waitForScan(sessionId) {
    try {
      if (!this.activeSessions.has(sessionId)) {
        throw new Error("Session not found.");
      }

      console.log(`⏳ Waiting for wallet to scan QR... [Session: ${sessionId}]`);
      const { approval } = this.activeSessions.get(sessionId);

      const session = await approval(); // Wait for wallet approval
      console.log(`✅ Wallet connected! [Session: ${sessionId}]`, session);

      return { status: "success", session };
    } catch (error) {
      console.error("❌ Error waiting for QR scan:", error.message);
      return { status: "failure", message: error.message };
    }
  }

  async signMessage(sessionId, message) {
    try {
      if (!this.activeSessions.has(sessionId)) {
        throw new Error("Session not found.");
      }

      const { session } = await this.waitForScan(sessionId);
      const walletAddress = session.namespaces.eip155.accounts[0].split(":")[2];

      console.log(`✍️ Signing message for wallet: ${walletAddress}`);

      const signature = await this.signClient.request({
        topic: session.topic,
        chainId: "eip155:1",
        request: {
          method: "personal_sign",
          params: [message, walletAddress],
        },
      });

      console.log(`✅ Message signed! [Session: ${sessionId}]`, signature);

      return { status: "success", walletAddress, signature };
    } catch (error) {
      console.error("❌ Error signing message:", error.message);
      return { status: "failure", message: error.message };
    }
  }

  async verifySignature(sessionId, signature, message) {
    if (!this.sessions.has(sessionId)) {
      throw new Error("❌ Invalid session ID.");
    }

    try {
      const session = this.sessions.get(sessionId);
      console.log("🔎 Verifying signature for session:", sessionId);

      const verified = this.signClient.core.verify({
        uri: session.uri,
        signature,
        message,
      });

      if (!verified) {
        throw new Error("❌ Invalid signature.");
      }

      session.status = "authenticated";
      console.log(`✅ Session ${sessionId} authenticated successfully.`);

      return { status: "success", message: "Authentication successful." };
    } catch (error) {
      console.error("❌ Signature verification failed:", error.message);
      throw new Error("Signature verification failed.");
    }
  }
}

export default QRCodeAuth;
