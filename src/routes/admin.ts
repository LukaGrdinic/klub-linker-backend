import { Router, Request, Response } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleCheck";
import { Club } from "../models/Club";
import { User } from "../models/User";
import { Sport } from "../models/Sport";
import { BlogPost } from "../models/BlogPost";
import { ClubRegistrationInvite } from "../models/ClubRegistrationInvite";
import slugify from "slugify";
import { z } from "zod";

const router = Router();
const INVITE_EXPIRES_DAYS = 7;

router.use(requireAuth);
router.use(requireRole("superAdmin"));

router.get("/", async (_req, res) => {
  try {
    const sports = await Sport.find({ isActive: true })
      .sort({ "name.me": 1 })
      .lean();
    const data = sports.map((s) => ({
      id: String(s._id),
      name: s.name,
      slug: s.slug,
    }));
    res.json({ data });
  } catch (err) {
    console.error("Sports list error:", err);
    res.status(500).json({ error: "Greška pri učitavanju sportova." });
  }
});

// GET /api/admin/dashboard/stats
router.get("/dashboard/stats", async (_req: Request, res: Response) => {
  try {
    const [
      clubsPending,
      clubsApproved,
      clubsRejected,
      athletesCount,
      postsCount,
      viewsResult,
    ] = await Promise.all([
      Club.countDocuments({ status: "pending" }),
      Club.countDocuments({ status: "approved" }),
      Club.countDocuments({ status: "rejected" }),
      User.countDocuments({ role: "athlete" }),
      BlogPost.countDocuments({}),
      BlogPost.aggregate([
        { $group: { _id: null, total: { $sum: "$views" } } },
      ]),
    ]);
    const totalViews = viewsResult[0]?.total ?? 0;
    res.json({
      data: {
        clubsPending,
        clubsApproved,
        clubsRejected,
        clubsTotal: clubsPending + clubsApproved + clubsRejected,
        athletesCount,
        postsCount,
        totalViews,
      },
    });
  } catch (err) {
    console.error("Admin dashboard stats error:", err);
    res.status(500).json({ error: "Greška pri učitavanju statistike." });
  }
});

// GET /api/admin/dashboard/charts
router.get("/dashboard/charts", async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const registrationsByMonth = await Club.aggregate([
      { $match: { createdAt: { $gte: startOfYear } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]).then((rows) =>
      rows.map((r) => ({
        label: `${r._id.year}-${String(r._id.month).padStart(2, "0")}`,
        count: r.count,
      })),
    );

    const topClubsByPosts = await BlogPost.aggregate([
      { $match: { clubId: { $ne: null } } },
      { $group: { _id: "$clubId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "clubs",
          localField: "_id",
          foreignField: "_id",
          as: "club",
        },
      },
      { $unwind: "$club" },
      { $project: { name: "$club.name", count: 1, _id: 0 } },
    ]);

    const sportsPie = await Club.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$sportId", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "sports",
          localField: "_id",
          foreignField: "_id",
          as: "sport",
        },
      },
      { $unwind: "$sport" },
      { $project: { name: "$sport.name.me", count: 1, _id: 0 } },
    ]);

    res.json({
      data: {
        registrationsByMonth,
        topClubsByPosts,
        sportsPie,
      },
    });
  } catch (err) {
    console.error("Admin dashboard charts error:", err);
    res.status(500).json({ error: "Greška pri učitavanju grafika." });
  }
});

// POST /api/admin/club-invite – kreira invite token i vraća link
router.post("/club-invite", async (req: Request, res: Response) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRES_DAYS);
    await ClubRegistrationInvite.create({
      token,
      createdBy: userId,
      expiresAt,
    });
    const locale = (req.query.locale as string) || "me";
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const link = `${baseUrl}/${locale}/registracija/klub?token=${token}`;
    res.status(201).json({
      data: { link, token, expiresAt },
    });
  } catch (err) {
    console.error("Club invite create error:", err);
    res.status(500).json({ error: "Greška pri kreiranju invite linka." });
  }
});

// GET /api/admin/korisnici?role=&search= (regex zbog eventualnog trailing slash-a)
router.get(/^\/korisnici\/?$/, async (req: Request, res: Response) => {
  try {
    const role = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;
    const filter: Record<string, unknown> = {};
    if (role && ["superAdmin", "clubAdmin", "athlete"].includes(role))
      filter.role = role;
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ];
    }
    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      data: users.map((u) => ({
        id: String(u._id),
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        isActive: (u as { isActive?: boolean }).isActive !== false,
        clubId: u.clubId ? String(u.clubId) : null,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    console.error("Admin korisnici list error:", err);
    res.status(500).json({ error: "Greška pri učitavanju korisnika." });
  }
});

const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["superAdmin", "clubAdmin", "athlete"]).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/admin/korisnici/:id
router.patch("/korisnici/:id", async (req: Request, res: Response) => {
  try {
    const parsed = userUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Neispravni podaci.", details: parsed.error.flatten() });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.role !== undefined) updates.role = parsed.data.role;
    if (parsed.data.isActive !== undefined)
      updates.isActive = parsed.data.isActive;
    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    })
      .select("-password")
      .lean();
    if (!user) {
      res.status(404).json({ error: "Korisnik nije pronađen." });
      return;
    }
    res.json({
      data: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: (user as { isActive?: boolean }).isActive !== false,
      },
    });
  } catch (err) {
    console.error("Admin user update error:", err);
    res.status(500).json({ error: "Greška pri ažuriranju korisnika." });
  }
});

// ——— Sportovi (samo super admin) ———

const sportCreateSchema = z.object({
  nameMe: z.string().min(1),
  nameEn: z.string().min(1),
  slug: z.string().optional(),
  descriptionMe: z.string().optional(),
  descriptionEn: z.string().optional(),
  icon: z.string().optional(),
  coverImage: z.string().optional(),
});

const sportUpdateSchema = sportCreateSchema.partial();

// GET /api/admin/sportovi – svi sportovi (uključujući neaktivne)
router.get(/^\/sportovi\/?$/, async (_req: Request, res: Response) => {
  try {
    const sports = await Sport.find({}).sort({ "name.me": 1 }).lean();
    res.json({
      data: sports.map((s) => ({
        id: String(s._id),
        name: s.name,
        slug: s.slug,
        description: s.description,
        icon: s.icon,
        coverImage: s.coverImage,
        isActive: s.isActive,
      })),
    });
  } catch (err) {
    console.error("Admin sportovi list error:", err);
    res.status(500).json({ error: "Greška pri učitavanju sportova." });
  }
});

// POST /api/admin/sportovi
router.post("/sportovi", async (req: Request, res: Response) => {
  try {
    const parsed = sportCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Neispravni podaci.", details: parsed.error.flatten() });
      return;
    }
    const userId = (req as Request & { userId: string }).userId;
    const {
      nameMe,
      nameEn,
      slug,
      descriptionMe,
      descriptionEn,
      icon,
      coverImage,
    } = parsed.data;
    const baseSlug = slug ?? slugify(nameMe, { lower: true, strict: true });
    let finalSlug = baseSlug;
    let counter = 0;
    while (await Sport.findOne({ slug: finalSlug })) {
      counter++;
      finalSlug = `${baseSlug}-${counter}`;
    }
    const sport = await Sport.create({
      name: { me: nameMe, en: nameEn },
      slug: finalSlug,
      description:
        descriptionMe || descriptionEn
          ? { me: descriptionMe ?? "", en: descriptionEn ?? "" }
          : undefined,
      icon: icon ?? undefined,
      coverImage: coverImage ?? undefined,
      isActive: true,
      createdBy: userId,
    });
    res.status(201).json({
      data: {
        id: String(sport._id),
        name: sport.name,
        slug: sport.slug,
        isActive: sport.isActive,
      },
    });
  } catch (err) {
    console.error("Admin sport create error:", err);
    res.status(500).json({ error: "Greška pri kreiranju sporta." });
  }
});

// GET /api/admin/sportovi/:id
router.get("/sportovi/:id", async (req: Request, res: Response) => {
  try {
    const sport = await Sport.findById(req.params.id).lean();
    if (!sport) {
      res.status(404).json({ error: "Sport nije pronađen." });
      return;
    }
    res.json({
      data: {
        id: String(sport._id),
        name: sport.name,
        slug: sport.slug,
        description: sport.description,
        icon: sport.icon,
        coverImage: sport.coverImage,
        isActive: sport.isActive,
      },
    });
  } catch (err) {
    console.error("Admin sport detail error:", err);
    res.status(500).json({ error: "Greška pri učitavanju sporta." });
  }
});

// PATCH /api/admin/sportovi/:id
router.patch("/sportovi/:id", async (req: Request, res: Response) => {
  try {
    const parsed = sportUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Neispravni podaci.", details: parsed.error.flatten() });
      return;
    }
    const sport = await Sport.findById(req.params.id);
    if (!sport) {
      res.status(404).json({ error: "Sport nije pronađen." });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.nameMe !== undefined)
      updates["name.me"] = parsed.data.nameMe;
    if (parsed.data.nameEn !== undefined)
      updates["name.en"] = parsed.data.nameEn;
    if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug;
    if (parsed.data.descriptionMe !== undefined)
      updates["description.me"] = parsed.data.descriptionMe;
    if (parsed.data.descriptionEn !== undefined)
      updates["description.en"] = parsed.data.descriptionEn;
    if (parsed.data.icon !== undefined) updates.icon = parsed.data.icon;
    if (parsed.data.coverImage !== undefined)
      updates.coverImage = parsed.data.coverImage;
    const updated = await Sport.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).lean();
    res.json({
      data: {
        id: String(updated!._id),
        name: updated!.name,
        slug: updated!.slug,
        isActive: updated!.isActive,
      },
    });
  } catch (err) {
    console.error("Admin sport update error:", err);
    res.status(500).json({ error: "Greška pri ažuriranju sporta." });
  }
});

// PATCH /api/admin/sportovi/:id/deactivate
router.patch(
  "/sportovi/:id/deactivate",
  async (req: Request, res: Response) => {
    try {
      const sport = await Sport.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true },
      );
      if (!sport) {
        res.status(404).json({ error: "Sport nije pronađen." });
        return;
      }
      res.json({ data: { id: String(sport._id), isActive: false } });
    } catch (err) {
      console.error("Admin sport deactivate error:", err);
      res.status(500).json({ error: "Greška pri deaktivaciji sporta." });
    }
  },
);

// Ako nijedna ruta nije odgovorila, vrati 404 sa info za debug
/* router.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Admin ruta nije pronađena",
    path: req.path,
    baseUrl: req.baseUrl,
    url: req.url,
    method: req.method,
  });
}); */

export default router;
