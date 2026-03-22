"use client";

import type { WidgetLocationPreference } from "@/lib/types";

type BigDataCloudResponse = {
  latitude?: number;
  longitude?: number;
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryCode?: string;
  postcode?: string;
  timezone?: string;
};

export async function resolveBrowserLocation(): Promise<WidgetLocationPreference> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Browser location is not available on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 300_000,
    });
  });

  return reverseGeocode(position.coords.latitude, position.coords.longitude, "browser");
}

export async function resolveApproximateLocation(): Promise<WidgetLocationPreference> {
  return reverseGeocode(undefined, undefined, "ip");
}

async function reverseGeocode(
  latitude: number | undefined,
  longitude: number | undefined,
  source: WidgetLocationPreference["source"],
): Promise<WidgetLocationPreference> {
  const params = new URLSearchParams({ localityLanguage: "en" });
  if (typeof latitude === "number" && typeof longitude === "number") {
    params.set("latitude", String(latitude));
    params.set("longitude", String(longitude));
  }

  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Could not resolve the selected area.");
  }

  const data = (await response.json()) as BigDataCloudResponse;
  const locality = (data.city || data.locality || "").trim();
  const principalSubdivision = (data.principalSubdivision || "").trim();
  const countryCode = (data.countryCode || "GB").trim().toUpperCase();
  const resolvedLatitude = typeof data.latitude === "number" ? data.latitude : latitude;
  const resolvedLongitude = typeof data.longitude === "number" ? data.longitude : longitude;

  if (typeof resolvedLatitude !== "number" || typeof resolvedLongitude !== "number") {
    throw new Error("Location coordinates were unavailable for this area.");
  }

  const label = [locality, principalSubdivision, countryCode].filter(Boolean).join(", ");

  return {
    source,
    label: label || "Approximate area",
    latitude: resolvedLatitude,
    longitude: resolvedLongitude,
    locality,
    principalSubdivision,
    countryCode,
    postcode: data.postcode || null,
    timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}
