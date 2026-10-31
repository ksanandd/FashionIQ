"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    setSuccess("Login form validated! Backend authentication is coming soon.");
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
          />

          <div className="password-label">
            <label htmlFor="password">Password</label>
            <a href="#" onClick={(event) => event.preventDefault()}>
              Forgot password?
            </a>
          </div>

          <div className="password-input">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <p className="auth-message error">{error}</p>}
          {success && <p className="auth-message success">{success}</p>}

          <button type="submit" className="button button-dark auth-submit">
            Sign in
          </button>
        </form>

        <p className="auth-switch">
          New to FashionIQ? <Link href="/register">Create an account</Link>
        </p>

        <p className="auth-terms">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </section>
    </main>
  );
}
