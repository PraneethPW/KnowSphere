import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  LockKeyhole,
} from "lucide-react";
import { motion } from "framer-motion";
import { post } from "./api";
import type { User } from "./types";
import { ErrorBox, Logo, Spinner } from "./components/UI";

export default function Auth() {
  const [params, setParams] = useSearchParams();
  const registering = params.get("mode") === "register";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [visible, setVisible] = useState(false);
  const client = useQueryClient(),
    navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const user = await post<User>(
        `/auth/${registering ? "register" : "login"}`,
        Object.fromEntries(form),
      );
      client.clear();
      client.setQueryData(["me"], user);
      navigate("/app", { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <Link to="/" className="auth-back">
        <ArrowLeft size={16} /> Back to KnowSphere
      </Link>
      <div className="auth-art" aria-hidden="true">
        <div className="auth-rings">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="auth-art-copy">
          <div className="eyebrow">ONE IDEA LEADS TO ANOTHER.</div>
          <h2>
            Make room for
            <br />
            your next
            <br />
            <em>discovery.</em>
          </h2>
        </div>
      </div>
      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Logo />
        <div className="eyebrow">YOUR CONNECTED KNOWLEDGE SPACE</div>
        <h1>
          {registering ? "A new perspective starts here." : "Welcome back."}
        </h1>
        <p>
          {registering
            ? "Create an account and bring your first source."
            : "Your ideas are waiting to be connected."}
        </p>
        <div className="auth-switch">
          <button
            className={!registering ? "active" : ""}
            onClick={() => {
              setParams({});
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            className={registering ? "active" : ""}
            onClick={() => {
              setParams({ mode: "register" });
              setError(null);
            }}
          >
            Create account
          </button>
        </div>
        <form onSubmit={submit} className="form-stack">
          {registering && (
            <label>
              Your name
              <input
                name="name"
                autoComplete="name"
                placeholder="How should we call you?"
                required
                maxLength={80}
              />
            </label>
          )}
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <div className="password-input">
              <input
                name="password"
                type={visible ? "text" : "password"}
                autoComplete={registering ? "new-password" : "current-password"}
                placeholder={
                  registering ? "At least 12 characters" : "Enter your password"
                }
                minLength={12}
                maxLength={128}
                required
              />
              <button
                type="button"
                className="icon-button"
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          {!!error && <ErrorBox error={error} />}
          <button
            type="submit"
            className="button button-primary"
            disabled={busy}
          >
            {busy ? (
              <Spinner
                label={registering ? "Creating your space" : "Signing in"}
              />
            ) : (
              <>
                {registering
                  ? "Create your knowledge space"
                  : "Enter your space"}
                <ArrowUpRight size={18} />
              </>
            )}
          </button>
        </form>
        <div className="auth-security">
          <LockKeyhole size={14} />
          <span>
            Your sources stay private to your account.
            <br />
            AI processing sends relevant text to OpenRouter.
          </span>
        </div>
      </motion.section>
    </main>
  );
}
