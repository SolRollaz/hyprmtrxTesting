// File: /api/game_registration/GameRegistration.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import GameInfo from "../../schema/gameDataSchema.js";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imageStorageDir = path.join(__dirname, "Game_Images");

class GameRegistration {
  constructor() {
    if (!fs.existsSync(imageStorageDir)) {
      fs.mkdirSync(imageStorageDir, { recursive: true });
    }
  }

  async handleRegistration(req, res) {
    try {
      const gameData = req.body;
      const requiredFields = ["game_name", "developer_email", "networks", "game_engine", "game_platforms"];
      for (const field of requiredFields) {
        if (!gameData[field]) {
          return res.status(400).json({ status: "failure", message: `Missing required field: ${field}` });
        }
      }

      // ✅ Ensure game name is unique
      const existingGame = await GameInfo.findOne({ game_name: gameData.game_name.toLowerCase() });
      if (existingGame) {
        return res.status(400).json({ status: "failure", message: "Game name already exists." });
      }

      // ✅ Generate unique game key
      const gameKey = uuidv4();

      // ✅ Save images if provided
      const gameLogoPath = gameData.game_logo ? this.saveImage(gameData.game_logo, "logo", gameData.game_name) : "";
      const gameBannerPath = gameData.game_banner ? this.saveImage(gameData.game_banner, "banner", gameData.game_name) : "";

      // ✅ Create new game entry
      const newGame = new GameInfo({
        ...gameData,
        game_name: gameData.game_name.toLowerCase(),
        game_logo_path: gameLogoPath,
        game_banner_path: gameBannerPath,
        registered_by: gameData.registered_by,
        rewards_token_address: gameData.rewards_token_address || "",
        rewards_token_networks: gameData.rewards_token_networks || [],
        accepted_tokens: gameData.accepted_tokens || [],
        auto_accept_liquid_tokens: gameData.auto_accept_liquid_tokens || false,
        min_liquidity_volume: gameData.min_liquidity_volume || 10000,
        created_at: new Date(),
        last_updated: new Date()
      });
      await newGame.save();

      // ✅ Send confirmation email
      await this.sendConfirmationEmail(gameData.developer_email, gameData.game_name, gameKey);

      res.status(201).json({
        status: "success",
        message: "Game registered successfully!",
        game_key: gameKey
      });
    } catch (error) {
      console.error("❌ Game Registration Error:", error);
      res.status(500).json({ status: "failure", message: "Internal server error." });
    }
  }

  saveImage(base64Data, type, gameName) {
    try {
      const fileName = `${gameName.toLowerCase().replace(/\s+/g, "_")}_${type}.jpg`;
      const filePath = path.join(imageStorageDir, fileName);
      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
      return filePath;
    } catch (error) {
      console.error(`❌ Error saving ${type} image:`, error);
      return "";
    }
  }

  async sendConfirmationEmail(toEmail, gameName, gameKey) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_USERNAME,
        to: toEmail,
        subject: "Game Registration Confirmation - Hyprmtrx",
        text: `Your game '${gameName}' has been successfully registered!\n\nGame Key: ${gameKey}\n\nUse this key for integration.`
      };

      await transporter.sendMail(mailOptions);
      console.log("✅ Confirmation email sent to:", toEmail);
    } catch (error) {
      console.error("❌ Error sending confirmation email:", error);
    }
  }
}

export default GameRegistration;
