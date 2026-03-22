import type { LucideIcon } from "lucide-react";
import { CloudSun, Newspaper } from "lucide-react";
import type { WidgetKey } from "@/lib/types";

export type WidgetDefinition = {
  key: WidgetKey;
  title: string;
  description: string;
  icon: LucideIcon;
  requiresLocation: boolean;
  desktopSpan: string;
  mobileSpan: string;
};

export const widgetRegistry: WidgetDefinition[] = [
  {
    key: "weather.local",
    title: "Local Weather",
    description: "Current conditions and a five-day outlook for your chosen area.",
    icon: CloudSun,
    requiresLocation: true,
    desktopSpan: "lg:col-span-2",
    mobileSpan: "col-span-1",
  },
  {
    key: "news.local",
    title: "Local News",
    description: "A local headlines card tuned to your area, with fallback to country coverage.",
    icon: Newspaper,
    requiresLocation: true,
    desktopSpan: "lg:col-span-2",
    mobileSpan: "col-span-1",
  },
];

export const widgetRegistryMap = new Map(widgetRegistry.map((widget) => [widget.key, widget]));
export const recommendedWidgetOrder: WidgetKey[] = ["weather.local", "news.local"];
