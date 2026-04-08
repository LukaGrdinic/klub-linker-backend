import { Router, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { isCloudinaryConfigured, uploadBuffer } from "../utils/streamUpload";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 52 * 1024 * 1024 },
});

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/avi",
]);
const DOC_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const IMAGE_MAX = 5 * 1024 * 1024;
const VIDEO_MAX = 50 * 1024 * 1024;
const DOC_MAX = 10 * 1024 * 1024;

router.post("/", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({ error: "Upload nije konfigurisan. Postavite CLOUDINARY_* u .env." });
      return;
    }
    const file = req.file;
    if (!file?.buffer) {
      res.status(400).json({ error: "Nije poslan fajl (polje file)." });
      return;
    }
    const kind = typeof req.body?.kind === "string" ? req.body.kind : "auto";
    const mime = file.mimetype;

    let folder = "klub-linker/misc";
    let resourceType: "image" | "video" | "raw" = "raw";
    let maxBytes = DOC_MAX;

    if (kind === "image" || (kind === "auto" && IMAGE_TYPES.has(mime))) {
      if (!IMAGE_TYPES.has(mime)) {
        res.status(400).json({ error: "Slika mora biti JPG, PNG ili WebP." });
        return;
      }
      if (file.size > IMAGE_MAX) {
        res.status(400).json({ error: "Slika može biti najviše 5 MB." });
        return;
      }
      folder = "klub-linker/images";
      resourceType = "image";
      maxBytes = IMAGE_MAX;
    } else if (kind === "video" || (kind === "auto" && mime.startsWith("video/"))) {
      if (!VIDEO_TYPES.has(mime)) {
        res.status(400).json({ error: "Video format nije podržan (npr. MP4, WebM)." });
        return;
      }
      if (file.size > VIDEO_MAX) {
        res.status(400).json({ error: "Video može biti najviše 50 MB." });
        return;
      }
      folder = "klub-linker/videos";
      resourceType = "video";
      maxBytes = VIDEO_MAX;
    } else if (kind === "document" || (kind === "auto" && DOC_TYPES.has(mime))) {
      if (!DOC_TYPES.has(mime)) {
        res.status(400).json({ error: "Dokument mora biti PDF, Word ili Excel." });
        return;
      }
      if (file.size > DOC_MAX) {
        res.status(400).json({ error: "Dokument može biti najviše 10 MB." });
        return;
      }
      folder = "klub-linker/documents";
      resourceType = "raw";
      maxBytes = DOC_MAX;
    } else {
      res.status(400).json({ error: "Nepoznat tip fajla ili parametar kind." });
      return;
    }

    if (file.size > maxBytes) {
      res.status(400).json({ error: "Fajl prelazi dozvoljenu veličinu." });
      return;
    }

    const result = await uploadBuffer(file.buffer, { folder, resourceType });
    res.status(201).json({
      url: result.url,
      publicId: result.publicId,
      resourceType: result.resourceType,
    });
  } catch (e) {
    console.error("Upload error:", e);
    res.status(500).json({ error: "Greška pri upload-u na Cloudinary." });
  }
});

export default router;
