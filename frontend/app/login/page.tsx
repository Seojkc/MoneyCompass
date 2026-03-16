'use client';

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type AuthResponse = {
  id: string;
  email: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at top, rgba(99,102,241,0.22), transparent 28%), linear-gradient(135deg, #0f172a 0%, #111827 48%, #1e293b 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          borderRadius: "24px",
          padding: "32px",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <h1
            style={{
              color: "white",
              fontSize: "34px",
              fontWeight: 800,
              margin: 0,
            }}
          >
            MoneyCompass
          </h1>

          <p
            style={{
              marginTop: "10px",
              marginBottom: 0,
              color: "rgba(255,255,255,0.75)",
              lineHeight: 1.5,
            }}
          >
            {isLogin
              ? "Log in to continue to your financial dashboard."
              : "Create your account and start tracking your money."}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            marginBottom: "22px",
            background: "rgba(255,255,255,0.05)",
            padding: "6px",
            borderRadius: "14px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setInfo("");
            }}
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              color: isLogin ? "#0f172a" : "white",
              background: isLogin
                ? "linear-gradient(90deg, #7dd3fc, #a78bfa)"
                : "transparent",
            }}
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
            style={{
              padding: "12px 14px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              color: !isLogin ? "#0f172a" : "white",
              background: !isLogin
                ? "linear-gradient(90deg, #34d399, #7dd3fc)"
                : "transparent",
            }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: "8px",
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "8px",
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={200}
              style={inputStyle}
            />
          </div>

          {!isLogin && (
            <div>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                maxLength={200}
                style={inputStyle}
              />
            </div>
          )}

          {info ? (
            <div
              style={{
                color: "#bfdbfe",
                background: "rgba(30, 64, 175, 0.22)",
                border: "1px solid rgba(147,197,253,0.35)",
                padding: "12px 14px",
                borderRadius: "12px",
                fontSize: "14px",
              }}
            >
              {info}
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                color: "#fecaca",
                background: "rgba(127, 29, 29, 0.24)",
                border: "1px solid rgba(252,165,165,0.35)",
                padding: "12px 14px",
                borderRadius: "12px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "4px",
              padding: "14px 16px",
              borderRadius: "12px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 800,
              fontSize: "15px",
              color: "#0f172a",
              background: isLogin
                ? "linear-gradient(90deg, #7dd3fc, #a78bfa, #34d399)"
                : "linear-gradient(90deg, #34d399, #7dd3fc, #a78bfa)",
              opacity: loading ? 0.75 : 1,
            }}
          >
            {loading
              ? isLogin
                ? "Logging in..."
                : "Creating account..."
              : isLogin
                ? "Login"
                : "Create account"}
          </button>
        </form>

        <p
          style={{
            marginTop: "18px",
            fontSize: "13px",
            color: "rgba(255,255,255,0.6)",
            lineHeight: 1.5,
          }}
        >
          {isLogin
            ? "Don't have an account? Switch to Sign up."
            : "Already have an account? Switch to Login."}
        </p>
      </div>
    </main>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  outline: "none",
};