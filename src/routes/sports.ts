import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Sports list - Faza 2", data: [] });
});

router.post("/", (_req, res) => {
  res.status(201).json({ message: "Sport create - Faza 2" });
});

router.get("/:id", (_req, res) => {
  res.json({ message: "Sport detail - Faza 2" });
});

export default router;
