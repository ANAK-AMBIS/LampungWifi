import "../src/index.css";
import "../src/globals.css";
import { AppShell } from "../src/components/AppShell.jsx";
import { ErrorBoundary } from "../src/components/ErrorBoundary.jsx";

export const metadata = {
  title: "BalamWiFi",
  description: "Direktori WiFi publik Bandar Lampung",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <ErrorBoundary>
          <AppShell>{children}</AppShell>
        </ErrorBoundary>
      </body>
    </html>
  );
}
