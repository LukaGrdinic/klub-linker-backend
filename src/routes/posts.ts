import { Router, Request, Response } from "express";
import type { Document } from "mongoose";
import mongoose from "mongoose";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleCheck";
import { BlogPost } from "../models/BlogPost";
import { User } from "../models/User";
import { Club } from "../models/Club";
import { excerptFromHtml } from "../utils/excerpt";

const router = Router();

const createPostSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  content: z.string(),
  featuredImage: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  tags: z.array(z.string().max(64)).max(40).default([]),
  visibility: z.enum(["public", "private"]),
  status: z.enum(["draft", "published"]),
});

const updatePostSchema = createPostSchema.partial();

function serializePost(doc: Document) {
  const o = doc.toObject() as Record<string, unknown> & { _id: unknown };
  return {
    id: String(o._id),
    title: o.title,
    slug: o.slug,
    excerpt: o.excerpt,
    content: o.content,
    featuredImage: o.featuredImage,
    tags: o.tags,
    visibility: o.visibility,
    status: o.status,
    publishedAt: o.publishedAt,
    clubId: o.clubId ? String(o.clubId) : null,
    sportId: String(o.sportId),
    authorId: String(o.authorId),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    views: o.views,
  };
}

router.get("/me", requireAuth, requireRole("clubAdmin"), async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const user = await User.findById(userId);
    if (!user?.clubId) {
      res.status(403).json({ error: "Korisnik nije povezan sa klubom." });
      return;
    }
    const posts = await BlogPost.find({ clubId: user.clubId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .select("-content");
    res.json({
      data: posts.map((p) => {
        const doc = p as Document;
        const o = doc.toObject() as Record<string, unknown> & { _id: unknown };
        return {
          id: String(o._id),
          title: o.title,
          slug: o.slug,
          excerpt: o.excerpt,
          featuredImage: o.featuredImage,
          tags: o.tags,
          visibility: o.visibility,
          status: o.status,
          publishedAt: o.publishedAt,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          views: o.views,
        };
      }),
    });
  } catch (e) {
    console.error("posts/me", e);
    res.status(500).json({ error: "Greška pri učitavanju postova." });
  }
});

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 50);
    const page = Math.max(1, Number(req.query.page) || 1);
    const skip = (page - 1) * limit;
    const sportIdRaw = typeof req.query.sportId === "string" ? req.query.sportId.trim() : "";
    const clubIdRaw = typeof req.query.clubId === "string" ? req.query.clubId.trim() : "";
    const authorIdRaw = typeof req.query.authorId === "string" ? req.query.authorId.trim() : "";
    const qRaw = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const filter: Record<string, unknown> = { status: "published", visibility: "public" };
    if (sportIdRaw && mongoose.Types.ObjectId.isValid(sportIdRaw)) {
      filter.sportId = new mongoose.Types.ObjectId(sportIdRaw);
    }
    if (clubIdRaw && mongoose.Types.ObjectId.isValid(clubIdRaw)) {
      filter.clubId = new mongoose.Types.ObjectId(clubIdRaw);
    }
    if (authorIdRaw && mongoose.Types.ObjectId.isValid(authorIdRaw)) {
      filter.authorId = new mongoose.Types.ObjectId(authorIdRaw);
    }
    if (qRaw) {
      const rx = new RegExp(escapeRegex(qRaw), "i");
      filter.$or = [{ title: rx }, { excerpt: rx }, { tags: rx }];
    }

    const [total, posts] = await Promise.all([
      BlogPost.countDocuments(filter),
      BlogPost.find(filter)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-content")
        .populate("authorId", "name athleteProfile.photo")
        .populate("clubId", "name slug logo")
        .populate("sportId", "name slug")
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      data: posts.map((p) => {
        const author = p.authorId as unknown as {
          _id: mongoose.Types.ObjectId;
          name?: string;
          athleteProfile?: { photo?: string };
        } | null;
        const club = p.clubId as unknown as {
          _id: mongoose.Types.ObjectId;
          name?: string;
          slug?: string;
          logo?: string;
        } | null;
        const sport = p.sportId as unknown as {
          _id: mongoose.Types.ObjectId;
          name?: { me: string; en: string };
          slug?: string;
        } | null;

        return {
          id: String(p._id),
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          featuredImage: p.featuredImage,
          tags: p.tags,
          publishedAt: p.publishedAt,
          views: p.views ?? 0,
          author: author
            ? {
                id: String(author._id),
                name: author.name ?? "",
                avatar: author.athleteProfile?.photo ?? null,
              }
            : null,
          club: club
            ? {
                id: String(club._id),
                name: club.name ?? "",
                slug: club.slug ?? "",
                logo: club.logo ?? null,
              }
            : null,
          sport: sport
            ? {
                id: String(sport._id),
                name: sport.name ?? { me: "", en: "" },
                slug: sport.slug ?? "",
              }
            : null,
        };
      }),
      meta: { page, limit, total, totalPages },
    });
  } catch (e) {
    console.error("posts list", e);
    res.status(500).json({ error: "Greška pri učitavanju postova." });
  }
});

router.post("/", requireAuth, requireRole("clubAdmin"), async (req: Request, res: Response) => {
  try {
    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Neispravni podaci.", details: parsed.error.flatten() });
      return;
    }
    const userId = (req as Request & { userId: string }).userId;
    const user = await User.findById(userId);
    if (!user?.clubId) {
      res.status(403).json({ error: "Samo administratori kluba mogu kreirati postove." });
      return;
    }
    const club = await Club.findById(user.clubId);
    if (!club || club.status !== "approved") {
      res.status(403).json({ error: "Klub mora biti odobren da bi se objavljivalo." });
      return;
    }
    const body = parsed.data;
    const featured =
      body.featuredImage && body.featuredImage.length > 0 ? body.featuredImage : undefined;
    const excerpt = excerptFromHtml(body.content || "<p></p>");
    const publishedAt = body.status === "published" ? new Date() : undefined;

    const post = await BlogPost.create({
      title: body.title.trim(),
      slug: body.slug.trim().toLowerCase(),
      content: body.content,
      excerpt,
      featuredImage: featured,
      authorId: user._id,
      clubId: club._id,
      sportId: club.sportId,
      tags: body.tags.map((t) => t.trim()).filter(Boolean),
      visibility: body.visibility,
      status: body.status,
      publishedAt,
    });
    res.status(201).json(serializePost(post));
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err.code === 11000) {
      res.status(409).json({ error: "Slug je već u upotrebi za ovaj klub." });
      return;
    }
    console.error("posts create", e);
    res.status(500).json({ error: "Greška pri čuvanju posta." });
  }
});

router.get("/:id", optionalAuth, async (req: Request, res: Response) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    if (!post) {
      res.status(404).json({ error: "Post nije pronađen." });
      return;
    }

    function canUserEditPost(user: InstanceType<typeof User>): boolean {
      return (
        user.role === "clubAdmin" &&
        Boolean(user.clubId && post.clubId && post.clubId.equals(user.clubId))
      );
    }

    const userId = (req as Request & { userId?: string }).userId;
    let viewer: InstanceType<typeof User> | null = null;
    if (userId) {
      viewer = await User.findById(userId);
    }

    const isPublicReadable =
      post.status === "published" && post.visibility === "public";
    if (isPublicReadable) {
      const canEdit = viewer ? canUserEditPost(viewer) : false;
      res.json({ ...serializePost(post), canEdit });
      return;
    }

    if (!userId || !viewer) {
      res.status(403).json({ error: "Ovaj post nije javan." });
      return;
    }

    const authorMatch = post.authorId.equals(viewer._id);
    const sameClubAdmin =
      viewer.role === "clubAdmin" &&
      Boolean(viewer.clubId && post.clubId && post.clubId.equals(viewer.clubId));
    const superOk = viewer.role === "superAdmin";

    if (authorMatch || sameClubAdmin || superOk) {
      const canEdit = canUserEditPost(viewer);
      res.json({ ...serializePost(post), canEdit });
      return;
    }

    res.status(403).json({ error: "Nemate pravo pregleda ovog posta." });
  } catch (e) {
    console.error("post get", e);
    res.status(500).json({ error: "Greška." });
  }
});

router.patch("/:id", requireAuth, requireRole("clubAdmin"), async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const post = await BlogPost.findById(req.params.id);
    if (!post) {
      res.status(404).json({ error: "Post nije pronađen." });
      return;
    }

    const user = await User.findById(userId);
    if (!user?.clubId || !post.clubId || !post.clubId.equals(user.clubId)) {
      res.status(403).json({ error: "Možete uređivati samo postove svog kluba." });
      return;
    }

    const parsed = updatePostSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Neispravni podaci.", details: parsed.error.flatten() });
      return;
    }

    const body = parsed.data;
    const newSlug = body.slug != null ? body.slug.trim().toLowerCase() : post.slug;

    if (body.slug != null && newSlug !== post.slug) {
      const exists = await BlogPost.findOne({
        clubId: post.clubId,
        slug: newSlug,
        _id: { $ne: post._id },
      });
      if (exists) {
        res.status(409).json({ error: "Slug je već u upotrebi za ovaj klub." });
        return;
      }
      post.slug = newSlug;
    }

    if (body.title != null) post.title = body.title.trim();
    if (body.content != null) {
      post.content = body.content;
      post.excerpt = excerptFromHtml(body.content || "<p></p>");
    }
    if (body.tags != null) {
      post.tags = body.tags.map((t) => t.trim()).filter(Boolean);
    }
    if (body.visibility != null) post.visibility = body.visibility;

    if (body.featuredImage !== undefined) {
      post.featuredImage =
        body.featuredImage && String(body.featuredImage).length > 0
          ? String(body.featuredImage)
          : undefined;
    }

    if (body.status != null) {
      const wasPublished = post.status === "published";
      post.status = body.status;
      if (body.status === "published" && !wasPublished && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }

    await post.save();
    res.json(serializePost(post));
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err.code === 11000) {
      res.status(409).json({ error: "Slug je već u upotrebi za ovaj klub." });
      return;
    }
    console.error("posts patch", e);
    res.status(500).json({ error: "Greška pri ažuriranju posta." });
  }
});

router.delete("/:id", (_req: Request, res: Response) => {
  res.json({ message: "Brisanje posta uskoro." });
});

export default router;
