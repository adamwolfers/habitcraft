"use client";

import { useFeatureFlagEnabled, useFeatureFlagPayload } from "posthog-js/react";
import { useState } from "react";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

interface MaintenanceBannerPayload {
  message?: string;
}

export function MaintenanceBanner() {
  const [dismissed, setDismissed] = useState(false);
  const showBanner = useFeatureFlagEnabled(FEATURE_FLAGS.MAINTENANCE_BANNER);
  const payload = useFeatureFlagPayload(
    FEATURE_FLAGS.MAINTENANCE_BANNER
  ) as MaintenanceBannerPayload | null;

  if (!showBanner || dismissed) return null;

  const message =
    payload?.message || "Scheduled maintenance coming soon.";

  return (
    <div
      className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-yellow-800 flex items-center justify-center gap-4"
      role="alert"
    >
      <span>⚠️ {message}</span>
      <button
        onClick={() => setDismissed(true)}
        className="text-yellow-600 hover:text-yellow-800 font-medium text-sm"
        aria-label="Dismiss maintenance notice"
      >
        Dismiss
      </button>
    </div>
  );
}
