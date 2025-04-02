// File: /api/gameRego/GameRegistration.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import GameInfo from "../../Schema/gameDataSchema.js";
import GameKeys from "../../Schema/gameKeysSchema.js";
import SessionStore from "../../HVM/SessionStore.js";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imageStorageRoot = path.join(__dirname, "../../gameImages"); // Root folder

class GameRegistration {
  constructor() {
    if (!fs.existsSync(imageStorageRoot)) {
      fs.mkdirSync(imageStorageRoot, { recursive: true });
    }
  }

  async handleRegistration(req, res) {
    try {
      const gameData = req.body;
      const token = req.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return res.status(401).json({ status: "failure", message: "Missing authorization token." });
      }

      const sessionEntry = [...SessionStore.sessionMap.entries()].find(([, v]) => v.token === token);
      if (!sessionEntry) {
        return res.status(403).json({ status: "failure", message: "Invalid or expired session." });
      }

      const walletAddress = sessionEntry[0];

      const requiredFields = [
        "game_name",
        "networks",
        "game_engine",
        "game_platforms"
      ];

      for (const field of requiredFields) {
        if (!gameData[field]) {
          return res.status(400).json({
            status: "failure",
            message: `Missing required field: ${field}`
          });
        }
      }

      const gameNameSlug = gameData.game_name.toLowerCase().trim();
      const existingGame = await GameInfo.findOne({ game_name: gameNameSlug });

      if (existingGame) {
        return res.status(400).json({
          status: "failure",
          message: "Game name already exists."
        });
      }

      const gameFolder = path.join(imageStorageRoot, gameNameSlug);
      if (!fs.existsSync(gameFolder)) {
        fs.mkdirSync(gameFolder, { recursive: true });
      }

      // Handle uploaded files
      const logoFile = req.files?.game_logo?.[0];
      const bannerFile = req.files?.game_banner?.[0];

      const logoPath = logoFile
        ? this.saveImage(logoFile.path, "logo", gameNameSlug, gameFolder)
        : "";
      const bannerPath = bannerFile
        ? this.saveImage(bannerFile.path, "banner", gameNameSlug, gameFolder)
        : "";

      const normalizeArray = (input) =>
        Array.isArray(input)
          ? input
          : typeof input === "string"
            ? input.split(",").map((s) => s.trim()).filter(Boolean)
            : [];

      const newGame = new GameInfo({
        ...gameData,
        game_name: gameNameSlug,
        game_logo_path: logoPath,
        game_banner_path: bannerPath,
        registered_by: walletAddress,
        networks: normalizeArray(gameData.networks),
        game_platforms: normalizeArray(gameData.game_platforms),
        rewards_token_networks: normalizeArray(gameData.rewards_token_networks),
        accepted_tokens: normalizeArray(gameData.accepted_tokens),
        rewards_pools: normalizeArray(gameData.rewards_pools),
        prize_pools: normalizeArray(gameData.prize_pools),
        auto_accept_liquid_tokens: !!gameData.auto_accept_liquid_tokens,
        min_liquidity_volume: gameData.min_liquidity_volume || 10000,
        created_at: new Date(),
        last_updated: new Date()
      });

      await newGame.save();

      const gameKey = uuidv4();
      const gameKeyEntry = new GameKeys({
        game_name: gameNameSlug,
        secret_key: gameKey
      });

      await gameKeyEntry.save();

      // 🔒 Expire session after successful registration
      SessionStore.sessionMap.delete(walletAddress);

      res.status(201).json({
        status: "success",
        message: "Game registered successfully!",
        game_key: gameKey
      });
    } catch (error) {
      console.error("❌ Game Registration Error:", error);
      res.status(500).json({
        status: "failure",
        message: "Internal server error."
      });
    }
  }

  saveImage(tempFilePath, type, gameName, gameFolder) {
    try {
      const ext = path.extname(tempFilePath); // Keep original extension
      const newFileName = `${type}${ext}`;
      const newPath = path.join(gameFolder, newFileName);
      fs.renameSync(tempFilePath, newPath); // Move file into game folder
      return newPath;
    } catch (error) {
      console.error(`❌ Error saving ${type} image:`, error);
      return "";
    }
  }
}

export default GameRegistration;
