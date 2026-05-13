import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const signInAttempts = new Map<string, { count: number; resetAt: number }>();

function checkAndIncrementRateLimit(email: string) {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = signInAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    signInAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const secs = Math.ceil((entry.resetAt - now) / 1000);
    throw new Error(
      `Zbyt wiele prób logowania. Spróbuj ponownie za ${Math.ceil(secs / 60)} min.`,
    );
  }
  entry.count++;
}

const PasswordProvider = Password<DataModel>({
  profile(params) {
    const email = (params.email as string | undefined)?.trim().toLowerCase();
    if (!email) throw new Error("Email jest wymagany");

    const flow = params.flow as string | undefined;
    if (flow === "signIn") {
      checkAndIncrementRateLimit(email);
    }

    const name = (params.name as string | undefined)?.trim();
    return {
      email,
      ...(name ? { name } : {}),
      isActive: true,
      mustChangePassword: false,
    };
  },
  validatePasswordRequirements(password) {
    if (password.length < 8) {
      throw new Error("Hasło musi mieć co najmniej 8 znaków");
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordProvider],
});
