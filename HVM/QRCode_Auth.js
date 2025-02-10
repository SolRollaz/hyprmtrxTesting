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
      await this.initializeSignClient();

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

      console.log(
        `[Session: ${sessionId}] QR code generated and saved: ${filePath}`
      );

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

  async signMessage(message) {
    try {
      console.log("Signing message...");
      this.modal.open({ view: "Connect" }); // Prompt user to connect wallet
      const { account } = this.modal.getState();
      if (!account) {
        throw new Error("No wallet connected.");
      }

      const signature = await this.adapter.signMessage({ message });
      console.log("Message signed successfully:", signature);

      return { status: "success", signature };
    } catch (error) {
      console.error("Error signing message:", error.message);
      return { status: "failure", message: error.message };
    } finally {
      this.modal.close();
    }
  }
}

export default QR_Code_Auth;
