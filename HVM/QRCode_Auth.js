import { SignClient } from "@walletconnect/sign-client";

import qrCode from "qrcode";
import fs from "fs";
import path from "path";

class QR_Code_Auth {
  constructor(client, dbName, systemConfig) {
    if (!client || !dbName || !systemConfig) {
      throw new Error(
        "MongoClient, dbName, and systemConfig are required to initialize QR_Code_Auth."
      );
    }

    this.dbName = dbName;
    this.systemConfig = systemConfig;
    this.qrCodeDir = path.join(process.cwd(), "QR_Codes");
    this.ensureQRCodeDirectory();
    this.signClient = null;
    this.activeSessions = new Map(); // Store active sessions
    this.initializeSignClient();

  }

  ensureQRCodeDirectory() {
    if (!fs.existsSync(this.qrCodeDir)) {
      fs.mkdirSync(this.qrCodeDir, { recursive: true });
      console.log("QR code directory created.");
    }
  }

  async initializeSignClient() {
    if (this.signClient) return;

    this.signClient = await SignClient.init({
      projectId: this.systemConfig.walletConnect.projectId,
      relayUrl: this.systemConfig.walletConnect.relayUrl,
      metadata: {
        name: this.systemConfig.walletConnect.metadata.name || "Default App",
        description:
          this.systemConfig.walletConnect.metadata.description ||
          "Default Description",
        url:
          this.systemConfig.walletConnect.metadata.url || "https://example.com",
        icons: this.systemConfig.walletConnect.metadata.icons || [
          "https://example.com/favicon.png",
        ],
      },
    });
  }

  async generateAuthenticationQRCode() {
    try {
      console.log("Starting QR code generation process...");

      const uniqueId = `${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const sessionId = `session_${uniqueId}`;
      const filePath = path.join(
        this.qrCodeDir,
        `${sessionId}_auth_qrcode.png`
      );
      const publicUrl = `${
        this.systemConfig.walletConnect.qrCodeBaseUrl
      }/${path.basename(filePath)}`;

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

      await qrCode.toFile(filePath, uri, {
        color: { dark: "#000000", light: "#ffffff" },
      });

      new Promise(async (resolve, reject)=>{
        try{

          const session = await approval()
          console.log("session : ", session);
          // this.activeSessions.set(sessionId, session);
          
          resolve();
        }catch(e){
          console.log(e)
          reject();
        }
      }).then(()=>{
        console.log("success session");
      }).catch(()=>{
        console.log("success failed");
      })

      console.log(
        `[Session: ${sessionId}] QR code generated and saved: ${filePath}`
      );

      // Store session approval promise for tracking

      return {
        status: "success",
        message: "QR code generated successfully.",
        qr_code_path: filePath,
        qr_code_url: publicUrl,
        session_id: sessionId,
        walletkit_uri: uri,
      };
    } catch (error) {
      console.error("Error generating QR code:", error.message);
      return { status: "failure", message: "Failed to generate QR code." };
    }
  }

  async waitForScan(sessionId) {
    try {
      if (!this.activeSessions.has(sessionId)) {
        throw new Error("Session not found.");
      }

      console.log(`Waiting for wallet to scan QR code... [Session: ${sessionId}]`);
      const { approval } = this.activeSessions.get(sessionId);

      const session = await approval(); // Wait for QR scan & wallet connection
      console.log(`Wallet connected! [Session: ${sessionId}]`, session);

      return { status: "success", session };
    } catch (error) {
      console.error("Error waiting for QR scan:", error.message);
      return { status: "failure", message: error.message };
    }
  }

  async signMessage(sessionId, message) {
    try {
      if (!this.activeSessions.has(sessionId)) {
        throw new Error("Session not found.");
      }

      const { session } = await this.waitForScan(sessionId); // Ensure QR was scanned
      const walletAddress = session.namespaces.eip155.accounts[0].split(":")[2]; // Extract wallet address
      console.log(`Signing message for wallet: ${walletAddress}`);

      const signature = await this.signClient.request({
        topic: session.topic,
        chainId: "eip155:1",
        request: {
          method: "personal_sign",
          params: [message, walletAddress],
        },
      });

      console.log(`Message signed successfully! [Session: ${sessionId}]`, signature);

      return { status: "success", walletAddress, signature };
    } catch (error) {
      console.error("Error signing message:", error.message);
      return { status: "failure", message: error.message };
    }
  }


  // async signMessage(message) {
  //   try {
  //     console.log("Signing message...");
  //     this.modal.open({ view: "Connect" }); // Prompt user to connect wallet
  //     const { account } = this.modal.getState();
  //     if (!account) {
  //       throw new Error("No wallet connected.");
  //     }

  //     const signature = await this.adapter.signMessage({ message });
  //     console.log("Message signed successfully:", signature);

  //     return { status: "success", signature };
  //   } catch (error) {
  //     console.error("Error signing message:", error.message);
  //     return { status: "failure", message: error.message };
  //   } finally {
  //     this.modal.close();
  //   }
  // }
}

export default QR_Code_Auth;
