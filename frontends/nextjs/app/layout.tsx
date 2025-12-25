import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { PostHogProvider } from "@/components/PostHogProvider";
import { PostHogPageView } from "@/components/PostHogPageView";
import LayoutHeader from "@/components/LayoutHeader";

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
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <AuthProvider>
            <LayoutHeader />
            {children}
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
