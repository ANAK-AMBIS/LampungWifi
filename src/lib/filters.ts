import type { FiltersForm, PlaceFilters } from '../types'

type SearchParamsLike = URLSearchParams | Record<string, string | string[]>

function readParam(searchParams: SearchParamsLike | null | undefined, key: string): string | null {
  if (!searchParams) {
    return null;
  }

  if (typeof (searchParams as URLSearchParams).get === "function") {
    return (searchParams as URLSearchParams).get(key);
  }

  const record = searchParams as Record<string, string | string[]>
  const value = record[key];
  return Array.isArray(value) ? value[0] : value ?? null;
}

export function readFilters(searchParams: SearchParamsLike | null | undefined): FiltersForm {
  return {
    q: readParam(searchParams, "q") || "",
    category: readParam(searchParams, "category") || "all",
    accessType: readParam(searchParams, "accessType") || "all",
    speed: readParam(searchParams, "speed") || "all",
    outlets: readParam(searchParams, "outlets") === "true",
    open24: readParam(searchParams, "open24") === "true",
    wifi: readParam(searchParams, "wifi") !== "false",
    offset: parseInt(readParam(searchParams, "offset") ?? "0", 10) || 0,
  };
}

export function filtersToQuery(filters: FiltersForm): PlaceFilters {
  return {
    q: filters.q || undefined,
    category: filters.category !== "all" ? filters.category : undefined,
    accessType: filters.accessType !== "all" ? filters.accessType : undefined,
    speed: filters.speed !== "all" ? filters.speed : undefined,
    outlets: filters.outlets || undefined,
    open24: filters.open24 || undefined,
    wifi: filters.wifi ? undefined : "false",
    offset: filters.offset > 0 ? filters.offset : undefined,
  };
}

export function searchParamsKey(searchParams: SearchParamsLike | null | undefined): string {
  const params = new URLSearchParams();

  if (!searchParams) {
    return "";
  }

  if (typeof (searchParams as URLSearchParams).forEach === "function") {
    (searchParams as URLSearchParams).forEach((value, key) => params.append(key, value));
    return params.toString();
  }

  const record = searchParams as Record<string, string | string[]>

  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value !== undefined && value !== null) {
      params.set(key, value);
    }
  }

  return params.toString();
}
