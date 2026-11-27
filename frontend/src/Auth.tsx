import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { api, post } from "./api";
import { workspaceDestination } from "./navigation";
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
  const destination = workspaceDestination(params.get("next"));
  const session = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/auth/me"),
    retry: false,
  });
  if (session.data) return <Navigate to={destination} replace />;
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
      navigate(destination, { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="access-page">
      <Link to="/" className="access-home" aria-label="KnowSphere home">
        <Logo />
      </Link>
      <section className="access-card">
        <h1>{registering ? "Create your account" : "Welcome back"}</h1>
        <p>
          {registering
            ? "Your documents, search, and AI answers in one place."
            : "Sign in to continue to your workspace."}
        </p>
        <div className="access-switch">
          <button
            className={!registering ? "active" : ""}
            disabled={busy}
            aria-pressed={!registering}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("mode");
              setParams(next);
              setError(null);
              setVisible(false);
            }}
          >
            Sign in
          </button>
          <button
            className={registering ? "active" : ""}
            disabled={busy}
            aria-pressed={registering}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("mode", "register");
              setParams(next);
              setError(null);
              setVisible(false);
            }}
          >
            Create account
          </button>
        </div>
        {params.has("expired") && (
          <p className="notice" role="status">
            Your session expired. Sign in to resume your research.
          </p>
        )}
        <form
          key={registering ? "register" : "login"}
          onSubmit={submit}
          className="form-stack"
          aria-busy={busy}
        >
          <fieldset disabled={busy} className="access-fields">
            {registering && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="Your name"
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
                  autoComplete={
                    registering ? "new-password" : "current-password"
                  }
                  placeholder={
                    registering
                      ? "At least 12 characters"
                      : "Enter your password"
                  }
                  minLength={12}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {registering && (
              <p className="small-print">
                Use 12–128 characters. A unique passphrase keeps your sources
                protected.
              </p>
            )}
          </fieldset>
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
              <>{registering ? "Create account" : "Sign in"}</>
            )}
          </button>
        </form>
        <div className="access-security">
          <LockKeyhole size={14} />
          <span>
            Your sources stay private to your account.
            <br />
            AI processing sends relevant text to OpenRouter.
          </span>
        </div>
      </section>
    </main>
  );
}
