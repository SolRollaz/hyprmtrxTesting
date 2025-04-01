// File: tests/gameKeys.test.js
import mongoose from "mongoose";
import GameKeys from "../Schema/gameKeysSchema.js";

beforeAll(async () => {
  await mongoose.connect("mongodb://localhost:27017/game_test", {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe("GameKeys Schema", () => {
  it("should hash and verify the game key correctly", async () => {
    const rawKey = "super_secret_key_123";

    const gameEntry = new GameKeys({
      game_name: "unit_test_game",
      secret_key: rawKey
    });

    await gameEntry.save();

    const stored = await GameKeys.findOne({ game_name: "unit_test_game" }).select("+secret_key");
    expect(stored).not.toBeNull();
    expect(stored.secret_key).not.toEqual(rawKey); // Must be hashed

    const isMatch = await stored.verifySecretKey(rawKey);
    const isWrong = await stored.verifySecretKey("wrong_key");

    expect(isMatch).toBe(true);
    expect(isWrong).toBe(false);
  });
});
