import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db";
import authRoutes from "./routes/auth";
import sportsRoutes from "./routes/sports";
import clubsRoutes from "./routes/clubs";
import postsRoutes from "./routes/posts";
import notificationsRoutes from "./routes/notifications";
import searchRoutes from "./routes/search";
import uploadRoutes from "./routes/upload";

const app = express();
const PORT = process.env.PORT ?? 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/sports", sportsRoutes);
app.use("/api/clubs", clubsRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/upload", uploadRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "klub-linker-backend" });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });
