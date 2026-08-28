import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata = {
  title: "LABEL — Fantasy Rap",
  description: "Draft real French rap artists. Their score moves with real events.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#161018",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        {/* iOS ignores the web manifest for home-screen icon/standalone
            behavior and needs these explicitly — required for Web Push to
            work on iPhone at all, since iOS only allows push permission to
            be requested from an app added to the home screen this way. */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-[#17111f] text-[#f4efe8] min-h-screen">
        <ServiceWorkerRegister />
        <div className="max-w-md mx-auto min-h-screen">{children}</div>
      </body>
    </html>
  );
}
