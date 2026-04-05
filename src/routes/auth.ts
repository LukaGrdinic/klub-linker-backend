import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import slugify from "slugify";
import { z } from "zod";
import { User } from "../models/User";
import { Sport } from "../models/Sport";
import { Club } from "../models/Club";
import { requireAuth } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "";
const SALT_ROUNDS = 10;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSportistaSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  dateOfBirth: z.string().optional(),
});

const registerKlubSchema = z.object({
  clubName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  sportId: z.string().min(1),
  city: z.string().min(1),
});

function createToken(userId: string, email: string, role: string): string {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: "7d" });
}

function sanitizeUser(user: {
  _id: unknown;
  email: string;
  name: string;
  role: string;
  clubId?: unknown;
  status: string;
}) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    clubId: user.clubId ? String(user.clubId) : null,
    status: user.status,
  };
}

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Neispravan email ili lozinka.",
        details: parsed.error.flatten(),
      });
      return;
    }
    const { email, password } = parsed.data;
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      res.status(401).json({ error: "Pogrešan email ili lozinka." });
      return;
    }

    const isActive = (user as { isActive?: boolean }).isActive !== false;
    if (!isActive) {
      res.status(403).json({ error: "Nalog je deaktiviran." });
      return;
    }
    if (user.status !== "approved") {
      res.status(403).json({
        error:
          "Nalog čeka odobrenje. Super administrator mora odobriti klub prije nego se možete prijaviti.",
        code: "PENDING_APPROVAL",
      });
      return;
    }
    const match = await bcrypt.compare(
      password,
      (user as { password: string }).password,
    );
    if (!match) {
      res.status(401).json({ error: "Pogrešan email ili lozinka." });
      return;
    }
    const token = createToken(String(user._id), user.email, user.role);
    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Greška pri prijavi." });
  }
});

// POST /api/auth/register/sportista
router.post("/register/sportista", async (req: Request, res: Response) => {
  try {
    const parsed = registerSportistaSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Neispravni podaci.", details: parsed.error.flatten() });
      return;
    }
    const { name, email, password, dateOfBirth } = parsed.data;
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json({ error: "Email je već u upotrebi." });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      role: "athlete",
      status: "approved",
      athleteProfile: dateOfBirth
        ? {
            dateOfBirth: new Date(dateOfBirth),
            bio: "",
            position: "",
            nationality: "",
          }
        : undefined,
    });
    const token = createToken(String(user._id), user.email, user.role);
    res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Register sportista error:", err);
    res.status(500).json({ error: "Greška pri registraciji." });
  }
});

// POST /api/auth/register/klub – javna forma; klub i admin ostaju pending dok super admin ne potvrdi
router.post("/register/klub", async (req: Request, res: Response) => {
  try {
    const parsed = registerKlubSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Neispravni podaci.", details: parsed.error.flatten() });
      return;
    }
    const { clubName, email, password, sportId, city } = parsed.data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: "Email je već u upotrebi." });
      return;
    }

    const sport = await Sport.findById(sportId);
    if (!sport) {
      res.status(400).json({ error: "Izabrani sport nije pronađen." });
      return;
    }

    const baseSlug = slugify(clubName, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 0;
    while (await Club.findOne({ slug })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      email,
      password: hashedPassword,
      name: email.split("@")[0],
      role: "clubAdmin",
      status: "pending",
    });

    const club = await Club.create({
      name: clubName,
      slug,
      sportId: sport._id,
      location: { city, country: "Crna Gora" },
      admins: [user._id],
      status: "pending",
    });

    await User.findByIdAndUpdate(user._id, { clubId: club._id });

    res.status(201).json({
      message:
        "Zahtjev za registraciju je poslan. Super administrator mora potvrditi klub prije nego se možete prijaviti.",
      userId: String(user._id),
    });
  } catch (err) {
    console.error("Register klub error:", err);
    res.status(500).json({ error: "Greška pri registraciji kluba." });
  }
});

// GET /api/auth/me – trenutni korisnik (zaštićeno)
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const user = await User.findById(userId);
  if (!user) {
    res.status(401).json({ error: "Korisnik nije pronađen." });
    return;
  }
  res.json(sanitizeUser(user));
});

export default router;

