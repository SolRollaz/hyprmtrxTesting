// File: /api/auth/authMiddleware.js
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

// ✅ MongoDB connection details
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME;
const client = new MongoClient(mongoUri, { useUnifiedTopology: true });

/**
 * ✅ List of whitelisted domains that can bypass API key authentication.
 */
const WHITELISTED_DOMAINS = [
  "https://hyprmtrx.com",
  "https://hyprmtrx.xyz"
];

/**
 * ✅ Checks if a request is from a whitelisted domain.
 * @param {string} origin - The domain making the request.
 * @returns {boolean} - True if the domain is whitelisted.
 */
export function isDomainWhitelisted(origin) {
  return WHITELISTED_DOMAINS.includes(origin);
}

/**
 * ✅ Validates an API key against the database.
 * @param {string} apiKey - The API key provided in the request headers.
 * @returns {Promise<boolean>} - True if the API key is valid.
 */
export async function validateApiKey(apiKey) {
  if (!apiKey) return false;

  try {
    await client.connect();
    const db = client.db(dbName);
    const apiKeyCollection = db.collection("api_keys");

    // ✅ Check if API key exists in the database
    const existingKey = await apiKeyCollection.findOne({ key: apiKey });

    return !!existingKey;
  } catch (error) {
    console.error("❌ Error validating API key:", error.message);
    return false;
  } finally {
    await client.close();
  }
}
