import bcrypt from "bcryptjs";
import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  createSession,
  SESSION_COOKIE,
  SESSION_TTL,
} from "../lib/auth";

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

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

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
    res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
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

  const sid = await createSession({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, profileImageUrl: user.profileImageUrl } });
  setSessionCookie(res, sid);
  res.json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, profileImageUrl: user.profileImageUrl } });
});

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

  const sid = await createSession({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, profileImageUrl: user.profileImageUrl } });
  setSessionCookie(res, sid);
  res.json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, profileImageUrl: user.profileImageUrl } });
});

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
