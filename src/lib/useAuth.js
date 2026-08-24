"use client";

import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  const signIn = useCallback(() => {
    window.location.href = "/api/auth/google";
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return { user, signIn, signOut, configured: true };
}
