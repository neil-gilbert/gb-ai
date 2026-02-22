"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function BillingPage() {
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
    setLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/api/v1/billing/checkout", {
        method: "POST",
        body: { planName },
      });

      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    setLoading(true);
    try {
      const data = await apiFetch<{ url: string }>("/api/v1/billing/portal", {
        method: "POST",
        body: { returnUrl: window.location.href },
      });

      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
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
