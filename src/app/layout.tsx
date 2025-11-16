import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Academia Padel",
  description: "Gestión de agenda, alumnos, planes y finanzas para tu academia de pádel.",
  openGraph: {
    title: "Academia Padel",
    description: "Gestión de agenda, alumnos, planes y finanzas para tu academia de pádel.",
    url: process.env.NEXT_PUBLIC_BASE_URL ?? "https://app_academia.nativatech.com.py",
    siteName: "Academia Padel",
    images: [
      {
        url: "/icons/logoAgendo.jpg",
        width: 512,
        height: 512,
        alt: "Logo Academia Padel",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Academia Padel",
    description: "Gestión de agenda, alumnos, planes y finanzas para tu academia de pádel.",
    images: ["/icons/logoAgendo.jpg"],
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
        <meta name="theme-color" content="#3cadaf" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#f5f7fa] text-[#31435d]`}
      >
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(console.error);
          });
        }
      `,
          }}
        />
      </body>
    </html>
  );
}
