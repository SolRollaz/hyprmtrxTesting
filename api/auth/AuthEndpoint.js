import express from "express";
import QR_Code_Auth from "../../HVM/QRCode_Auth.js";
import QRCodeAuth from "../../HVM/QRCode_Auth_new.js";
import SystemConfig from "../../systemConfig.js";
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";

class AuthEndpoint {
    constructor() {
        this.systemConfig = new SystemConfig();

        const mongoUri = process.env.MONGO_URI || this.systemConfig.getMongoUri();
        const dbName = process.env.MONGO_DB_NAME || this.systemConfig.getMongoDbName();

        if (!mongoUri || !dbName) {
            throw new Error("Mongo URI or DB Name is not defined.");
        }

        this.mongoUri = mongoUri;
        this.dbName = dbName;
        this.client = new MongoClient(this.mongoUri, { useUnifiedTopology: true });

        this.qrCodeAuth_NEW = new QRCodeAuth(this.client, this.dbName, this.systemConfig);
        this.qrCodeAuth = new QR_Code_Auth(this.client, this.dbName, this.systemConfig);
    }

    async handleRequest(req, res) {
        console.log("---- Incoming Request ----");
        console.log("Body:", req.body);

        const { auth } = req.body;

        if (auth !== "auth") {
            return res.status(400).send({ status: "failure", message: "Invalid or missing 'auth' parameter." });
        }

        try {
            // await this.client.connect();
            return await this.handleQRCodeRequest(res);
        } catch (error) {
            console.error("Error handling request:", error.message);
            return res.status(500).send({ status: "failure", message: "Internal server error." });
        }
    }

    async handleQRCodeRequest(res) {
        try {
            const qrCodeResult = await this.qrCodeAuth.generateAuthenticationQRCode();

            if (qrCodeResult.status !== "success") {
                console.error("QR Code generation failed:", qrCodeResult.message);
                return res.status(500).send({ status: "failure", message: qrCodeResult.message });
            }

            const qrCodePath = qrCodeResult.qr_code_path; // Use the returned file path

            if (!fs.existsSync(qrCodePath)) {
                console.error("QR Code file not found at path:", qrCodePath);
                return res.status(500).send({ status: "failure", message: "QR Code file not found." });
            }

            console.log(`Attempting to stream QR Code from path: ${qrCodePath}`);

            res.setHeader("Content-Type", "image/png");
            res.setHeader("Content-Disposition", `inline; filename=${path.basename(qrCodePath)}`);

            const qrStream = fs.createReadStream(qrCodePath);
            qrStream.pipe(res);

            qrStream.on("close", () => {
                console.log(`QR Code successfully streamed to the client: ${qrCodePath}`);
            });

            qrStream.on("error", (error) => {
                console.error("Error streaming the QR Code file:", error.message);
                return res.status(500).send({ status: "failure", message: "Error streaming the QR Code file." });
            });
        } catch (error) {
            console.error("Error generating QR code:", error.message);
            return res.status(500).send({ status: "failure", message: "Failed to generate QR code." });
        }
    }

    async handleQRCode(req, res) {
        try {
            // const result = await this.qrCodeAuth.generateQRCode();
            const result1 = await this.qrCodeAuth_NEW.generateAuthenticationQRCode();
            res.json(result1);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }   
    }

    async handleVerifySignature(req, res) {
        const { sessionId, signature, message } = req.body;
        try {
            const result = await this.qrCodeAuth_NEW.verifySignature(sessionId, signature, message);
            res.json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}

export default AuthEndpoint;
