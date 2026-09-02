import { PlaceDetailPage } from "../../../src/views/PlaceDetailPage.jsx";
import { placeState } from "../../../src/lib/serverApi.js";
import { JsonLd, placeJsonLd, breadcrumbJsonLd } from "../../../src/components/JsonLd.jsx";

export const revalidate = 60;

export async function generateMetadata({ params }) {
  const { placeId } = await params;
  const result = await placeState(placeId);
  const place = result.place;

  if (!place) {
    return { title: "Tidak Ditemukan — BalamWiFi" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://balamwifi.my.id";
  const canonical = `/places/${placeId}`;
  const title = `${place.name} — BalamWiFi`;
  const description =
    place.map_context ||
    `${place.category} di ${place.district}, Bandar Lampung. ${place.wifi_speed_mbps ? `Kecepatan ${place.wifi_speed_mbps} Mbps.` : ""} ${place.review_count ? `${place.review_count} ulasan komunitas.` : ""}`.trim();
  const ogImages = place.image_url
    ? [{ url: place.image_url, width: 1200, height: 630, alt: place.name }]
    : [{ url: `${baseUrl}/opengraph-image`, width: 1200, height: 630, alt: place.name }];

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description: place.map_context || `${place.category} di ${place.district}, Bandar Lampung.`,
      type: "article",
      url: canonical,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages.map((img) => img.url),
    },
  };
}

export default async function Page({ params }) {
  const { placeId } = await params;
  const initialState = await placeState(placeId);
  const place = initialState.place;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://balamwifi.my.id";
  // if SSR failed but place may still be fetchable client-side, still render page
  return (
    <>
      {place ? (
        <>
          <JsonLd data={placeJsonLd(place, siteUrl)} />
          <JsonLd
            data={breadcrumbJsonLd(
              [
                { name: "Home", url: "/" },
                { name: "Places", url: "/places" },
                { name: place.name, url: `/places/${placeId}` },
              ],
              siteUrl,
            )}
          />
        </>
      ) : null}
      <PlaceDetailPage
        key={placeId}
        placeId={placeId}
        initialState={initialState}
      />
    </>
  );
}
