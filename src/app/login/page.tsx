"use client";

import { BackendUnavailable } from "@/components/layout/backend-unavailable";
import { APP_MODE } from "@/config/env";
import { PinLogin } from "@/features/auth/pin-login";

export default function LoginPage() {
  if (APP_MODE === "production") return <BackendUnavailable />;
  return <PinLogin />;
}
