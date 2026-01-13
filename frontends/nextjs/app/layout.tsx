import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";

export const metadata: Metadata = {
  title: "HabitCraft.org | Track your habits, visualize your progress, and achieve your habit goals!",
  description: "Track your habits, visualize your progress, and achieve your habit goals!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <MaintenanceBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
