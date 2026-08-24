import { SubmitPage } from "../../src/views/SubmitPage.jsx";

export const metadata = {
  title: "Tambah Tempat WiFi — BalamWiFi",
  description:
    "Kontribusikan tempat WiFi publik di Bandar Lampung. Setiap kiriman masuk moderasi sebelum tampil di direktori.",
  openGraph: {
    title: "Tambah Tempat WiFi — BalamWiFi",
    description:
      "Bantu komunitas Bandar Lampung menemukan internet publik yang jelas.",
    type: "website",
  },
};

export default function Page() {
  return <SubmitPage />;
}
