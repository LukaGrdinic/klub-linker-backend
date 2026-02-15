import { Router } from "express";

const router = Router();

router.post("/", (_req, res) => {
  res.status(201).json({ message: "Upload - Faza 2" });
});

export default router;
