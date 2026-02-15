import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Search - Faza 2", data: [] });
});

export default router;
