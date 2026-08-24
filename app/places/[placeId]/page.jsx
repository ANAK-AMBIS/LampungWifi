import { PlaceDetailPage } from "../../../src/views/PlaceDetailPage.jsx";
import { placeState } from "../../../src/lib/serverApi.js";

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const { placeId } = await params;
  const result = await placeState(placeId);
  const place = result.place;

  if (!place) {
    return { title: "Tidak Ditemukan — BalamWiFi" };
  }

  return {
    title: `${place.name} — BalamWiFi`,
    description:
      place.map_context ||
      `${place.category} di ${place.district}, Bandar Lampung. ${place.wifi_speed_mbps ? `Kecepatan ${place.wifi_speed_mbps} Mbps.` : ""} ${place.review_count ? `${place.review_count} ulasan komunitas.` : ""}`,
    openGraph: {
      title: `${place.name} — BalamWiFi`,
      description:
        place.map_context ||
        `${place.category} di ${place.district}, Bandar Lampung.`,
      type: "article",
    },
  };
}

export default async function Page({ params }) {
  const { placeId } = await params;
  const initialState = await placeState(placeId);
  // if SSR failed but place may still be fetchable client-side, still render page
  return (
    <PlaceDetailPage
      key={placeId}
      placeId={placeId}
      initialState={initialState}
    />
  );
}
