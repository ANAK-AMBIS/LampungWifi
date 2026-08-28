"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import { useAuth } from "../lib/useAuth";


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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const [prevPath, setPrevPath] = useState(pathname);
  const [prevParams, setPrevParams] = useState(searchParams.toString());

  if (pathname !== prevPath || searchParams.toString() !== prevParams) {
    setPrevPath(pathname);
    setPrevParams(searchParams.toString());
    setQuery(pathname === "/places" ? (searchParams.get("q") || "") : "");
    setIsOpen(false);
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }
    router.push(`/places?${params.toString()}`);
    setIsOpen(false);
  }

  return (
    <div className="topbar-search" ref={containerRef}>
      <button
        type="button"
        className={`topbar-search__toggle ${isOpen ? "topbar-search__toggle--active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Cari tempat"
        aria-expanded={isOpen}
      >
        <span className="topbar-search__toggle-icon topbar-search__toggle-icon--search">
          <i className="hgi-stroke hgi-search-01" style={{ fontSize: 18 }} aria-hidden="true"></i>
        </span>
        <span className="topbar-search__toggle-icon topbar-search__toggle-icon--cancel">
          <i className="hgi-stroke hgi-cancel-01" style={{ fontSize: 18 }} aria-hidden="true"></i>
        </span>
      </button>
      <form
        className={`topbar-search__form ${isOpen ? "topbar-search__form--open" : ""}`}
        onSubmit={handleSearchSubmit}
      >
        <input
          type="text"
          placeholder="Cari tempat..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
    </div>
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
