import { Router, Request, Response } from "express";
import { Club } from "../models/Club";
import { User } from "../models/User";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleCheck";

const router = Router();

// GET /api/clubs – lista klubova (opciono ?status=pending za super admina)
router.get("/", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const filter = status ? { status } : {};
    const clubs = await Club.find(filter)
      .populate("sportId", "name slug")
      .populate("admins", "email name")
      .sort({ createdAt: -1 })
      .lean();
    const data = clubs.map((c) => ({
      id: String(c._id),
      name: c.name,
      slug: c.slug,
      sportId: c.sportId,
      sport: c.sportId && typeof c.sportId === "object" ? { name: (c.sportId as { name?: { me: string } }).name, slug: (c.sportId as { slug?: string }).slug } : null,
      location: c.location,
      status: c.status,
      admins: c.admins,
      createdAt: c.createdAt,
    }));
    res.json({ data });
  } catch (err) {
    console.error("Clubs list error:", err);
    res.status(500).json({ error: "Greška pri učitavanju klubova." });
  }
});

// GET /api/clubs/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const club = await Club.findById(req.params.id)
      .populate("sportId", "name slug")
      .populate("admins", "email name")
      .lean();
    if (!club) {
      res.status(404).json({ error: "Klub nije pronađen." });
      return;
    }
    res.json({
      id: String(club._id),
      ...club,
    });
  } catch (err) {
    console.error("Club detail error:", err);
    res.status(500).json({ error: "Greška pri učitavanju kluba." });
  }
});

// PATCH /api/clubs/:id – odobri/odbij klub (samo super admin); pri odobrenju odobri i admina kluba
router.patch("/:id", requireAuth, requireRole("superAdmin"), async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status?: string };
    if (!status || !["approved", "rejected"].includes(status)) {
      res.status(400).json({ error: "Status mora biti 'approved' ili 'rejected'." });
      return;
    }
    const club = await Club.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!club) {
      res.status(404).json({ error: "Klub nije pronađen." });
      return;
    }
    await User.updateMany(
      { clubId: club._id },
      { status }
    );
    res.json({
      message: status === "approved" ? "Klub je odobren. Admin kluba sada se može prijaviti." : "Klub je odbijen.",
      club: { id: String(club._id), name: club.name, status: club.status },
    });
  } catch (err) {
    console.error("Club update error:", err);
    res.status(500).json({ error: "Greška pri ažuriranju kluba." });
  }
});

export default router;
