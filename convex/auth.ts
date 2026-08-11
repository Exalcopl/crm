import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel, Id } from "./_generated/dataModel";

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
    try {
      const email = (params.email as string | undefined)?.trim().toLowerCase();
      if (!email) throw new Error("Email jest wymagany");

      const flow = params.flow as string | undefined;
      if (flow === "signIn") {
        checkAndIncrementRateLimit(email);
      }

      const name = (params.name as string | undefined)?.trim();
      const roleId = (params.roleId as unknown as Id<"roles"> | undefined);
      return {
        email,
        ...(name ? { name } : {}),
        isActive: true,
        mustChangePassword: false,
        ...(roleId ? { roleId } : {}),
      };
    } catch (err) {
      console.error("Password provider profile error:", err);
      throw err;
    }
  },
  validatePasswordRequirements(password) {
    if (password.length < 8) {
      throw new Error("Hasło musi mieć co najmniej 8 znaków");
    }
  },
});

const PinProvider = Password<DataModel>({
  id: "pin",
  profile(params) {
    try {
      const email = (params.email as string | undefined)?.trim().toLowerCase();
      if (!email) throw new Error("Email jest wymagany");

      const flow = params.flow as string | undefined;
      if (flow === "signIn") {
        checkAndIncrementRateLimit(email);
      }

      return {
        email,
      };
    } catch (err) {
      console.error("PIN provider profile error:", err);
      throw err;
    }
  },
  validatePasswordRequirements(pin) {
    if (!/^\d{4,6}$/.test(pin)) {
      throw new Error("Kod PIN musi składać się z 4 do 6 cyfr");
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordProvider, PinProvider],
});
