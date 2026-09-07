import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logger } from "@/lib/server/logger";
import { requestContext } from "@/lib/security/request";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(rawCredentials) {
        const rate = await enforceRateLimit("login", { limit: 8, windowSeconds: 900 });
        if (!rate.allowed) return null;

        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase().trim() },
          include: {
            roles: {
              include: { role: true },
            },
          },
        });

        if (!user || user.status !== "ACTIVE") {
          const ctx = await requestContext();
          logger.warn("Login rejected", { requestId: ctx.requestId, reason: "invalid_user_or_status" });
          return null;
        }

        const validPassword = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash,
        );

        if (!validPassword) {
          const ctx = await requestContext();
          logger.warn("Login rejected", { requestId: ctx.requestId, reason: "invalid_credentials", userId: user.id });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.roles.map(({ role }) => role.name),
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.roles = (user as { roles?: string[] }).roles ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.roles = (token.roles as string[]) ?? [];
      }
      return session;
    },
  },
});
