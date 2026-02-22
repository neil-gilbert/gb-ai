"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  plan: string;
  subscriptionStatus: string;
  createdAtUtc: string;
};

type Plan = {
  id: string;
  name: string;
  stripePriceId: string;
  isActive: boolean;
  requestsPerMinute: number;
  requestsPerDay: number;
  requestsPerMonth: number;
  creditsPerDay: number;
  creditsPerMonth: number;
  monthlyPriceUsd: number;
};

type Model = {
  id: string;
  modelKey: string;
  displayName: string;
  provider: string;
  providerModelId?: string;
  fallbackModelKey?: string;
  inputWeight: number;
  outputWeight: number;
  enabled: boolean;
  planAccessCsv: string;
};

type Usage = {
  daily?: { totalRequests: number; totalCredits: number };
  monthly?: { totalRequests: number; totalCredits: number };
  topModels: { model: string; requests: number; credits: number }[];
};

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadData() {
    try {
      const [usersData, plansData, modelsData, usageData] = await Promise.all([
        apiFetch<AdminUser[]>("/api/v1/admin/users"),
        apiFetch<Plan[]>("/api/v1/admin/plans"),
        apiFetch<Model[]>("/api/v1/admin/models"),
        apiFetch<Usage>("/api/v1/admin/usage"),
      ]);

      setUsers(usersData);
      setPlans(plansData);
      setModels(modelsData);
      setUsage(usageData);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load admin data";
      setError(message);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function savePlan(plan: Plan) {
    setSavingId(plan.id);
    try {
      await apiFetch(`/api/v1/admin/plans/${plan.id}`, {
        method: "PUT",
        body: {
          name: plan.name,
          stripePriceId: plan.stripePriceId,
          isActive: plan.isActive,
          requestsPerMinute: Number(plan.requestsPerMinute),
          requestsPerDay: Number(plan.requestsPerDay),
          requestsPerMonth: Number(plan.requestsPerMonth),
          creditsPerDay: Number(plan.creditsPerDay),
          creditsPerMonth: Number(plan.creditsPerMonth),
          monthlyPriceUsd: Number(plan.monthlyPriceUsd),
        },
      });
      await loadData();
    } finally {
      setSavingId(null);
    }
  }

  async function saveModel(model: Model) {
    setSavingId(model.id);
    try {
      await apiFetch(`/api/v1/admin/models/${model.id}`, {
        method: "PUT",
        body: {
          displayName: model.displayName,
          provider: model.provider,
          providerModelId: model.providerModelId,
          fallbackModelKey: model.fallbackModelKey,
          inputWeight: Number(model.inputWeight),
          outputWeight: Number(model.outputWeight),
          enabled: model.enabled,
          planAccessCsv: model.planAccessCsv,
        },
      });
      await loadData();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="admin-shell">
      <h1 style={{ marginTop: 0 }}>gb-ai Admin Dashboard</h1>
      <p style={{ marginTop: 0, color: "var(--ink-soft)" }}>
        Manage gb-ai users, plans, models, and usage. Use the sidebar login as an admin user to access this page.
      </p>

      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}

      <div className="admin-grid">
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>Setup Status</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Clerk JWT verification path available in backend auth config</li>
            <li>Stripe checkout, portal, and webhook endpoints are active</li>
            <li>Provider catalog supports OpenAI, Anthropic, and OpenRouter</li>
          </ul>
        </section>

        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>Usage Snapshot</h2>
          <p style={{ marginBottom: 6 }}>
            Daily: {usage?.daily?.totalRequests ?? 0} requests / {usage?.daily?.totalCredits ?? 0} credits
          </p>
          <p style={{ marginBottom: 6 }}>
            Monthly: {usage?.monthly?.totalRequests ?? 0} requests / {usage?.monthly?.totalCredits ?? 0} credits
          </p>
          <div>
            <strong>Top models</strong>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {(usage?.topModels ?? []).map((model) => (
                <li key={model.model}>
                  {model.model} · {model.requests} req · {Math.round(model.credits)} credits
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>Users</h2>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Plan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.plan}</td>
                  <td>{user.subscriptionStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>Plans</h2>
          {plans.map((plan) => (
            <div key={plan.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
                <input
                  value={plan.name}
                  onChange={(e) =>
                    setPlans((curr) => curr.map((p) => (p.id === plan.id ? { ...p, name: e.target.value } : p)))
                  }
                />
                <input
                  value={plan.stripePriceId}
                  onChange={(e) =>
                    setPlans((curr) =>
                      curr.map((p) => (p.id === plan.id ? { ...p, stripePriceId: e.target.value } : p)),
                    )
                  }
                />
                <input
                  type="number"
                  value={plan.monthlyPriceUsd}
                  onChange={(e) =>
                    setPlans((curr) =>
                      curr.map((p) => (p.id === plan.id ? { ...p, monthlyPriceUsd: Number(e.target.value) } : p)),
                    )
                  }
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 8 }}>
                <input
                  type="number"
                  value={plan.requestsPerMinute}
                  onChange={(e) =>
                    setPlans((curr) =>
                      curr.map((p) => (p.id === plan.id ? { ...p, requestsPerMinute: Number(e.target.value) } : p)),
                    )
                  }
                />
                <input
                  type="number"
                  value={plan.requestsPerDay}
                  onChange={(e) =>
                    setPlans((curr) =>
                      curr.map((p) => (p.id === plan.id ? { ...p, requestsPerDay: Number(e.target.value) } : p)),
                    )
                  }
                />
                <input
                  type="number"
                  value={plan.requestsPerMonth}
                  onChange={(e) =>
                    setPlans((curr) =>
                      curr.map((p) => (p.id === plan.id ? { ...p, requestsPerMonth: Number(e.target.value) } : p)),
                    )
                  }
                />
              </div>
              <button
                type="button"
                className="plan-btn"
                style={{ marginTop: 8, width: "auto" }}
                onClick={() => {
                  void savePlan(plan);
                }}
                disabled={savingId === plan.id}
              >
                {savingId === plan.id ? "Saving..." : "Save plan"}
              </button>
            </div>
          ))}
        </section>

        <section className="admin-card" style={{ gridColumn: "1 / -1" }}>
          <h2 style={{ marginTop: 0 }}>Model Catalog</h2>
          {models.map((model) => (
            <div key={model.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{model.modelKey}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
                <input
                  value={model.displayName}
                  onChange={(e) =>
                    setModels((curr) =>
                      curr.map((m) => (m.id === model.id ? { ...m, displayName: e.target.value } : m)),
                    )
                  }
                />
                <input
                  value={model.provider}
                  onChange={(e) =>
                    setModels((curr) => curr.map((m) => (m.id === model.id ? { ...m, provider: e.target.value } : m)))
                  }
                />
                <input
                  value={model.providerModelId ?? ""}
                  onChange={(e) =>
                    setModels((curr) =>
                      curr.map((m) => (m.id === model.id ? { ...m, providerModelId: e.target.value } : m)),
                    )
                  }
                />
                <input
                  value={model.planAccessCsv}
                  onChange={(e) =>
                    setModels((curr) =>
                      curr.map((m) => (m.id === model.id ? { ...m, planAccessCsv: e.target.value } : m)),
                    )
                  }
                />
              </div>
              <button
                type="button"
                className="plan-btn"
                style={{ marginTop: 8, width: "auto" }}
                onClick={() => {
                  void saveModel(model);
                }}
                disabled={savingId === model.id}
              >
                {savingId === model.id ? "Saving..." : "Save model"}
              </button>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
