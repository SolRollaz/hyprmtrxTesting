// File: /cron/cronRunner.js

import cron from "node-cron";
import mongoose from "mongoose";
import TimedClosure from "../api/tournament/TimedClosure.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hyprmtrx";

// Connect to DB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected for cron job"))
  .catch(err => {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });

// ⏱️ Run every minute
cron.schedule("* * * * *", async () => {
  console.log("🕒 [cronRunner] Running TimedClosure...");
  await TimedClosure.checkAndClose();
});
