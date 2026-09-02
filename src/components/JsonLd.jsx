export function JsonLd({ data }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function websiteJsonLd(siteUrl) {
  const base = siteUrl ?? "https://balamwifi.my.id";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "BalamWiFi",
    url: base,
    description: "Direktori WiFi publik Bandar Lampung",
    inLanguage: "id-ID",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/places?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function placeJsonLd(place, siteUrl) {
  if (!place) return null;
  const base = siteUrl ?? "https://balamwifi.my.id";
  const url = `${base}/places/${place.id}`;
  const data = {
    "@context": "https://schema.org",
    "@type": place.category?.toLowerCase().includes("cafe")
      ? "CafeOrRestaurant"
      : "Place",
    name: place.name,
    url,
    address: {
      "@type": "PostalAddress",
      streetAddress: place.address,
      addressLocality: place.district ?? "Bandar Lampung",
      addressRegion: "Lampung",
      addressCountry: "ID",
    },
    description: place.map_context || `${place.category} di ${place.district}`,
  };
  if (place.latitude != null && place.longitude != null) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
    };
  }
  if (place.image_url) {
    data.image = place.image_url;
  }
  if (place.review_count > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(place.avg_rating ?? 0),
      reviewCount: String(place.review_count),
      bestRating: "5",
      worstRating: "1",
    };
  }
  return data;
}

export function breadcrumbJsonLd(items, siteUrl) {
  const base = siteUrl ?? "https://balamwifi.my.id";
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${base}${item.url}`,
    })),
  };
}
