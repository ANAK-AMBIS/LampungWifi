"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);

let nextId = 0;

const DURATION = {
  success: 4500,
  error: 6500,
  info: 4000,
};

const ICONS = {
  success: "✓",
  error: "!",
  info: "i",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  // Mulai animasi keluar, lalu hapus setelah transisi selesai.
  const dismiss = useCallback((id) => {
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast))
    );
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.set(
      id,
      setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
        timersRef.current.delete(id);
      }, 220)
    );
  }, []);

  const push = useCallback(
    (type, message) => {
      const id = ++nextId;
      setToasts((current) => [...current, { id, type, message, leaving: false }]);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION[type] ?? 4500)
      );
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    },
    []
  );

  const api = useMemo(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.type}${toast.leaving ? " toast--leaving" : ""}`}
            role={toast.type === "error" ? "alert" : "status"}
          >
            <span className="toast__icon" aria-hidden="true">
              {ICONS[toast.type]}
            </span>
            <p className="toast__message">{toast.message}</p>
            <button
              type="button"
              className="toast__close"
              onClick={() => dismiss(toast.id)}
              aria-label="Tutup notifikasi"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast harus dipakai di dalam <ToastProvider>");
  }
  return context;
}
