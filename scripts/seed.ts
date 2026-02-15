/**
 * Seed script - pokretanje: npm run seed (iz backend/)
 * Zahtijeva MONGODB_URI u .env
 */
import "dotenv/config";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI ?? "";

async function seed() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI nije postavljen u .env");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  console.log("Seed placeholder - puna implementacija u Fazi 2.");
  await mongoose.disconnect();
}

seed().catch(console.error);
