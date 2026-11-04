"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Sparkles, Loader2 } from "lucide-react";
import { loginUserApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <div className="auth-card text-center">Loading sign in...</div>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const redirectUrl = searchParams.get("redirect") || "/";
  const justRegistered = searchParams.get("registered") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(
    justRegistered ? "Account created successfully! Please sign in." : ""
  );

  // If already logged in, redirect
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, redirectUrl, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      const res = await loginUserApi({
        email: email.trim().toLowerCase(),
        password,
      });

      if (!res.success || !res.token) {
        throw new Error(res.message || "Invalid credentials");
      }

      setSuccess("Welcome back! Signing you in...");
      await login(res.token, res.user);

      router.push(redirectUrl);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(
        err.message || "Invalid email or password. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <Link href="/" className="auth-back">
        <ArrowLeft size={17} /> Back to FashionIQ
      </Link>

      <section className="auth-card">
        <Link href="/" className="auth-logo">
          fashion<span>IQ</span>
          <Sparkles size={14} />
        </Link>

        <span className="eyebrow">WELCOME BACK</span>
        <h1>Good to see you.</h1>
        <p className="auth-description">
          Sign in to discover styles picked just for you.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            disabled={loading}
            required
          />

          <div className="password-label flex items-center justify-between">
            <label htmlFor="password">Password</label>
            <Link
              href="/forgot-password"
              className="text-xs text-[#c65b3b] hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <div className="password-input">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={loading}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={loading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <p className="auth-message error">{error}</p>}
          {success && <p className="auth-message success">{success}</p>}

          <button
            type="submit"
            className="button button-dark auth-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="auth-switch">
          New to FashionIQ?{" "}
          <Link
            href={
              redirectUrl !== "/"
                ? `/register?redirect=${encodeURIComponent(redirectUrl)}`
                : "/register"
            }
          >
            Create an account
          </Link>
        </p>

        <p className="auth-terms">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </section>
    </main>
  );
}
