export type ChatSummary = {
  id: string;
  title: string;
  preview: string;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  displayText: string;
  modelKey: string;
  createdAtUtc: string;
};

export type ModelEntry = {
  modelKey: string;
  displayName: string;
  provider: string;
  inputWeight: number;
  outputWeight: number;
};

export type WidgetKey = "weather.local" | "news.local";

export type WidgetLocationPreference = {
  source: "browser" | "ip" | "manual";
  label: string;
  latitude: number;
  longitude: number;
  locality: string;
  principalSubdivision: string;
  countryCode: string;
  postcode?: string | null;
  timezone: string;
};

export type HubPreferences = {
  orderedWidgetKeys: WidgetKey[];
  location: WidgetLocationPreference | null;
  updatedAtUtc: string;
};

export type WidgetLocationSearchResult = {
  label: string;
  latitude: number;
  longitude: number;
  locality: string;
  principalSubdivision: string;
  countryCode: string;
  postcode?: string | null;
  timezone: string;
};

export type WeatherCurrentConditions = {
  time: string;
  temperatureC: number;
  apparentTemperatureC: number;
  windSpeedKph: number;
  weatherCode: number;
  condition: string;
  isDay: boolean;
};

export type WeatherForecastDay = {
  date: string;
  minTemperatureC: number;
  maxTemperatureC: number;
  weatherCode: number;
  condition: string;
};

export type WeatherWidgetData = {
  timezone: string;
  current: WeatherCurrentConditions;
  forecast: WeatherForecastDay[];
  fetchedAtUtc: string;
};

export type NewsHeadline = {
  title: string;
  description: string;
  url: string;
  source: string;
  imageUrl?: string | null;
  publishedAtUtc: string;
};

export type NewsWidgetData = {
  isAvailable: boolean;
  mode: "local-search" | "country-fallback";
  queryLabel: string;
  message?: string | null;
  headlines: NewsHeadline[];
  fetchedAtUtc: string;
};
