import { Router } from "express";
import { Sport } from "../models/Sport";

const router = Router();

router.get("/slug/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!slug) {
      res.status(400).json({ error: "Nedostaje slug." });
      return;
    }
    const sport = await Sport.findOne({ slug, isActive: true }).lean();
    if (!sport) {
      res.status(404).json({ error: "Sport nije pronađen." });
      return;
    }
    res.json({
      data: {
        id: String(sport._id),
        name: sport.name,
        slug: sport.slug,
      },
    });
  } catch (err) {
    console.error("Sport by slug error:", err);
    res.status(500).json({ error: "Greška pri učitavanju sporta." });
  }
});

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
