"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { verifyResetTokenApi, resetPasswordApi } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <div className="auth-card text-center">Loading reset session...</div>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  // Token validation state
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<{
    reason?: "invalid" | "expired" | "used";
    message: string;
  } | null>(null);

  // Form states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  // Verify token on mount
  useEffect(() => {
    async function checkToken() {
      if (!token || !token.trim()) {
        setVerifying(false);
        setTokenError({
          reason: "invalid",
          message: "No password reset token was provided. Please check your link or request a new one.",
        });
        return;
      }

      try {
        setVerifying(true);
        const res = await verifyResetTokenApi(token.trim());

        if (res.valid) {
          setTokenValid(true);
        } else {
          setTokenError({
            reason: res.reason,
            message: res.message || "This password reset token is invalid or has expired.",
          });
        }
      } catch (err: any) {
        console.error("Token verification error:", err);
        setTokenError({
          reason: "invalid",
          message:
            err.message ||
            "Unable to verify reset token. Please request a new password reset link.",
        });
      } finally {
        setVerifying(false);
      }
    }

    checkToken();
  }, [token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!password) {
      setFormError("Please enter a new password.");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match. Please ensure both fields are identical.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await resetPasswordApi({
        token: token.trim(),
        password,
        confirmPassword,
      });

      if (res.success) {
        setResetSuccess(true);
      } else {
        setFormError(res.message || "Failed to reset password. Please try again.");
      }
    } catch (err: any) {
      console.error("Password reset submission error:", err);
      setFormError(err.message || "An error occurred while resetting your password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <Link href="/login" className="auth-back">
        <ArrowLeft size={17} /> Back to Sign In
      </Link>

      <section className="auth-card">
        <Link href="/" className="auth-logo">
          fashion<span>IQ</span>
          <Sparkles size={14} />
        </Link>

        <span className="eyebrow">SECURITY RECOVERY</span>
        <h1>Create new password</h1>
        <p className="auth-description">
          Please enter and confirm your new account password below.
        </p>

        {/* 1. Loading / Verifying Token State */}
        {verifying && (
          <div className="py-12 text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-[#c65b3b]" />
            <p className="mt-4 text-xs font-medium text-gray-500">
              Verifying your secure reset link...
            </p>
          </div>
        )}

        {/* 2. Expired, Used or Invalid Token State */}
        {!verifying && tokenError && (
          <div className="space-y-6">
            <div
              className={`rounded-2xl border p-5 text-left ${
                tokenError.reason === "expired"
                  ? "border-amber-200 bg-amber-50"
                  : tokenError.reason === "used"
                  ? "border-blue-200 bg-blue-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {tokenError.reason === "expired" ? (
                  <Clock size={20} className="mt-0.5 shrink-0 text-amber-600" />
                ) : tokenError.reason === "used" ? (
                  <ShieldAlert size={20} className="mt-0.5 shrink-0 text-blue-600" />
                ) : (
                  <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-600" />
                )}
                <div className="space-y-1">
                  <h2
                    className={`text-sm font-semibold ${
                      tokenError.reason === "expired"
                        ? "text-amber-900"
                        : tokenError.reason === "used"
                        ? "text-blue-900"
                        : "text-red-900"
                    }`}
                  >
                    {tokenError.reason === "expired"
                      ? "Reset link has expired"
                      : tokenError.reason === "used"
                      ? "Reset link already used"
                      : "Invalid reset link"}
                  </h2>
                  <p
                    className={`text-xs leading-relaxed ${
                      tokenError.reason === "expired"
                        ? "text-amber-800"
                        : tokenError.reason === "used"
                        ? "text-blue-800"
                        : "text-red-800"
                    }`}
                  >
                    {tokenError.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                href="/forgot-password"
                className="button button-dark block w-full text-center"
              >
                Request New Reset Link
              </Link>
              <Link
                href="/login"
                className="block text-center text-xs text-gray-500 hover:text-black py-2"
              >
                Return to Sign In
              </Link>
            </div>
          </div>
        )}

        {/* 3. Password Successfully Reset State */}
        {!verifying && resetSuccess && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-emerald-900">
                    Password reset complete
                  </h2>
                  <p className="text-xs leading-relaxed text-emerald-800">
                    Your password has been securely updated. All previous sessions have been invalidated.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="button button-dark block w-full text-center"
              >
                Sign in with New Password
              </Link>
            </div>
          </div>
        )}

        {/* 4. Valid Token: Active Reset Form */}
        {!verifying && tokenValid && !resetSuccess && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="password-label">
              <label htmlFor="new-password">New password</label>
              <span className="text-xs text-gray-500">Min. 8 characters</span>
            </div>

            <div className="password-input">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={submitting}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={submitting}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="password-label mt-2">
              <label htmlFor="confirm-password">Confirm new password</label>
            </div>

            <div className="password-input">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={submitting}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                disabled={submitting}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {formError && <p className="auth-message error">{formError}</p>}

            <button
              type="submit"
              className="button button-dark auth-submit mt-4"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Saving Password...
                </span>
              ) : (
                "Save New Password"
              )}
            </button>
          </form>
        )}

        <p className="auth-terms mt-8">
          Need assistance? Feel free to contact our customer support team.
        </p>
      </section>
    </main>
  );
}
