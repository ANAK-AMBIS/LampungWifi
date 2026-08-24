import { PlacesPage } from "../../src/views/PlacesPage.jsx";
import { readFilters, filtersToQuery } from "../../src/lib/filters";
import { placesState } from "../../src/lib/serverApi.js";

export const metadata = {
  title: "Temukan WiFi Terbaik — BalamWiFi",
  description:
    "Filter tempat WiFi publik Bandar Lampung berdasarkan kecepatan, kategori, akses, colokan listrik, dan jam operasional 24 jam.",
  openGraph: {
    title: "Temukan WiFi Terbaik — BalamWiFi",
    description:
      "Jelajahi direktori WiFi publik Bandar Lampung dengan filter lengkap.",
    type: "website",
  },
};

export const revalidate = 60;

export default async function Page({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const filters = readFilters(resolvedSearchParams);
  const initialState = await placesState(filtersToQuery(filters));

  return <PlacesPage filters={filters} initialState={initialState} />;
}
