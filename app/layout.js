import "./globals.css";

export const metadata = {
  title: "LABEL — Fantasy Rap",
  description: "Draft real French rap artists. Their score moves with real events.",
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
      </head>
      <body className="bg-[#17111f] text-[#f4efe8] min-h-screen">
        <div className="max-w-md mx-auto min-h-screen">{children}</div>
      </body>
    </html>
  );
}
