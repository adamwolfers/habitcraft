import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import HeaderWithProfile from "@/components/HeaderWithProfile";
import { PostHogProvider } from "@/components/PostHogProvider";
import { PostHogPageView } from "@/components/PostHogPageView";

export const metadata: Metadata = {
  title: "HabitCraft.org | Track your daily habits and build streaks",
  description: "Track your daily habits and build streaks",
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
            <HeaderWithProfile />
            {children}
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
