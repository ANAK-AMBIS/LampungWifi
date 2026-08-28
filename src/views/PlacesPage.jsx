"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getPlaces } from "../api";
import {
  accessTypeOptions,
  categoryOptions,
  localizeLabel,
} from "../lib/constants";
import { filtersToQuery } from "../lib/filters";
import { localizeSpeed } from "../lib/pageLabels";
import {
  EmptyState,
  InfoBanner,
  LoadingGrid,
  PlaceCard,
  StatusPill,
} from "../components/ui";
import { FilterSelect } from "../components/FilterSelect";

const emptyState = {
  loading: true,
  error: "",
  source: "",
  items: [],
  total: 0,
};

const defaultFilters = {
  q: "",
  category: "all",
  accessType: "all",
  speed: "all",
  outlets: false,
  open24: false,
  wifi: true,
  offset: 0,
};

function buildQueryString(filters) {
  const next = new URLSearchParams();
  if (filters.q) next.set("q", filters.q);
  if (filters.category !== "all") next.set("category", filters.category);
  if (filters.accessType !== "all") next.set("accessType", filters.accessType);
  if (filters.speed !== "all") next.set("speed", filters.speed);
  if (filters.outlets) next.set("outlets", "true");
  if (filters.open24) next.set("open24", "true");
  if (!filters.wifi) next.set("wifi", "false");
  if (filters.offset > 0) next.set("offset", String(filters.offset));
  return next.toString();
}

export function PlacesPage({
  filters: initialFilters = defaultFilters,
  initialState = emptyState,
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [state, setState] = useState(initialState);
  const [showFilters, setShowFilters] = useState(false);
  const [openSelect, setOpenSelect] = useState("");
  const [fetchId, setFetchId] = useState(0);
  const isFirstRender = useRef(true);

  const hasAdvancedFilters =
    filters.category !== "all" ||
    filters.accessType !== "all" ||
    filters.speed !== "all" ||
    filters.outlets ||
    filters.open24 ||
    !filters.wifi;

  const offset = filters.offset ?? 0;
  const pageSize = 12;
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(state.total / pageSize));
  const hasPrev = offset > 0;
  const hasNext = offset + pageSize < state.total;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL query params from server to client state
    setFilters(initialFilters);
  }, [initialFilters]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    let active = true;
    const controller = new AbortController();

    async function load() {
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const query = filtersToQuery(filters);
        const response = await getPlaces({
          ...query,
          limit: pageSize,
          offset: offset,
          signal: controller.signal,
        });
        if (!active) return;
        setState({
          loading: false,
          error: "",
          source: response.meta.source,
          items: response.data,
          total: response.meta.total ?? response.data.length,
        });
      } catch (error) {
        if (error.name === "AbortError") return;
        if (!active) return;
        setState({
          loading: false,
          error: error.message,
          source: "",
          items: [],
          total: 0,
        });
      }
    }

    load();
    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- offset is filters.offset; filters object intentionally triggers refetch
  }, [fetchId, filters]);

  function applyFilters(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextFilters = {
      ...filters,
      category: String(formData.get("category") ?? "all"),
      accessType: String(formData.get("accessType") ?? "all"),
      speed: String(formData.get("speed") ?? "all"),
      wifi: formData.get("wifi") === "on",
      outlets: formData.get("outlets") === "on",
      open24: formData.get("open24") === "on",
      offset: 0,
    };
    const qs = buildQueryString(nextFilters);
    router.replace(`/places${qs ? `?${qs}` : ""}`, { scroll: false });
    setFilters(nextFilters);
    setFetchId((id) => id + 1);
    setShowFilters(false);
  }

  function resetFilters() {
    router.replace("/places", { scroll: false });
    setFilters({ ...defaultFilters });
    setFetchId((id) => id + 1);
    setShowFilters(false);
  }

  function goToPage(direction) {
    const nextOffset =
      direction === "next" ? offset + pageSize : Math.max(0, offset - pageSize);
    const nextFilters = { ...filters, offset: nextOffset };
    const qs = buildQueryString(nextFilters);
    router.replace(`/places${qs ? `?${qs}` : ""}`, { scroll: true });
    setFilters(nextFilters);
    setFetchId((id) => id + 1);
  }

  function toggleSelect(name) {
    setOpenSelect((current) => (current === name ? "" : name));
  }

  return (
    <main className="page page--list">
      <section className="section section--list">
        <div className="section-header" style={{ marginBottom: "24px" }}>
          <div>
            <span className="eyebrow">Direktori WiFi</span>
            <h1>{filters.q ? `Pencarian: ${filters.q}` : "Temukan WiFi Terbaik"}</h1>
            <p>
              {filters.q
                ? `Menampilkan tempat WiFi publik di Bandar Lampung yang cocok dengan kata kunci "${filters.q}".`
                : "Jelajahi dan filter WiFi publik di Bandar Lampung berdasarkan kecepatan, colokan, dan operasional."}
            </p>
          </div>
        </div>

        {/* Results header */}
        <div className="places-header">
          <p className="results-count">
            {state.loading ? "Memuat..." : `${state.total} tempat cocok`}
          </p>
          <button
            type="button"
            className={`button button--ghost button--small places-filter-toggle${showFilters ? " places-filter-toggle--active" : ""}`}
            onClick={() => setShowFilters((c) => !c)}
          >
            {showFilters
              ? "Tutup filter"
              : hasAdvancedFilters
                ? "Filter aktif"
                : "Filter"}
          </button>
        </div>

        {/* Active filter pills */}
        <div className="active-filters">
          {filters.speed !== "all" ? (
            <StatusPill tone="info">{localizeSpeed(filters.speed)}</StatusPill>
          ) : null}
          {filters.outlets ? (
            <StatusPill tone="success">Colokan</StatusPill>
          ) : null}
          {filters.open24 ? <StatusPill tone="warning">24/7</StatusPill> : null}
          {filters.category !== "all" ? (
            <StatusPill tone="muted">
              {localizeLabel(filters.category)}
            </StatusPill>
          ) : null}
          {filters.accessType !== "all" ? (
            <StatusPill tone="muted">
              {localizeLabel(filters.accessType)}
            </StatusPill>
          ) : null}
        </div>

        {/* Two-column layout */}
        <div
          className={`places-layout${showFilters ? " places-layout--with-filters" : ""}`}
        >
          {/* Filter sidebar */}
          <aside
            className={`places-filters${showFilters ? " places-filters--open" : ""}`}
          >
            <div className="filter-panel">
              <div className="places-filters__header">
                <h2>Filter</h2>
                <button
                  type="button"
                  className="button button--ghost button--small places-filters__close"
                  onClick={() => setShowFilters(false)}
                >
                  ✕
                </button>
              </div>
              <form className="filter-form" onSubmit={applyFilters}>
                <FilterSelect
                  label="Kategori"
                  name="category"
                  defaultValue={filters.category}
                  open={openSelect === "category"}
                  onOpen={(next) =>
                    next ? toggleSelect("category") : setOpenSelect("")
                  }
                  options={[
                    { value: "all", label: "Semua kategori" },
                    ...categoryOptions.map((item) => ({
                      value: item,
                      label: localizeLabel(item),
                    })),
                  ]}
                />
                <FilterSelect
                  label="Jenis akses"
                  name="accessType"
                  defaultValue={filters.accessType}
                  open={openSelect === "accessType"}
                  onOpen={(next) =>
                    next ? toggleSelect("accessType") : setOpenSelect("")
                  }
                  options={[
                    { value: "all", label: "Semua akses" },
                    ...accessTypeOptions.map((item) => ({
                      value: item,
                      label: localizeLabel(item),
                    })),
                  ]}
                />
                <FilterSelect
                  label="Kecepatan"
                  name="speed"
                  defaultValue={filters.speed}
                  open={openSelect === "speed"}
                  onOpen={(next) =>
                    next ? toggleSelect("speed") : setOpenSelect("")
                  }
                  options={[
                    { value: "all", label: "Semua level" },
                    { value: "steady", label: "Stabil (20+ Mbps)" },
                    { value: "fast", label: "Cepat (50+ Mbps)" },
                    { value: "ultra", label: "Sangat cepat (100+ Mbps)" },
                  ]}
                />

                <label className="checkbox-field filter-field--check">
                  <input
                    type="checkbox"
                    name="wifi"
                    defaultChecked={filters.wifi}
                  />
                  <span>WiFi tersedia</span>
                </label>
                <label className="checkbox-field filter-field--check">
                  <input
                    type="checkbox"
                    name="outlets"
                    defaultChecked={filters.outlets}
                  />
                  <span>Colokan listrik</span>
                </label>
                <label className="checkbox-field filter-field--check">
                  <input
                    type="checkbox"
                    name="open24"
                    defaultChecked={filters.open24}
                  />
                  <span>Buka 24 jam</span>
                </label>

                <div className="filter-form__actions">
                  <button type="submit" className="button button--primary">
                    Terapkan
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={resetFilters}
                  >
                    Atur ulang
                  </button>
                </div>
              </form>
            </div>
          </aside>

          {/* Results */}
          <div className="places-results">
            {state.error ? (
              <InfoBanner tone="danger">{state.error}</InfoBanner>
            ) : null}
            {state.loading ? (
              <LoadingGrid />
            ) : state.items.length ? (
              <div className="place-grid">
                {state.items.map((place) => (
                  <PlaceCard key={place.id} place={place} showBadge={false} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Tidak ada tempat yang cocok."
                description="Longgarkan filter atau kirim tempat baru lewat formulir komunitas."
              />
            )}

            {totalPages > 1 ? (
              <nav className="pagination">
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => goToPage("prev")}
                  disabled={!hasPrev}
                >
                  Sebelumnya
                </button>
                <span className="pagination__info">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => goToPage("next")}
                  disabled={!hasNext}
                >
                  Selanjutnya
                </button>
              </nav>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
