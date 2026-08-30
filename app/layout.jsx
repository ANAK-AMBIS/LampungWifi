import "../src/index.css";
import "../src/globals.css";
import { AppShell } from "../src/components/AppShell.jsx";
import { ErrorBoundary } from "../src/components/ErrorBoundary.jsx";
import { ToastProvider } from "../src/components/Toast.jsx";

export const metadata = {
  title: "BalamWiFi",
  description: "Direktori WiFi publik Bandar Lampung",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://cdn.hugeicons.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.hugeicons.com/font/hgi-stroke-rounded.css" crossOrigin="anonymous" />
      </head>
      <body>
        <ErrorBoundary>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
