import { config } from './config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authMiddleware } from './middlewares/authMiddleware';
import { authRouter } from './routes/auth.router';
import { dockerRouter } from './routes/docker.router';
import { nginxRouter } from './routes/nginx.router';
const app = express();
const allowedOrigins = ['http://localhost:3000', /^https?:\/\/localhost:\d+$/, "admin.dvachette.fr"];

app.use(cors({
    origin: allowedOrigins,
}));

app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRouter);
app.use("/api", authMiddleware);
app.use("/api/docker", dockerRouter);
app.use("/api/nginx", nginxRouter);

app.listen(config.PORT, () => {
    console.log(`Server is running on port ${config.PORT}`);
});