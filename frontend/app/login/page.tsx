'use client';

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type AuthResponse = {
  id: string;
  email: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://192.168.50.48:8000";

const STORAGE_KEY = "moneycompass_user";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const isLogin = useMemo(() => mode === "login", [mode]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const saveAndGo = (user: AuthResponse) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    router.push("/");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setInfo("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail || !cleanPassword) {
      setError("Please enter email and password.");
      return;
    }

    if (!isLogin && cleanPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const loginRes = await fetch(`${API_BASE}/users/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
            password: cleanPassword,
          }),
        });

        const loginData = await loginRes.json().catch(() => ({}));

        if (loginRes.ok) {
          saveAndGo(loginData as AuthResponse);
          return;
        }

        const detail =
          typeof loginData?.detail === "string"
            ? loginData.detail
            : "Login failed";

        if (
          detail.toLowerCase().includes("not found") ||
          detail.toLowerCase().includes("does not exist") ||
          detail.toLowerCase().includes("user does not exist")
        ) {
          setInfo("No account found with that email. You can create one below.");
          setMode("signup");
          return;
        }

        setError(detail);
        return;
      }

      const signupRes = await fetch(`${API_BASE}/users/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      const signupData = await signupRes.json().catch(() => ({}));

      if (!signupRes.ok) {
        throw new Error(signupData?.detail || "Signup failed");
      }

      saveAndGo(signupData as AuthResponse);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="ambient ambient-1" />
      <div className="ambient ambient-2" />
      <div className="ambient ambient-3" />
      

      <section className="shell">
        <div className="left-panel">
          <div className="left-panel-inner">
            <div className="hero-copy">
              <p className="hero-kicker">Money Compass</p>
              <h1 className="hero-title">Navigate your wealth</h1>
            </div>
          </div>
        </div>

        <div className="right-panel">
          <div className="form-card">
            <div className="form-top">
              <div>
                <p className="form-eyebrow">
                  {isLogin ? "Welcome back" : "Get started"}
                </p>
                <h2 className="form-title">
                  {isLogin ? "User Login" : "Create Account"}
                </h2>
              </div>
            </div>

            <div className="mode-switch">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setInfo("");
                }}
                className={`switch-btn ${isLogin ? "active login-active" : ""}`}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setInfo("");
                }}
                className={`switch-btn ${!isLogin ? "active signup-active" : ""}`}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                />
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="Enter your password"
                />
              </div>

              {!isLogin && (
                <div className="field">
                  <label htmlFor="confirmPassword">Confirm password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    maxLength={200}
                    placeholder="Confirm your password"
                  />
                </div>
              )}

              {info ? <div className="message info">{info}</div> : null}
              {error ? <div className="message error">{error}</div> : null}

              <button type="submit" disabled={loading} className="submit-btn">
                <span className="submit-btn-gloss" />
                <span className="submit-btn-text">
                  {loading
                    ? isLogin
                      ? "Logging in..."
                      : "Creating account..."
                    : isLogin
                    ? "Login"
                    : "Create account"}
                </span>
              </button>
            </form>

            <p className="switch-note">
              {isLogin
                ? "Don't have an account? Switch to Sign up."
                : "Already have an account? Switch to Login."}
            </p>
          </div>
        </div>
      </section>

      <footer className="footer-note">
        Devloped by SeoVision
      </footer>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 24px;
          background:
            radial-gradient(circle at 12% 20%, rgba(111, 66, 193, 0.22), transparent 28%),
            radial-gradient(circle at 88% 18%, rgba(14, 165, 233, 0.18), transparent 26%),
            radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.06), transparent 34%),
            linear-gradient(135deg, #05070d 0%, #0b1020 45%, #040507 100%);
        }

        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(70px);
          opacity: 0.55;
          pointer-events: none;
        }

        .ambient-1 {
          width: 280px;
          height: 280px;
          top: 7%;
          left: -4%;
          background: rgba(91, 33, 182, 0.35);
        }

        .ambient-2 {
          width: 300px;
          height: 300px;
          right: -6%;
          top: 20%;
          background: rgba(14, 165, 233, 0.22);
        }

        .ambient-3 {
          width: 360px;
          height: 360px;
          bottom: -10%;
          left: 25%;
          background: rgba(255, 255, 255, 0.08);
        }

        .shell {
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
          position: relative;
          display: grid;
          grid-template-columns: 1.06fr 0.94fr;
          overflow: visible;
          backdrop-filter: blur(26px);
          -webkit-backdrop-filter: blur(26px);
        }

        .left-panel,
        .right-panel {
          position: relative;
          min-height: 760px;
        }

        .left-panel {
          padding: 46px 42px 42px 42px;
        }

        .left-panel-inner {
          height: 100%;
          padding-bottom: 70px;
          display: flex;
          flex-direction: column-reverse;
          justify-content: space-between;
          gap: 28px;
        }

        .hero-copy {
          max-width: 520px;
        }

        .hero-kicker {
          margin: 0 0 10px 0;
          color: rgba(133, 210, 255, 0.92);
          font-size: 20px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 700;
        }

        .hero-title {
          margin: 0;
          color: white;
          font-size: clamp(34px, 5vw, 58px);
          line-height: 1.02;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .right-panel {
          padding: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .form-card {
          width: 100%;
          max-width: 470px;
          position: relative;
          z-index: 1;
          border-radius: 30px;
          padding: 34px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.05));
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow:
            0 26px 60px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
        }

        .form-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 22px;
        }

        .form-eyebrow {
          margin: 0 0 8px 0;
          color: rgba(138, 221, 255, 0.9);
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 700;
        }

        .form-title {
          margin: 0;
          color: white;
          font-size: 34px;
          line-height: 1.05;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .mode-switch {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 24px;
          padding: 7px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .switch-btn {
          min-height: 50px;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.78);
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.02em;
          background: transparent;
          transition: all 0.25s ease;
        }

        .switch-btn.active {
          color: #0a1020;
          box-shadow:
            0 10px 24px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
        }

        .login-active {
          background: linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%);
        }

        .signup-active {
          background: linear-gradient(135deg, #d1fae5 0%, #7dd3fc 100%);
        }

        .login-form {
          display: grid;
          gap: 16px;
        }

        .field {
          display: grid;
          gap: 8px;
        }

        .field label {
          color: rgba(255, 255, 255, 0.86);
          font-size: 14px;
          font-weight: 700;
        }

        .field input {
          width: 100%;
          height: 56px;
          padding: 0 18px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.07);
          color: white;
          outline: none;
          font-size: 15px;
          transition: all 0.25s ease;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 8px 18px rgba(0, 0, 0, 0.16);
        }

        .field input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .field input:focus {
          border-color: rgba(125, 211, 252, 0.45);
          background: rgba(255, 255, 255, 0.09);
          box-shadow:
            0 0 0 4px rgba(56, 189, 248, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 10px 25px rgba(0, 0, 0, 0.18);
        }

        .message {
          padding: 13px 15px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          backdrop-filter: blur(12px);
        }

        .message.info {
          color: #dbeafe;
          background: rgba(30, 64, 175, 0.2);
          border: 1px solid rgba(147, 197, 253, 0.3);
        }

        .message.error {
          color: #fecaca;
          background: rgba(127, 29, 29, 0.22);
          border: 1px solid rgba(252, 165, 165, 0.3);
        }

        .submit-btn {
          position: relative;
          overflow: hidden;
          margin-top: 6px;
          min-height: 60px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 18px;
          cursor: ${loading ? "not-allowed" : "pointer"};
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05));
          color: white;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          box-shadow:
            0 16px 30px rgba(0, 0, 0, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.24),
            inset 0 -10px 18px rgba(0, 0, 0, 0.18);
          transition: transform 0.22s ease, box-shadow 0.22s ease, opacity 0.22s ease;
          opacity: ${loading ? 0.65 : 1};
          backdrop-filter: blur(16px);
        }

        .submit-btn:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow:
            0 20px 36px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.28),
            inset 0 -10px 18px rgba(0, 0, 0, 0.2);
        }

        .submit-btn:active {
          transform: translateY(0) scale(0.99);
        }

        .submit-btn-gloss {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(255, 255, 255, 0.12) 18%,
            transparent 36%
          );
          transform: translateX(-120%);
          transition: transform 0.55s ease;
        }

        .submit-btn:hover .submit-btn-gloss {
          transform: translateX(120%);
        }

        .submit-btn-text {
          position: relative;
          z-index: 1;
        }

        .switch-note {
          margin: 18px 0 0 0;
          text-align: center;
          color: rgba(255, 255, 255, 0.58);
          font-size: 13px;
          line-height: 1.6;
        }

        .footer-note {
          position: relative;
          z-index: 2;
          margin-top: 38px;
          padding-top:50px;
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        @media (max-width: 1100px) {
          .shell {
            grid-template-columns: 1fr;
            max-width: 760px;
          }

          .left-panel {
            min-height: auto;
          }

          .right-panel {
            min-height: auto;
          }
        }

        @media (max-width: 820px) {
          .login-page {
            justify-content: flex-start;
            padding: 16px;
            padding-top: 14px;
          }

          .shell {
            border-radius: 24px;
            overflow: hidden;
          }

          .left-panel {
            padding: 28px 22px 24px 22px;
          }

          .hero-title {
            padding-top: 12px;
            font-size: 52px;
          }

          .right-panel {
            padding: 18px;
          }

          .form-card {
            max-width: 100%;
            padding: 24px 18px;
            border-radius: 24px;
          }

          .form-title {
            font-size: 28px;
          }
        }

        @media (max-width: 560px) {
          

          .shell {
            max-width: 100%;
            grid-template-columns: 1fr;
            background: transparent;
            border: none;
            box-shadow: none;
            backdrop-filter: none;
          }

          .right-panel {
            padding: 0;
          }

          .form-card {
            padding: 24px 16px;
            border-radius: 22px;
          }

          .form-title {
            font-size: 26px;
          }

          .mode-switch {
            gap: 8px;
            padding: 6px;
          }

          .switch-btn {
            min-height: 46px;
            font-size: 14px;
          }

          .field input {
            height: 52px;
            border-radius: 14px;
          }

          .submit-btn {
            min-height: 56px;
            font-size: 18px;
            border-radius: 16px;
          }

          .footer-note {
            margin-top: 14px;
            font-size: 11px;
          }
        }
      `}</style>
    </main>
  );
}