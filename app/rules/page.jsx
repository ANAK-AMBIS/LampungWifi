import { RulesPage } from "../../src/views/RulesPage.jsx";

export const metadata = {
  title: "Aturan — BalamWiFi",
  description:
    "Aturan publikasi BalamWiFi: hanya WiFi publik yang boleh tampil, password wajib punya sumber jelas, dan setiap tempat ditinjau admin.",
  openGraph: {
    title: "Aturan — BalamWiFi",
    description: "Direktori WiFi aman dimulai dari data yang boleh dibagikan.",
    type: "website",
  },
};

export default function Page() {
  return <RulesPage />;
}
