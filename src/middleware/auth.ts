import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Nije pronađen token" });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role?: string };
    (req as Request & { userId?: string; userRole?: string }).userId = decoded.userId;
    (req as Request & { userId?: string; userRole?: string }).userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: "Neispravan ili istekao token" });
  }
}
