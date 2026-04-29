import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.token;

    if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    try {
        jwt.verify(token, config.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: "Invalid token" });
    }
}