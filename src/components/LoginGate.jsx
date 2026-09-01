"use client";

import { useAuth } from "../lib/useAuth";

export function LoginGate({ message = "Login diperlukan untuk aksi ini." }) {
  const { signIn } = useAuth();
  return (
    <div style={{ padding: 16, background: "#fef9c3", border: "1px solid #fef08a", borderRadius: 8, margin: 12 }}>
      <p style={{ margin: "0 0 8px", color: "#854d0e" }}>{message}</p>
      <button type="button" className="button button--primary button--small" onClick={signIn}>
        Login Google
      </button>
    </div>
  );
}