"use client";

import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { HubPreferences, WidgetKey, WidgetLocationPreference } from "@/lib/types";
import { recommendedWidgetOrder } from "@/lib/widgets/registry";

export const HUB_PREFERENCES_STORAGE_KEY = "hyoka_hub_preferences_v1";

const knownWidgetKeys = new Set<WidgetKey>(["weather.local", "news.local"]);

export function useHubPreferences() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [preferences, setPreferences] = useState<HubPreferences>(createEmptyPreferences());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (!isSignedIn) {
          const guestPreferences = readGuestPreferences();
          if (!cancelled) {
            setPreferences(guestPreferences);
          }
          return;
        }

        const token = await getToken();
        if (!token) {
          throw new Error("Your session expired. Please sign in again.");
        }

        let remotePreferences = normalizePreferences(
          await apiFetch<HubPreferences>("/api/v1/widgets/preferences", { token }),
        );
        const guestPreferences = readGuestPreferences();
        if (isPreferencesEmpty(remotePreferences) && !isPreferencesEmpty(guestPreferences)) {
          remotePreferences = normalizePreferences(
            await apiFetch<HubPreferences>("/api/v1/widgets/preferences", {
              method: "PUT",
              token,
              body: guestPreferences,
            }),
          );
          window.localStorage.removeItem(HUB_PREFERENCES_STORAGE_KEY);
        }

        if (!cancelled) {
          setPreferences(remotePreferences);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your hub settings.");
          setPreferences(readGuestPreferences());
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  const savePreferences = useCallback(async (
    nextValue: HubPreferences | ((current: HubPreferences) => HubPreferences),
  ) => {
    const current = preferencesRef.current;
    const next = normalizePreferences(
      typeof nextValue === "function" ? nextValue(current) : nextValue,
    );

    setPreferences(next);
    setIsSaving(true);
    setError(null);

    try {
      if (!isSignedIn) {
        window.localStorage.setItem(HUB_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
        return next;
      }

      const token = await getToken();
      if (!token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const saved = normalizePreferences(
        await apiFetch<HubPreferences>("/api/v1/widgets/preferences", {
          method: "PUT",
          token,
          body: next,
        }),
      );

      setPreferences(saved);
      return saved;
    } catch (err) {
      setPreferences(current);
      setError(err instanceof Error ? err.message : "Could not save your hub settings.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [getToken, isSignedIn]);

  const applyRecommendedWidgets = useCallback(async () => {
    await savePreferences((current) => ({
      ...current,
      orderedWidgetKeys: [...recommendedWidgetOrder],
      updatedAtUtc: new Date().toISOString(),
    }));
  }, [savePreferences]);

  const toggleWidget = useCallback(async (widgetKey: WidgetKey) => {
    await savePreferences((current) => {
      const exists = current.orderedWidgetKeys.includes(widgetKey);
      return {
        ...current,
        orderedWidgetKeys: exists
          ? current.orderedWidgetKeys.filter((key) => key !== widgetKey)
          : [...current.orderedWidgetKeys, widgetKey],
        updatedAtUtc: new Date().toISOString(),
      };
    });
  }, [savePreferences]);

  const moveWidget = useCallback(async (widgetKey: WidgetKey, direction: -1 | 1) => {
    await savePreferences((current) => {
      const index = current.orderedWidgetKeys.indexOf(widgetKey);
      if (index === -1) {
        return current;
      }

      const target = index + direction;
      if (target < 0 || target >= current.orderedWidgetKeys.length) {
        return current;
      }

      const orderedWidgetKeys = [...current.orderedWidgetKeys];
      const [item] = orderedWidgetKeys.splice(index, 1);
      orderedWidgetKeys.splice(target, 0, item);

      return {
        ...current,
        orderedWidgetKeys,
        updatedAtUtc: new Date().toISOString(),
      };
    });
  }, [savePreferences]);

  const setLocation = useCallback(async (location: WidgetLocationPreference | null) => {
    await savePreferences((current) => ({
      ...current,
      location,
      updatedAtUtc: new Date().toISOString(),
    }));
  }, [savePreferences]);

  return {
    preferences,
    isLoading,
    isSaving,
    error,
    hasLocation: Boolean(preferences.location),
    savePreferences,
    setLocation,
    toggleWidget,
    moveWidget,
    applyRecommendedWidgets,
  };
}

function readGuestPreferences(): HubPreferences {
  if (typeof window === "undefined") {
    return createEmptyPreferences();
  }

  const raw = window.localStorage.getItem(HUB_PREFERENCES_STORAGE_KEY);
  if (!raw) {
    return createEmptyPreferences();
  }

  try {
    return normalizePreferences(JSON.parse(raw) as HubPreferences);
  } catch {
    return createEmptyPreferences();
  }
}

function normalizePreferences(input: HubPreferences | null | undefined): HubPreferences {
  const orderedWidgetKeys = (input?.orderedWidgetKeys ?? []).filter(isWidgetKey);
  const uniqueKeys = [...new Set(orderedWidgetKeys)] as WidgetKey[];

  return {
    orderedWidgetKeys: uniqueKeys,
    location: normalizeLocation(input?.location ?? null),
    updatedAtUtc: input?.updatedAtUtc || new Date().toISOString(),
  };
}

function normalizeLocation(location: WidgetLocationPreference | null): WidgetLocationPreference | null {
  if (!location) {
    return null;
  }

  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    return null;
  }

  const source = location.source === "browser" || location.source === "ip" ? location.source : "manual";
  return {
    source,
    label: location.label?.trim() || [location.locality, location.principalSubdivision, location.countryCode].filter(Boolean).join(", "),
    latitude: Number(location.latitude.toFixed(4)),
    longitude: Number(location.longitude.toFixed(4)),
    locality: location.locality?.trim() || "",
    principalSubdivision: location.principalSubdivision?.trim() || "",
    countryCode: (location.countryCode?.trim() || "GB").toUpperCase(),
    postcode: location.postcode?.trim() || null,
    timezone: location.timezone?.trim() || "UTC",
  };
}

function isPreferencesEmpty(preferences: HubPreferences): boolean {
  return preferences.orderedWidgetKeys.length === 0 && !preferences.location;
}

function createEmptyPreferences(): HubPreferences {
  return {
    orderedWidgetKeys: [],
    location: null,
    updatedAtUtc: new Date().toISOString(),
  };
}

function isWidgetKey(value: string): value is WidgetKey {
  return knownWidgetKeys.has(value as WidgetKey);
}
