import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config";
export const authRouter = Router();

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

    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 86400000,
    });

    res.json({ ok: true });
});