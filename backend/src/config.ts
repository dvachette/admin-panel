import 'dotenv/config'

export const config = {
    PORT: process.env.PORT || 3000,
    JWT_SECRET: process.env.JWT_SECRET!,
    ADMIN_USER: process.env.ADMIN_USER!,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH!,
}