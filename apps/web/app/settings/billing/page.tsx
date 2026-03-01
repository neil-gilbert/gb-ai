"use client";

import { SignInButton, useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function BillingPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = new URLSearchParams(window.location.search);
    setResult(query.get("result"));
  }, []);

  async function startCheckout(planName: string) {
    if (!isSignedIn) {
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        return;
      }

      const data = await apiFetch<{ url: string }>("/api/v1/billing/checkout", {
        method: "POST",
        token,
        body: { planName },
      });

      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    if (!isSignedIn) {
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        return;
      }

      const data = await apiFetch<{ url: string }>("/api/v1/billing/portal", {
        method: "POST",
        token,
        body: { returnUrl: window.location.href },
      });

      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  if (!isLoaded) {
    return (
      <main className="admin-shell">
        <p>Loading authentication...</p>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="admin-shell">
        <h1 style={{ marginTop: 0 }}>gb-ai Billing</h1>
        <p>Sign in to manage your subscription.</p>
        <SignInButton mode="modal">
          <button className="plan-btn" type="button" style={{ width: "auto" }}>
            Sign in
          </button>
        </SignInButton>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <h1 style={{ marginTop: 0 }}>gb-ai Billing</h1>
      {result ? <p>Last checkout result: {result}</p> : null}

      <div className="admin-grid">
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>Upgrade</h2>
          <p>gb-ai plans are billed monthly in Stripe.</p>
          <button className="plan-btn" disabled={loading} onClick={() => void startCheckout("Light")}>Choose Light</button>
          <button className="plan-btn" disabled={loading} onClick={() => void startCheckout("Pro")} style={{ marginTop: 8 }}>Choose Pro</button>
        </section>

        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>Manage subscription</h2>
          <button className="plan-btn" disabled={loading} onClick={() => void openPortal()}>Open Stripe Portal</button>
        </section>
      </div>
    </main>
  );
}
