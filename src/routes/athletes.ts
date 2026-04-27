import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/User";
import { BlogPost } from "../models/BlogPost";

const router = Router();

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const idRaw = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(idRaw)) {
      res.status(404).json({ error: "Sportista nije pronađen." });
      return;
    }

    const user = await User.findById(idRaw)
      .select("name role status isActive athleteProfile clubId")
      .populate({
        path: "clubId",
        select: "name slug logo sportId",
        populate: { path: "sportId", select: "name slug" },
      })
      .lean();

    if (
      !user ||
      user.role !== "athlete" ||
      user.status !== "approved" ||
      user.isActive === false
    ) {
      res.status(404).json({ error: "Sportista nije pronađen." });
      return;
    }

    const authorOid = user._id as mongoose.Types.ObjectId;
    const postFilter = {
      authorId: authorOid,
      status: "published" as const,
      visibility: "public" as const,
    };

    const [publicPostCount, galleryPosts] = await Promise.all([
      BlogPost.countDocuments(postFilter),
      BlogPost.find({
        ...postFilter,
        featuredImage: { $exists: true, $nin: [null, ""] },
      })
        .sort({ publishedAt: -1 })
        .limit(40)
        .select("featuredImage title")
        .lean(),
    ]);

    const seen = new Set<string>();
    const gallery: { image: string; postId: string; title: string }[] = [];
    for (const p of galleryPosts) {
      const img = p.featuredImage as string | undefined;
      if (!img || seen.has(img)) continue;
      seen.add(img);
      gallery.push({ image: img, postId: String(p._id), title: p.title ?? "" });
      if (gallery.length >= 18) break;
    }

    const clubRaw = user.clubId as unknown;
    let club: {
      id: string;
      name: string;
      slug: string;
      logo: string | null;
      sport: { id: string; name: { me: string; en: string }; slug: string } | null;
    } | null = null;

    if (clubRaw && typeof clubRaw === "object" && "_id" in clubRaw) {
      const c = clubRaw as {
        _id: mongoose.Types.ObjectId;
        name?: string;
        slug?: string;
        logo?: string;
        sportId?: unknown;
      };
      let sport: { id: string; name: { me: string; en: string }; slug: string } | null = null;
      const sp = c.sportId;
      if (sp && typeof sp === "object" && "_id" in sp) {
        const s = sp as {
          _id: mongoose.Types.ObjectId;
          name?: { me: string; en: string };
          slug?: string;
        };
        sport = {
          id: String(s._id),
          name: s.name ?? { me: "", en: "" },
          slug: s.slug ?? "",
        };
      }
      club = {
        id: String(c._id),
        name: c.name ?? "",
        slug: c.slug ?? "",
        logo: c.logo ?? null,
        sport,
      };
    }

    const ap = user.athleteProfile ?? {};
    res.json({
      data: {
        id: String(user._id),
        name: user.name ?? "",
        athleteProfile: {
          bio: ap.bio ?? "",
          photo: ap.photo ?? null,
          position: ap.position ?? "",
          dateOfBirth: ap.dateOfBirth ? new Date(ap.dateOfBirth).toISOString() : null,
          nationality: ap.nationality ?? "",
        },
        club,
        publicPostCount,
        gallery,
      },
    });
  } catch (err) {
    console.error("Athlete public get error:", err);
    res.status(500).json({ error: "Greška pri učitavanju sportiste." });
  }
});

export default router;
