import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Clubs list - Faza 2", data: [] });
});

router.post("/", (_req, res) => {
  res.status(201).json({ message: "Club register - Faza 2" });
});

router.get("/:id", (_req, res) => {
  res.json({ message: "Club detail - Faza 2" });
});

router.patch("/:id", (_req, res) => {
  res.json({ message: "Club update - Faza 2" });
});

export default router;
