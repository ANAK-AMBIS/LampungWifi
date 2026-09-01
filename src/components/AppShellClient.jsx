"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "../lib/useAuth";
import { UserBadge } from "./UserBadge";

const whatsNewStorageKey = "balamwifi_seen_whats_new";
const whatsNewChangedEvent = "balamwifi_whats_new_changed";

export function ScrollOnRouteChange() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
}

export function TopbarLogin() {
  const { user, signIn } = useAuth();

  return (
    <div className="topbar__login">
      {user ? (
        <Link href="/dashboard" className="login-button" title={user.email}>
          {user.picture ? <img src={user.picture} alt="" /> : null}
          <span>{user.name}</span>
          <UserBadge role={user.role} isTrusted={user.isTrusted} />
        </Link>
      ) : (
        <button
          type="button"
          className="button button--primary button--small"
          onClick={signIn}
        >
          Login
        </button>
      )}
    </div>
  );
}

export function TopbarSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (pathname === "/places") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(searchParams.get("q") || "");
    } else {
      setQuery("");
    }
  }, [pathname, searchParams]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }
    router.push(`/places?${params.toString()}`);
  }

  return (
    <form className="topbar-search" onSubmit={handleSearchSubmit}>
      <input
        type="text"
        placeholder="Cari tempat..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </form>
  );
}

export function WhatsNewModal({ version }) {
  const seenWhatsNewVersion = useSyncExternalStore(
    subscribeWhatsNew,
    readSeenWhatsNewVersion,
    () => version,
  );
  const showWhatsNew = seenWhatsNewVersion !== version;

  function closeWhatsNew() {
    window.localStorage.setItem(whatsNewStorageKey, version);
    window.dispatchEvent(new Event(whatsNewChangedEvent));
  }

  if (!showWhatsNew) {
    return null;
  }

  return (
    <div
      className="whats-new-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      <div className="whats-new-modal__card">
        <h2 id="whats-new-title">Update baru BalamWiFi.</h2>
        <p>
          Pencarian lebih ringkas, filter bisa dibuka saat dibutuhkan, login
          Google aktif untuk submit dan rating WiFi.
        </p>
        <div className="whats-new-modal__actions">
          <Link
            href="/whats-new"
            className="button button--primary"
            onClick={closeWhatsNew}
          >
            Lihat update
          </Link>
          <button
            type="button"
            className="button button--ghost"
            onClick={closeWhatsNew}
          >
            Nanti saja
          </button>
        </div>
      </div>
    </div>
  );
}

function subscribeWhatsNew(onStoreChange) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(whatsNewChangedEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(whatsNewChangedEvent, onStoreChange);
  };
}

function readSeenWhatsNewVersion() {
  return window.localStorage.getItem(whatsNewStorageKey) ?? "";
}
