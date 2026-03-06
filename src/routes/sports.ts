import { Router } from "express";
import { Sport } from "../models/Sport";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const sports = await Sport.find({ isActive: true })
      .sort({ "name.me": 1 })
      .lean();
    const data = sports.map((s) => ({
      id: String(s._id),
      name: s.name,
      slug: s.slug,
    }));
    res.json({ data });
  } catch (err) {
    console.error("Sports list error:", err);
    res.status(500).json({ error: "Greška pri učitavanju sportova." });
  }
});

router.post("/", (_req, res) => {
  res.status(201).json({ message: "Sport create - Faza 2" });
});

router.get("/:id", (_req, res) => {
  res.json({ message: "Sport detail - Faza 2" });
});

export default router;
