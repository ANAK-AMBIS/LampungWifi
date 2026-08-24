import { HomePage } from "../src/views/HomePage.jsx";
import { placesState } from "../src/lib/serverApi.js";

export const metadata = {
  title: "BalamWiFi — WiFi Publik Bandar Lampung",
  description:
    "Cari kafe, perpustakaan, coworking, dan area kampus dengan WiFi publik di Bandar Lampung. Laporan kecepatan, ulasan komunitas, dan filter lengkap.",
  openGraph: {
    title: "BalamWiFi — WiFi Publik Bandar Lampung",
    description:
      "Direktori tempat kerja, nongkrong, dan transit dengan WiFi publik yang jelas status legalnya.",
    type: "website",
  },
};

export const revalidate = 60;

export default async function Page() {
  const initialFeatured = await placesState({ limit: 6 });
  return <HomePage initialFeatured={initialFeatured} />;
}
