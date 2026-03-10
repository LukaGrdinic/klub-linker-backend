import { Router, Request, Response } from "express";
import { Club } from "../models/Club";
import { User } from "../models/User";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleCheck";
import { sendEmail } from "../utils/email";

const router = Router();

// GET /api/clubs – lista klubova (opciono ?status= & ?sportId= & ?search=)
router.get("/", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const sportId = req.query.sportId as string | undefined;
    const search = req.query.search as string | undefined;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (sportId) filter.sportId = sportId;
    if (search && search.trim()) filter.name = { $regex: search.trim(), $options: "i" };
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

// PATCH /api/clubs/:id – odobri/odbij klub (samo super admin); pri odobrenju odobri i admina kluba; šalje email
router.patch("/:id", requireAuth, requireRole("superAdmin"), async (req: Request, res: Response) => {
  try {
    const { status, rejectReason } = req.body as { status?: string; rejectReason?: string };
    if (!status || !["approved", "rejected"].includes(status)) {
      res.status(400).json({ error: "Status mora biti 'approved' ili 'rejected'." });
      return;
    }
    const club = await Club.findById(req.params.id).populate("admins", "email name");
    if (!club) {
      res.status(404).json({ error: "Klub nije pronađen." });
      return;
    }
    await Club.findByIdAndUpdate(req.params.id, { status });
    await User.updateMany({ clubId: club._id }, { status });

    const adminEmails = Array.isArray(club.admins)
      ? (club.admins as { email?: string }[]).map((a) => a.email).filter(Boolean) as string[]
      : [];
    const clubName = club.name;

    if (status === "approved" && adminEmails.length > 0) {
      await sendEmail(
        adminEmails[0],
        "Klub odobren – Klub Linker",
        `<p>Poštovani,</p><p>Vaš klub <strong>${clubName}</strong> je odobren. Sada se možete prijaviti na platformu.</p><p>Pozdrav,<br/>Klub Linker</p>`
      );
    } else if (status === "rejected" && adminEmails.length > 0) {
      const reason = rejectReason ? `<p>Razlog: ${rejectReason}</p>` : "";
      await sendEmail(
        adminEmails[0],
        "Zahtjev za klub odbijen – Klub Linker",
        `<p>Poštovani,</p><p>Nažalost, zahtjev za registraciju kluba <strong>${clubName}</strong> je odbijen.</p>${reason}<p>Pozdrav,<br/>Klub Linker</p>`
      );
    }

    res.json({
      message: status === "approved" ? "Klub je odobren. Admin kluba sada se može prijaviti." : "Klub je odbijen.",
      club: { id: String(club._id), name: clubName, status },
    });
  } catch (err) {
    console.error("Club update error:", err);
    res.status(500).json({ error: "Greška pri ažuriranju kluba." });
  }
});

export default router;
