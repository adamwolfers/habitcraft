'use client';

import { Suspense } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { PostHogProvider } from "@/components/PostHogProvider";
import { PostHogPageView } from "@/components/PostHogPageView";
import LayoutHeader from "@/components/LayoutHeader";

export default function Providers({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PostHogProvider>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <AuthProvider>
        <LayoutHeader />
        {children}
      </AuthProvider>
    </PostHogProvider>
  );
}
