import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";
import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  createSession,
  SESSION_COOKIE,
  SESSION_TTL,
} from "../lib/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

async function sendResetEmail(
  to: string,
  resetUrl: string,
  firstName: string | null,
) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.info({ resetUrl, to }, "Password reset link (RESEND_API_KEY not set — log only)");
    return;
  }

  const resend = new Resend(apiKey);
  const name = firstName ?? "there";

  await resend.emails.send({
    from: "BlockPaper <onboarding@resend.dev>",
    to: [to],
    subject: "Reset your BlockPaper password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#070b12;color:#fff;padding:40px 32px;border-radius:16px;border:1px solid rgba(255,255,255,0.1)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#22d3ee,#3b82f6);display:flex;align-items:center;justify-content:center">
            <span style="color:#fff;font-weight:900;font-size:16px">B</span>
          </div>
          <span style="font-size:18px;font-weight:700">Block<span style="color:#22d3ee">Paper</span></span>
        </div>

        <h1 style="font-size:22px;font-weight:700;margin:0 0 8px">Reset your password</h1>
        <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 24px;line-height:1.6">
          Hi ${name}, we received a request to reset the password for your BlockPaper account.
          Click the button below to choose a new password. This link expires in <strong style="color:#fff">1 hour</strong>.
        </p>

        <a href="${resetUrl}"
           style="display:inline-block;padding:14px 28px;background:linear-gradient(90deg,#06b6d4,#3b82f6);color:#fff;font-weight:700;font-size:15px;border-radius:12px;text-decoration:none;margin-bottom:24px">
          Reset Password
        </a>

        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0;line-height:1.6">
          If you didn't request this, you can safely ignore this email — your password won't change.<br><br>
          Or copy and paste this link into your browser:<br>
          <span style="color:#22d3ee;word-break:break-all">${resetUrl}</span>
        </p>
      </div>
    `,
  });
}

// ─── GET /api/auth/user ───────────────────────────────────────────────────────

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

// ─── POST /api/auth/signup ────────────────────────────────────────────────────

router.post("/auth/signup", async (req: Request, res: Response) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email, and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const emailLower = email.toLowerCase().trim();
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, emailLower))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? null;
  const lastName = parts.slice(1).join(" ") || null;

  const [user] = await db
    .insert(usersTable)
    .values({ email: emailLower, firstName, lastName, passwordHash })
    .returning();

  const sid = await createSession({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  });
  setSessionCookie(res, sid);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  });
});

// ─── POST /api/auth/signin ────────────────────────────────────────────────────

router.post("/auth/signin", async (req: Request, res: Response) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const emailLower = email.toLowerCase().trim();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, emailLower))
    .limit(1);

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const sid = await createSession({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  });
  setSessionCookie(res, sid);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

router.post("/auth/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  // Always return success to prevent email enumeration
  res.json({ message: "If that email exists, a reset link has been sent." });

  const emailLower = email.toLowerCase().trim();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, emailLower))
    .limit(1);

  if (!user || !user.passwordHash) return; // No account or Google-only account

  // Delete existing unused tokens for this user
  await db
    .delete(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.userId, user.id),
        isNull(passwordResetTokensTable.usedAt),
      ),
    );

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokensTable).values({
    token,
    userId: user.id,
    expiresAt,
  });

  const resetUrl = `${getOrigin(req)}/reset-password?token=${token}`;

  try {
    await sendResetEmail(emailLower, resetUrl, user.firstName);
  } catch (err) {
    logger.error({ err }, "Failed to send reset email");
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

router.post("/auth/reset-password", async (req: Request, res: Response) => {
  const { token, password } = req.body as {
    token?: string;
    password?: string;
  };

  if (!token || !password) {
    res.status(400).json({ error: "Token and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [resetToken] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, token),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!resetToken) {
    res
      .status(400)
      .json({ error: "This reset link is invalid or has expired. Please request a new one." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, resetToken.userId));

  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.token, token));

  res.json({ message: "Password updated successfully" });
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.get("/auth/google", (req: Request, res: Response) => {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  if (!clientId) {
    res.status(503).json({ error: "Google OAuth not configured" });
    return;
  }

  const origin = getOrigin(req);
  const callbackUrl = `${origin}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
});

router.get("/auth/google/callback", async (req: Request, res: Response) => {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    res.redirect("/signin?error=google_not_configured");
    return;
  }

  const { code, error } = req.query;
  if (error || !code) {
    res.redirect("/signin?error=google_cancelled");
    return;
  }

  const origin = getOrigin(req);
  const callbackUrl = `${origin}/api/auth/google/callback`;

  let tokenData: Record<string, unknown>;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });
    tokenData = (await tokenRes.json()) as Record<string, unknown>;
  } catch {
    res.redirect("/signin?error=google_failed");
    return;
  }

  if (!tokenData["access_token"]) {
    res.redirect("/signin?error=google_failed");
    return;
  }

  let profile: Record<string, unknown>;
  try {
    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenData["access_token"] as string}`,
        },
      },
    );
    profile = (await profileRes.json()) as Record<string, unknown>;
  } catch {
    res.redirect("/signin?error=google_failed");
    return;
  }

  if (!profile["sub"]) {
    res.redirect("/signin?error=google_failed");
    return;
  }

  const googleId = profile["sub"] as string;
  const googleEmail = (profile["email"] as string | undefined)
    ?.toLowerCase()
    .trim();
  const givenName = (profile["given_name"] as string | undefined) ?? null;
  const familyName = (profile["family_name"] as string | undefined) ?? null;
  const picture = (profile["picture"] as string | undefined) ?? null;

  let user;
  const [existingByGoogle] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.googleId, googleId))
    .limit(1);

  if (existingByGoogle) {
    user = existingByGoogle;
  } else if (googleEmail) {
    const [existingByEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, googleEmail))
      .limit(1);

    if (existingByEmail) {
      const [updated] = await db
        .update(usersTable)
        .set({ googleId, profileImageUrl: picture, updatedAt: new Date() })
        .where(eq(usersTable.id, existingByEmail.id))
        .returning();
      user = updated;
    } else {
      const [created] = await db
        .insert(usersTable)
        .values({
          email: googleEmail,
          firstName: givenName,
          lastName: familyName,
          profileImageUrl: picture,
          googleId,
        })
        .returning();
      user = created;
    }
  } else {
    res.redirect("/signin?error=google_no_email");
    return;
  }

  const sid = await createSession({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
    access_token: tokenData["access_token"] as string,
  });

  setSessionCookie(res, sid);
  res.redirect("/");
});

// ─── Logout ───────────────────────────────────────────────────────────────────

router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

router.get("/login", (_req, res: Response) => {
  res.redirect("/signin");
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

export default router;
