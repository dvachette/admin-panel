import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config";
export const authRouter = Router();

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
};

authRouter.post("/login", async (req, res) => {
    const { username, password } = req.body;

    if (username !== config.ADMIN_USER) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
    }

    const valid = await bcrypt.compare(password, config.ADMIN_PASSWORD_HASH);
    if (!valid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
    }

    const token = jwt.sign({ username }, config.JWT_SECRET, { expiresIn: "24h" });

    // No maxAge: session cookie, dropped when the browser is closed (the JWT still expires after 24h)
    res.cookie("token", token, COOKIE_OPTIONS);

    res.json({ ok: true });
});

// Lets the frontend restore its session state after a page refresh
authRouter.get("/me", (req, res) => {
    try {
        const payload = jwt.verify(req.cookies?.token ?? "", config.JWT_SECRET) as { username: string };
        res.json({ username: payload.username });
    } catch {
        res.status(401).json({ error: "Unauthorized" });
    }
});

authRouter.post("/logout", (req, res) => {
    res.clearCookie("token", COOKIE_OPTIONS);
    res.json({ ok: true });
});