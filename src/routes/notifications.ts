import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Notifications list - Faza 2", data: [] });
});

router.post("/", (_req, res) => {
  res.status(201).json({ message: "Notification send - Faza 2" });
});

export default router;
