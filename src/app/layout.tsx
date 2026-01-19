import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import PreloaderProvider from "./PreloaderProvider";
import { Toaster } from "sonner";
import CapacitorDeeplinkHandler from "./capacitor-deeplink-handler";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AGENDO",
  description: "Gestión de agenda, alumnos, planes y finanzas para tu academia de pádel.",
  openGraph: {
    title: "AGENDO",
    description: "Gestión de agenda, alumnos, planes y finanzas para tu academia de pádel.",
    url: process.env.NEXT_PUBLIC_BASE_URL ?? "https://agendo.nativatech.com.py",
    siteName: "Academia Padel",
    images: [
      {
        url:
          (process.env.NEXT_PUBLIC_BASE_URL ?? "https://agendo.nativatech.com.py") +
          "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Logo Academia Padel",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AGENDO",
    description: "Gestión de agenda, alumnos, planes y finanzas para tu academia de pádel.",
    images: [
      (process.env.NEXT_PUBLIC_BASE_URL ?? "https://agendo.nativatech.com.py") +
        "/icons/icon-512.png",
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-title" content="AGENDO" />
        <meta name="theme-color" content="#3cadaf" />
        <Script src="capacitor://localhost/capacitor.js" strategy="beforeInteractive" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#f5f7fa] text-[#31435d]`}
      >
        <CapacitorDeeplinkHandler />
        <PreloaderProvider>{children}</PreloaderProvider>
        <Toaster richColors position="top-right" />
        <Script id="sw-register" strategy="afterInteractive">
          {`
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then((reg) => {
              try {
                reg.update();
              } catch (e) {}

              function tryActivateWaiting() {
                if (reg.waiting) {
                  try {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                  } catch (e) {}
                }
              }

              tryActivateWaiting();

              reg.addEventListener('updatefound', () => {
                const installing = reg.installing;
                if (!installing) return;
                installing.addEventListener('statechange', () => {
                  if (installing.state === 'installed') {
                    tryActivateWaiting();
                  }
                });
              });

              let reloaded = false;
              navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (reloaded) return;
                reloaded = true;
                window.location.reload();
              });

              document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                  try {
                    reg.update();
                  } catch (e) {}
                }
              });
            }).catch(console.error);
          });
        }
      `}
        </Script>
      </body>
    </html>
  );
}
