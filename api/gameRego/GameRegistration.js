// File: /api/game_registration/GameRegistration.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import GameInfo from "../../schema/gameDataSchema.js";
import { v4 as uuidv4 } from "uuid";

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

      const existingGame = await GameInfo.findOne({
        game_name: gameData.game_name.toLowerCase()
      });

      if (existingGame) {
        return res.status(400).json({
          status: "failure",
          message: "Game name already exists."
        });
      }

      const gameKey = uuidv4();

      const gameLogoPath = gameData.game_logo
        ? this.saveImage(gameData.game_logo, "logo", gameData.game_name)
        : "";

      const gameBannerPath = gameData.game_banner
        ? this.saveImage(gameData.game_banner, "banner", gameData.game_name)
        : "";

      // 🔄 Ensure arrays are actually arrays even if user sends comma-separated strings
      const normalizeArray = (input) =>
        Array.isArray(input)
          ? input
          : typeof input === "string"
            ? input.split(",").map((s) => s.trim()).filter(Boolean)
            : [];

      const newGame = new GameInfo({
        ...gameData,
        game_name: gameData.game_name.toLowerCase(),
        game_logo_path: gameLogoPath,
        game_banner_path: gameBannerPath,
        registered_by: gameData.registered_by,
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
}

export default GameRegistration;
