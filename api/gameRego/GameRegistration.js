import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import GameInfo from "../../Schema/gameDataSchema.js";
import GameKeys from "../../Schema/gameKeysSchema.js"; // This is where the game key schema is imported
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

      // 🧠 Generate a new game key
      const gameKey = uuidv4(); // Create a unique key

      // Save the new game key into GameKeys collection (hashed)
      const gameKeyEntry = new GameKeys({
        game_name: gameData.game_name.toLowerCase(),
        secret_key: gameKey
      });

      await gameKeyEntry.save(); // Save it to the DB

      // 🖼️ Handle image upload (if applicable)
      const gameLogoPath = gameData.game_logo
        ? this.saveImage(gameData.game_logo, "logo", gameData.game_name)
        : "";

      const gameBannerPath = gameData.game_banner
        ? this.saveImage(gameData.game_banner, "banner", gameData.game_name)
        : "";

      // Create a new GameInfo document and save it
      const newGame = new GameInfo({
        ...gameData,
        game_name: gameData.game_name.toLowerCase(),
        game_logo_path: gameLogoPath,
        game_banner_path: gameBannerPath,
        registered_by: gameData.registered_by,
        created_at: new Date(),
        last_updated: new Date()
      });

      await newGame.save();

      // Return response with the game key (only for initial registration)
      res.status(201).json({
        status: "success",
        message: "Game registered successfully!",
        game_key: gameKey // The game key is returned in the response
      });
    } catch (error) {
      console.error("❌ Game Registration Error:", error);
      res.status(500).json({
        status: "failure",
        message: "Internal server error."
      });
    }
  }

  // Save image helper function
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
