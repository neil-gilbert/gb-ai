"use client";

import { ArrowDown, ArrowUp, LoaderCircle, MapPin, Search, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import HubShell from "@/components/layout/HubShell";
import { apiFetch } from "@/lib/api";
import { useHubPreferences } from "@/lib/useHubPreferences";
import type { WidgetLocationPreference, WidgetLocationSearchResult } from "@/lib/types";
import { resolveApproximateLocation, resolveBrowserLocation } from "@/lib/widgets/location";
import { widgetRegistry } from "@/lib/widgets/registry";

export default function WidgetManagerPage() {
  const {
    preferences,
    isLoading,
    isSaving,
    error,
    toggleWidget,
    moveWidget,
    setLocation,
    applyRecommendedWidgets,
  } = useHubPreferences();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [results, setResults] = useState<WidgetLocationSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const widgetCountLabel = `${preferences.orderedWidgetKeys.length} ${preferences.orderedWidgetKeys.length === 1 ? "widget" : "widgets"} active`;

  useEffect(() => {
    if (deferredQuery.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setSearching(true);
      setSearchError(null);

      try {
        const response = await apiFetch<WidgetLocationSearchResult[]>(
          `/api/v1/widgets/location/search?q=${encodeURIComponent(deferredQuery)}`,
        );

        if (!cancelled) {
          setResults(response);
        }
      } catch (err) {
        if (!cancelled) {
          setSearchError(err instanceof Error ? err.message : "Could not search locations.");
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [deferredQuery]);

  async function handleCurrentLocation() {
    setLocationBusy(true);
    setLocationNotice(null);
    setSearchError(null);

    try {
      const location = await resolveBrowserLocation();
      await setLocation(location);
    } catch (err) {
      try {
        const approximateLocation = await resolveApproximateLocation();
        await setLocation(approximateLocation);
        setLocationNotice("Using an approximate area because browser location was unavailable.");
      } catch {
        setSearchError(err instanceof Error ? err.message : "Could not resolve your area.");
      }
    } finally {
      setLocationBusy(false);
    }
  }

  async function chooseManualLocation(result: WidgetLocationSearchResult) {
    const location: WidgetLocationPreference = {
      source: "manual",
      label: result.label,
      latitude: result.latitude,
      longitude: result.longitude,
      locality: result.locality,
      principalSubdivision: result.principalSubdivision,
      countryCode: result.countryCode,
      postcode: result.postcode || null,
      timezone: result.timezone,
    };

    await setLocation(location);
    setLocationNotice(null);
  }

  return (
    <HubShell
      sectionTitle="Setup"
      sectionDescription="Configure what appears on the homepage and which local area powers the local cards."
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="rounded-[2rem] border border-[#C2CFEC] bg-white/88 px-5 py-5 shadow-[0_18px_50px_rgba(8,21,66,0.12)] backdrop-blur md:px-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-[#4e618f] uppercase">Hub Setup</p>
              <h1 className="mt-2 font-serif text-3xl text-[#081542] md:text-4xl">Configure the homepage away from the homepage</h1>
              <p className="mt-3 max-w-2xl text-sm text-[#4e618f] md:text-base">
                Choose which modules are pinned to the hub, reorder them, and decide which local area powers weather and news.
              </p>
            </div>
            <div className="max-w-sm rounded-[1.6rem] border border-[#00247D]/10 bg-[#F8FAFF] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-3 text-[#00247D] shadow-sm">
                  <Settings2 size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase">Live status</p>
                  <p className="mt-2 text-sm leading-6 text-[#4e618f]">
                    {widgetCountLabel}. {preferences.location?.label || "No local area saved yet."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {(error || searchError || locationNotice) ? (
          <div className="grid gap-3">
            {error ? (
              <div className="rounded-2xl border border-[#C8102E]/20 bg-white px-4 py-3 text-sm text-[#A90F24] shadow-sm">{error}</div>
            ) : null}
            {searchError ? (
              <div className="rounded-2xl border border-[#C8102E]/20 bg-white px-4 py-3 text-sm text-[#A90F24] shadow-sm">{searchError}</div>
            ) : null}
            {locationNotice ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 shadow-sm">{locationNotice}</div>
            ) : null}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="rounded-[1.75rem] border border-[#C2CFEC] bg-white/92 p-5 shadow-[0_16px_44px_rgba(8,21,66,0.10)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase">Modules</p>
                <h2 className="mt-2 font-serif text-2xl text-[#081542]">Homepage cards</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  void applyRecommendedWidgets().catch(() => {});
                }}
                disabled={isLoading || isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-[#00247D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#001B54] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
                <span>Add recommended starters</span>
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {widgetRegistry.map((widget) => {
                const Icon = widget.icon;
                const isEnabled = preferences.orderedWidgetKeys.includes(widget.key);
                const index = preferences.orderedWidgetKeys.indexOf(widget.key);

                return (
                  <div
                    key={widget.key}
                    className={`rounded-2xl border px-4 py-4 ${
                      isEnabled
                        ? "border-[#00247D]/18 bg-[#F8FAFF]"
                        : "border-dashed border-[#C2CFEC] bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-white p-3 text-[#00247D] shadow-sm">
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[#081542]">{widget.title}</h3>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                              isEnabled ? "bg-[#00247D] text-white" : "bg-slate-100 text-slate-500"
                            }`}>
                              {isEnabled ? "Live" : "Off"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-[#4e618f]">{widget.description}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void toggleWidget(widget.key).catch(() => {});
                          }}
                          disabled={isLoading || isSaving}
                          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            isEnabled
                              ? "border border-[#00247D]/15 bg-white text-[#00247D] hover:bg-[#F4F7FF]"
                              : "bg-[#00247D] text-white hover:bg-[#001B54]"
                          }`}
                        >
                          {isEnabled ? "Remove" : "Add widget"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void moveWidget(widget.key, -1).catch(() => {});
                          }}
                          disabled={!isEnabled || index <= 0 || isSaving}
                          className="inline-flex items-center gap-1 rounded-full border border-[#00247D]/15 bg-white px-3 py-2 text-sm font-semibold text-[#00247D] transition-colors hover:bg-[#F4F7FF] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ArrowUp size={14} />
                          <span>Up</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void moveWidget(widget.key, 1).catch(() => {});
                          }}
                          disabled={!isEnabled || index === -1 || index >= preferences.orderedWidgetKeys.length - 1 || isSaving}
                          className="inline-flex items-center gap-1 rounded-full border border-[#00247D]/15 bg-white px-3 py-2 text-sm font-semibold text-[#00247D] transition-colors hover:bg-[#F4F7FF] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ArrowDown size={14} />
                          <span>Down</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[#C2CFEC] bg-white/92 p-5 shadow-[0_16px_44px_rgba(8,21,66,0.10)]">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase">Local area</p>
            <h2 className="mt-2 font-serif text-2xl text-[#081542]">Weather and news location</h2>
            <p className="mt-3 text-sm text-[#4e618f]">
              Keep location changes in setup so the homepage stays clean. Signed-in users keep the final area on their account.
            </p>

            <div className="mt-5 rounded-2xl border border-[#00247D]/12 bg-[#F8FAFF] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-3 text-[#00247D] shadow-sm">
                  <MapPin size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#081542]">{preferences.location?.label || "Area not set"}</p>
                  <p className="mt-1 text-xs text-[#4e618f]">
                    {preferences.location
                      ? `Source: ${preferences.location.source}`
                      : "Choose an area to activate the local widgets."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleCurrentLocation().catch(() => {});
                }}
                disabled={locationBusy || isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00247D] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#001B54] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {locationBusy ? <LoaderCircle size={16} className="animate-spin" /> : <MapPin size={16} />}
                <span>Use my current area</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void setLocation(null).catch(() => {});
                }}
                disabled={!preferences.location || isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#00247D]/15 px-4 py-3 text-sm font-semibold text-[#00247D] transition-colors hover:bg-[#F4F7FF] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={16} />
                <span>Clear area</span>
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-[#00247D]/12 bg-white p-4">
              <label className="text-[11px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase" htmlFor="location-search">
                Search manually
              </label>
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[#C2CFEC] bg-[#F8FAFF] px-3 py-2">
                <Search size={15} className="text-[#4e618f]" />
                <input
                  id="location-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search town, city, or postcode"
                  className="w-full border-none bg-transparent text-sm text-[#081542] outline-none placeholder:text-[#7b8cb7]"
                />
              </div>

              {searching ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-[#4e618f]">
                  <LoaderCircle size={16} className="animate-spin" />
                  <span>Searching locations...</span>
                </div>
              ) : results.length > 0 ? (
                <div className="mt-4 grid gap-2">
                  {results.map((result) => (
                    <button
                      key={`${result.label}-${result.latitude}-${result.longitude}`}
                      type="button"
                      onClick={() => {
                        void chooseManualLocation(result).catch(() => {});
                      }}
                      className="rounded-2xl border border-[#00247D]/10 bg-[#F8FAFF] px-4 py-3 text-left transition-colors hover:bg-white"
                    >
                      <p className="text-sm font-semibold text-[#081542]">{result.label}</p>
                      <p className="mt-1 text-xs text-[#4e618f]">
                        {result.timezone}
                        {result.postcode ? ` • ${result.postcode}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              ) : deferredQuery.length >= 2 ? (
                <p className="mt-4 text-sm text-[#4e618f]">No matching locations found.</p>
              ) : (
                <p className="mt-4 text-sm text-[#4e618f]">Type at least two characters to search.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </HubShell>
  );
}
