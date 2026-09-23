import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, LockKeyhole, Loader2, LogOut } from "lucide-react";
import { api, post } from "../lib/api";

type AuthState = {
  required: boolean;
  authenticated: boolean;
  hosted: boolean;
  multiuser: boolean;
  signup_open: boolean;
  google_configured: boolean;
};
export function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState | null>(null),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    api<AuthState>("/auth/status")
      .then(setState)
      .catch(() =>
        setError(
          "Your ship is offline. Start the Intellora server, then try again.",
        ),
      );
  useEffect(() => {
    void refresh();
    const params = new URLSearchParams(location.search);
    if (params.get("auth_error"))
      setError("Google sign-in could not be completed. Please try again.");
    const expired = () =>
      setState((s) =>
        s ? { ...s, required: true, authenticated: false } : null,
      );
    window.addEventListener("intellora-session-expired", expired);
    return () =>
      window.removeEventListener("intellora-session-expired", expired);
  }, []);
  if (!state || (state.required && !state.authenticated))
    return (
      <div className="access-page">
        <div className="access-art" />
        <div className="access-card">
          <img
            src="/assets/intellora-logo.png"
            alt="Intellora compass and straw-hat mark"
            width="96"
            height="96"
          />
          <span className="eyebrow">YOUR PERSONAL LEARNING VOYAGE</span>
          <h1>
            A world of knowledge.
            <br />
            Your own little ship.
          </h1>
          <p>
            Welcome aboard, Captain.
            <br />
            {state?.google_configured
              ? "Sign in with Google to open your private workspace."
              : "Enter your credentials to return to your workspace."}
          </p>
          {state?.google_configured && (
            <a className="google-login" href="/api/auth/google">
              <span>G</span> Continue with Google
            </a>
          )}
          {state?.google_configured && (
            <div className="auth-divider">
              <span>or use a password</span>
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await post("/auth/login", { username, password });
                setPassword("");
                await refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Sign-in failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {state?.multiuser && (
              <label className="field-label">
                Username
                <input
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
            )}
            <label className="field-label">
              Password
              <input
                type="password"
                required
                minLength={1}
                maxLength={1024}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            {state ? (
              <button className="button primary full-width" disabled={busy}>
                {busy ? (
                  <Loader2 size={17} className="spin" />
                ) : (
                  <LockKeyhole size={17} />
                )}{" "}
                Step aboard <ArrowRight size={17} />
              </button>
            ) : (
              <button
                type="button"
                className="button outline full-width"
                onClick={() => void refresh()}
              >
                {error ? "Reconnect" : "Connecting…"}
              </button>
            )}
          </form>
          <small>
            Your documents. Your discoveries. Your private workspace.
          </small>
        </div>
      </div>
    );
  return (
    <>
      {children}
      {state.required && (
        <button
          className="logout-button"
          onClick={async () => {
            await post("/auth/logout");
            setState({ ...state, authenticated: false });
          }}
          title="Lock your workspace"
        >
          <LogOut size={15} /> Lock workspace
        </button>
      )}
    </>
  );
}
