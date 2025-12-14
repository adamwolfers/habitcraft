import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import HeaderWithProfile from "@/components/HeaderWithProfile";

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
        <AuthProvider>
          <HeaderWithProfile />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
