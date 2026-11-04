"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { forgotPasswordApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(false);
    setDevResetUrl(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }

    try {
      setLoading(true);
      const res = await forgotPasswordApi(trimmedEmail.toLowerCase());

      if (res.success) {
        setSuccess(true);
        setSuccessMessage(
          res.message ||
            "If an account with that email exists, we have sent instructions to reset your password."
        );
        if (res.dev_reset_url) {
          setDevResetUrl(res.dev_reset_url);
        }
      } else {
        setError(res.message || "Failed to process request. Please try again.");
      }
    } catch (err: any) {
      console.error("Forgot password error:", err);
      setError(
        err.message || "An unexpected error occurred. Please try again later."
      );
    } finally {
      setLoading(false);
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

        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h1>Reset password</h1>
        <p className="auth-description">
          Enter your email address and we will send you a secure link to reset your account password.
        </p>

        {success ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-emerald-900">
                    Check your email
                  </h2>
                  <p className="text-xs leading-relaxed text-emerald-800">
                    {successMessage}
                  </p>
                  <p className="text-[11px] text-emerald-700 pt-1">
                    Reset links are valid for <strong>15 minutes</strong> and can only be used once.
                  </p>
                </div>
              </div>
            </div>

            {devResetUrl && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <p className="font-semibold flex items-center gap-1.5 text-amber-950 mb-1">
                  <AlertCircle size={14} /> Development Testing Helper
                </p>
                <p className="text-amber-800 text-[11px] mb-2">
                  SMTP is not configured in local development. Click the link below to test resetting your password:
                </p>
                <a
                  href={devResetUrl}
                  className="font-medium underline break-all text-[#c65b3b] hover:text-black"
                >
                  {devResetUrl}
                </a>
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/login"
                className="button button-dark block w-full text-center"
              >
                Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="recovery-email">Email address</label>
            <input
              id="recovery-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
              required
            />

            {error && <p className="auth-message error">{error}</p>}

            <button
              type="submit"
              className="button button-dark auth-submit mt-2"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Sending Link...
                </span>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>
        )}

        <p className="auth-switch">
          Remember your password?{" "}
          <Link href="/login">
            Sign in
          </Link>
        </p>

        <p className="auth-terms">
          Need help? Contact our customer support team for assistance.
        </p>
      </section>
    </main>
  );
}
