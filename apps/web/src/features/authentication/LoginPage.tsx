import { useState } from "react";
import type { ApiClient, AuthResponse } from "../../api/client";
import { Button } from "../../shared/ui/Button";
import { TextField } from "../../shared/ui/Field";

export function LoginPage({ api, onAuth }: { api: ApiClient; onAuth: (auth: AuthResponse) => void }) {
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");

  async function submit(mode: "login" | "register") {
    setError("");
    try {
      onAuth(mode === "login" ? await api.login(username, password) : await api.register({ nickname, email: username, confirmEmail, password, confirmPassword }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    }
  }

  async function googleLocalLogin() {
    setError("");
    try {
      const start = await api.googleStart();
      if (start.authUrl.startsWith("http")) {
        window.location.href = start.authUrl;
        return;
      }
      onAuth(await api.googleCallback(start.state, username));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google login failed");
    }
  }

  return (
    <main className="login-shell">
      <section className="login-copy">
        <p className="product-label">CurriculumOptimizer</p>
        <h1>Build a truthful, job-specific CV without losing the source resume.</h1>
        <p>Keep `resume.md` as the source of truth, compare every suggestion against evidence, and export a clean final document.</p>
      </section>
      <section className="login-panel" aria-label="Authentication">
         <h2>{isRegistering ? "Create your account" : "Log in"}</h2>
         {isRegistering ? <TextField label="Nickname" name="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} autoComplete="nickname" /> : null}
         <TextField label="Email" name="email" type="email" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
         {isRegistering ? <TextField label="Confirm email" name="confirmEmail" type="email" value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} autoComplete="email" /> : null}
         <TextField label="Password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegistering ? "new-password" : "current-password"} />
         {isRegistering ? <TextField label="Confirm password" name="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /> : null}
         {isRegistering ? <p className="field-help">Use at least 12 characters. A memorable passphrase is recommended.</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="button-row">
          <Button variant="primary" onClick={() => submit(isRegistering ? "register" : "login")}>{isRegistering ? "Create account" : "Log in"}</Button>
          <Button onClick={() => {
            if (isRegistering) {
              setIsRegistering(false);
              setError("");
            } else {
              setIsRegistering(true);
               setConfirmEmail("");
               setConfirmPassword("");
              setError("");
            }
          }}>{isRegistering ? "Back to login" : "Register"}</Button>
        </div>
        <Button variant="quiet" onClick={googleLocalLogin}>Login with Google OAuth</Button>
      </section>
    </main>
  );
}
