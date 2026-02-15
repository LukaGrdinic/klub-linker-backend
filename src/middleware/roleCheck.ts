import { Request, Response, NextFunction } from "express";

export type Role = "superAdmin" | "clubAdmin" | "athlete";

const hierarchy: Role[] = ["athlete", "clubAdmin", "superAdmin"];

export function hasRole(userRole: Role, required: Role): boolean {
  return hierarchy.indexOf(userRole) >= hierarchy.indexOf(required);
}

export function requireRole(required: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req as Request & { userRole?: string }).userRole as Role | undefined;
    if (!role || !hasRole(role, required)) {
      res.status(403).json({ error: "Nedovoljno ovlašćenja" });
      return;
    }
    next();
  };
}
