"use client";

import { ClerkProvider } from "@clerk/clerk-react";

type AuthProvidersProps = {
  children: React.ReactNode;
};

export default function AuthProviders({ children }: AuthProvidersProps) {
  // Valid fallback key keeps static export/builds functional when env vars are absent locally.
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";

  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
}
