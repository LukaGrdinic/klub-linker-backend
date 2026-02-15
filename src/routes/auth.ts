import { Router } from "express";

const router = Router();

router.post("/register", (_req, res) => {
  res.status(201).json({ message: "Auth register - Faza 2" });
});

router.post("/login", (_req, res) => {
  res.json({ message: "Auth login - Faza 2", token: "placeholder" });
});

router.post("/logout", (_req, res) => {
  res.json({ message: "Auth logout - Faza 2" });
});

router.get("/me", (_req, res) => {
  res.json({ message: "Auth me - Faza 2" });
});

export default router;
