import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "Posts list - Faza 2", data: [] });
});

router.post("/", (_req, res) => {
  res.status(201).json({ message: "Post create - Faza 2" });
});

router.get("/:id", (_req, res) => {
  res.json({ message: "Post detail - Faza 2" });
});

router.patch("/:id", (_req, res) => {
  res.json({ message: "Post update - Faza 2" });
});

router.delete("/:id", (_req, res) => {
  res.json({ message: "Post delete - Faza 2" });
});

export default router;
