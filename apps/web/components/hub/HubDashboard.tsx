"use client";

import { useAuth } from "@clerk/clerk-react";
import {
  ArrowRight,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudSun,
  LoaderCircle,
  MapPin,
  Newspaper,
  Plus,
  RefreshCw,
  Sparkles,
  SunMedium,
  Wind,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import HubShell from "@/components/layout/HubShell";
import { apiFetch } from "@/lib/api";
import { useHubPreferences } from "@/lib/useHubPreferences";
import type {
  ChatSummary,
  NewsWidgetData,
  WidgetKey,
  WidgetLocationPreference,
  WeatherWidgetData,
} from "@/lib/types";
import { widgetRegistryMap } from "@/lib/widgets/registry";

export default function HubDashboard() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { preferences, error: preferencesError } = useHubPreferences();
  const [recentChats, setRecentChats] = useState<ChatSummary[]>([]);
  const [isHubLoading, setIsHubLoading] = useState(true);
  const [hubError, setHubError] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const activeWidgets = preferences.orderedWidgetKeys.filter((key) => widgetRegistryMap.has(key));
  const widgetStatusLabel = `${activeWidgets.length} ${activeWidgets.length === 1 ? "live widget" : "live widgets"}`;

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsHubLoading(true);
      setHubError(null);

      try {
        const token = isSignedIn ? await getToken() : null;
        if (isSignedIn && !token) {
          throw new Error("Your session expired. Please sign in again.");
        }

        const chatsData = await apiFetch<{ items: ChatSummary[] }>("/api/v1/chats", { token });

        if (!cancelled) {
          setRecentChats(chatsData.items.slice(0, 3));
        }
      } catch (err) {
        if (!cancelled) {
          setHubError(err instanceof Error ? err.message : "Could not load your hub.");
        }
      } finally {
        if (!cancelled) {
          setIsHubLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  const createChatAndOpen = useCallback(async () => {
    setIsCreatingChat(true);
    setHubError(null);

    try {
      const token = isSignedIn ? await getToken() : null;
      if (isSignedIn && !token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const created = await apiFetch<{ id: string }>("/api/v1/chats", {
        method: "POST",
        token,
        body: {},
      });

      router.push(`/chat?chat=${created.id}`);
    } catch (err) {
      setHubError(err instanceof Error ? err.message : "Could not start a new chat.");
    } finally {
      setIsCreatingChat(false);
    }
  }, [getToken, isSignedIn, router]);

  return (
    <HubShell
      sectionTitle="Hub"
      sectionDescription="Live widgets and chat stay on the front page. Setup now lives separately in the left menu."
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        {(hubError || preferencesError) ? (
          <div className="grid gap-3">
            {hubError ? (
              <div className="rounded-2xl border border-[#C8102E]/20 bg-white px-4 py-3 text-sm text-[#A90F24] shadow-sm">
                {hubError}
              </div>
            ) : null}
            {preferencesError ? (
              <div className="rounded-2xl border border-[#C8102E]/20 bg-white px-4 py-3 text-sm text-[#A90F24] shadow-sm">
                {preferencesError}
              </div>
            ) : null}
          </div>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#00247D]/10 bg-white/90 px-3 py-1 text-xs font-semibold text-[#00247D] shadow-sm">
              <MapPin size={13} />
              <span>{preferences.location?.label || "Area not set"}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#00247D]/10 bg-white/90 px-3 py-1 text-xs font-semibold text-[#00247D] shadow-sm">
              <Sparkles size={13} />
              <span>{widgetStatusLabel}</span>
            </span>
            {preferences.location?.source === "ip" ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 shadow-sm">
                Approximate area
              </span>
            ) : null}
          </div>

          <div className="hub-carousel -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0">
            {activeWidgets.length === 0 ? (
              <WidgetRailItem>
                <OnboardingCard hasLocation={Boolean(preferences.location)} />
              </WidgetRailItem>
            ) : (
              activeWidgets.map((widgetKey) => {
                let card: ReactNode = null;

                if (!preferences.location) {
                  card = <LocationRequiredCard widgetKey={widgetKey} />;
                } else if (widgetKey === "weather.local") {
                  card = <WeatherWidgetCard location={preferences.location} />;
                } else if (widgetKey === "news.local") {
                  card = <NewsWidgetCard location={preferences.location} />;
                }

                if (!card) {
                  return null;
                }

                return <WidgetRailItem key={widgetKey}>{card}</WidgetRailItem>;
              })
            )}
          </div>
        </section>

        <ChatLauncherCard
          chats={recentChats}
          isLoading={isHubLoading}
          isCreatingChat={isCreatingChat}
          onCreateChat={createChatAndOpen}
        />
      </div>
    </HubShell>
  );
}

function WidgetRailItem({ children }: { children: ReactNode }) {
  return <div className="min-w-[min(86vw,32rem)] snap-start md:min-w-0">{children}</div>;
}

function ChatLauncherCard({
  chats,
  isLoading,
  isCreatingChat,
  onCreateChat,
}: {
  chats: ChatSummary[];
  isLoading: boolean;
  isCreatingChat: boolean;
  onCreateChat: () => void;
}) {
  const primaryChat = chats[0];

  return (
    <section className="rounded-[1.9rem] border border-[#C2CFEC] bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(232,238,249,0.92))] p-5 shadow-[0_18px_46px_rgba(8,21,66,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase">Chat</p>
          <h2 className="mt-2 font-serif text-2xl text-[#081542]">Conversation launcher</h2>
          <p className="mt-3 max-w-lg text-sm text-[#4e618f]">
            Jump back into your latest conversation or open a fresh session directly from the hub.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-[#00247D] shadow-sm">
          <Sparkles size={18} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[#00247D]/12 bg-white/80 p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[#4e618f]">
            <LoaderCircle size={16} className="animate-spin" />
            <span>Loading recent chat history...</span>
          </div>
        ) : primaryChat ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-[#081542]">{primaryChat.title || "Untitled Chat"}</p>
              <p className="mt-1 text-sm text-[#4e618f]">{primaryChat.preview || "Continue where you left off."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/chat?chat=${primaryChat.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-[#00247D] px-4 py-2 text-sm font-semibold !text-white transition-colors hover:bg-[#001B54]"
              >
                <ArrowRight size={15} />
                <span>Open chat</span>
              </Link>
              <button
                type="button"
                onClick={onCreateChat}
                disabled={isCreatingChat}
                className="inline-flex items-center gap-2 rounded-full border border-[#00247D]/15 bg-white px-4 py-2 text-sm font-semibold text-[#00247D] transition-colors hover:bg-[#F4F7FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingChat ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}
                <span>New chat</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[#4e618f]">No saved chats yet. Start a conversation and it will appear here.</p>
            <button
              type="button"
              onClick={onCreateChat}
              disabled={isCreatingChat}
              className="inline-flex items-center gap-2 rounded-full bg-[#00247D] px-4 py-2 text-sm font-semibold !text-white transition-colors hover:bg-[#001B54] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingChat ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}
              <span>Start the first chat</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function OnboardingCard({
  hasLocation,
}: {
  hasLocation: boolean;
}) {
  return (
    <section className="h-full rounded-[1.9rem] border border-dashed border-[#C2CFEC] bg-white/92 p-6 shadow-[0_14px_34px_rgba(8,21,66,0.08)]">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase">Clean slate</p>
      <h2 className="mt-2 font-serif text-2xl text-[#081542]">No widgets are pinned to the hub yet</h2>
      <p className="mt-3 max-w-xl text-sm text-[#4e618f]">
        Keep the homepage focused. Use Setup from the left menu to choose the widgets you want here and to set the local area they should use.
      </p>
      <p className="mt-4 text-xs font-medium text-[#4e618f]">
        {hasLocation ? "Your local area is already saved." : "Your local area will be chosen in Setup as well."}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/widgets"
          className="inline-flex items-center gap-2 rounded-full bg-[#00247D] px-4 py-2 text-sm font-semibold !text-white transition-colors hover:bg-[#001B54]"
        >
          <Sparkles size={15} />
          <span>Open setup</span>
        </Link>
      </div>
    </section>
  );
}

function LocationRequiredCard({ widgetKey }: { widgetKey: WidgetKey }) {
  const widget = widgetRegistryMap.get(widgetKey);
  if (!widget) {
    return null;
  }

  const Icon = widget.icon;

  return (
    <section className="h-full rounded-[1.9rem] border border-dashed border-[#C2CFEC] bg-white/92 p-5 shadow-[0_14px_34px_rgba(8,21,66,0.08)]">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[#F8FAFF] p-3 text-[#00247D]">
          <Icon size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#081542]">{widget.title}</p>
          <p className="mt-1 text-sm text-[#4e618f]">This widget needs a local area. Set it in Setup before the card can render.</p>
        </div>
      </div>
      <Link
        href="/widgets"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#00247D] px-4 py-2 text-sm font-semibold !text-white transition-colors hover:bg-[#001B54]"
      >
        <Sparkles size={15} />
        <span>Open setup</span>
      </Link>
    </section>
  );
}

function WeatherWidgetCard({ location }: { location: WidgetLocationPreference }) {
  const [data, setData] = useState<WeatherWidgetData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError(null);

      try {
        const response = await apiFetch<WeatherWidgetData>(
          `/api/v1/widgets/weather?latitude=${encodeURIComponent(String(location.latitude))}&longitude=${encodeURIComponent(String(location.longitude))}&timezone=${encodeURIComponent(location.timezone)}`,
        );

        if (!cancelled) {
          setData(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load weather.");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [location.latitude, location.longitude, location.timezone]);

  return (
    <section className="h-full overflow-hidden rounded-[2rem] border border-[#C2CFEC] bg-white/92 p-5 shadow-[0_18px_46px_rgba(8,21,66,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase">Weather</p>
          <h2 className="mt-2 font-serif text-2xl text-[#081542]">{location.locality || location.label}</h2>
          <p className="mt-2 text-sm text-[#4e618f]">
            Current conditions plus the next five days for your selected area.
          </p>
        </div>
        <div className="rounded-2xl bg-[#F8FAFF] p-3 text-[#00247D]">
          <WeatherGlyph weatherCode={data?.current.weatherCode ?? 1} isDay={data?.current.isDay ?? true} size={22} />
        </div>
      </div>

      {error ? (
        <p className="mt-5 rounded-2xl border border-[#C8102E]/15 bg-[#FFF7F8] px-4 py-3 text-sm text-[#A90F24]">{error}</p>
      ) : !data ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-[#4e618f]">
          <LoaderCircle size={16} className="animate-spin" />
          <span>Loading forecast...</span>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <WeatherSceneCard data={data} location={location} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {data.forecast.map((day) => (
              <div key={day.date} className="rounded-[1.35rem] border border-[#00247D]/10 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold text-[#081542]">{formatDayLabel(day.date)}</p>
                <div className="mt-3 flex items-center gap-2 text-[#00247D]">
                  <WeatherGlyph weatherCode={day.weatherCode} isDay size={16} />
                  <span className="text-xs text-[#4e618f]">{day.condition}</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-[#081542]">
                  {Math.round(day.maxTemperatureC)}&deg; / {Math.round(day.minTemperatureC)}&deg;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function NewsWidgetCard({ location }: { location: WidgetLocationPreference }) {
  const [data, setData] = useState<NewsWidgetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError(null);

      try {
        const response = await apiFetch<NewsWidgetData>(
          `/api/v1/widgets/news?locality=${encodeURIComponent(location.locality)}&principalSubdivision=${encodeURIComponent(location.principalSubdivision)}&countryCode=${encodeURIComponent(location.countryCode)}&refresh=${refreshNonce > 0 ? "true" : "false"}`,
        );

        if (!cancelled) {
          setData(response);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load headlines.");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [location.countryCode, location.locality, location.principalSubdivision, refreshNonce]);

  return (
    <section className="h-full rounded-[2rem] border border-[#C2CFEC] bg-white/92 p-5 shadow-[0_18px_46px_rgba(8,21,66,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase">News</p>
          <h2 className="mt-2 font-serif text-2xl text-[#081542]">{location.locality || location.label}</h2>
          <p className="mt-2 text-sm text-[#4e618f]">
            Local headlines when available, with a country fallback if the area is too quiet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshNonce((value) => value + 1)}
          className="inline-flex items-center gap-2 rounded-full border border-[#00247D]/15 bg-white px-3 py-2 text-xs font-semibold text-[#00247D] transition-colors hover:bg-[#F4F7FF]"
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {error ? (
        <p className="mt-5 rounded-2xl border border-[#C8102E]/15 bg-[#FFF7F8] px-4 py-3 text-sm text-[#A90F24]">{error}</p>
      ) : !data ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-[#4e618f]">
          <LoaderCircle size={16} className="animate-spin" />
          <span>Loading headlines...</span>
        </div>
      ) : !data.isAvailable ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {data.message || "News is unavailable right now."}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#F8FAFF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#00247D]">
              {data.mode === "local-search" ? "Local search" : "Country fallback"}
            </span>
            <span className="text-xs text-[#4e618f]">{data.queryLabel}</span>
          </div>

          {data.message ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {data.message}
            </div>
          ) : null}

          <div className="grid gap-3">
            {data.headlines.slice(0, 5).map((headline) => (
              <a
                key={`${headline.url}-${headline.publishedAtUtc}`}
                href={headline.url}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-2xl border border-[#00247D]/10 bg-[#F8FAFF] px-4 py-4 transition-colors hover:bg-white"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-3 text-[#00247D] shadow-sm">
                    <Newspaper size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-[#081542]">{headline.title}</p>
                    {headline.description ? (
                      <p className="mt-2 text-sm text-[#4e618f]">{headline.description}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#4e618f]">
                      <span>{headline.source}</span>
                      <span>&middot;</span>
                      <span>{formatRelativeTime(headline.publishedAtUtc)}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function WeatherSceneCard({
  data,
  location,
}: {
  data: WeatherWidgetData;
  location: WidgetLocationPreference;
}) {
  const scene = getWeatherSceneTone(data.current.weatherCode, data.current.isDay);

  return (
    <div className={`relative overflow-hidden rounded-[1.8rem] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.26)] ${scene.panelClass}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.42),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02))]" />
      <div className={`weather-orb absolute right-6 top-6 h-16 w-16 rounded-full ${scene.orbClass}`} />
      <div className="weather-cloud weather-cloud-slow absolute left-6 top-10 h-10 w-28 rounded-full bg-white/28" />
      <div className="weather-cloud weather-cloud-fast absolute top-[6.5rem] right-[4.5rem] h-9 w-24 rounded-full bg-white/18" />
      <div className="weather-cloud weather-cloud-slow absolute bottom-14 left-[4.5rem] h-7 w-20 rounded-full bg-white/18" />
      {scene.precipitation === "rain" ? <RainStreaks /> : null}
      {scene.precipitation === "snow" ? <SnowDots /> : null}

      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-white/72 uppercase">Now</p>
          <div className="mt-4 flex items-end gap-3">
            <span className="font-serif text-6xl leading-none">{Math.round(data.current.temperatureC)}&deg;</span>
            <div className="pb-2">
              <p className="text-base font-semibold text-white">{data.current.condition}</p>
              <p className="mt-1 text-xs text-white/76">Feels like {Math.round(data.current.apparentTemperatureC)}&deg;</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-white/18 bg-white/12 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-white/92">
            <Wind size={15} />
            <span>{Math.round(data.current.windSpeedKph)} km/h wind</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-white/80">
            <WeatherGlyph weatherCode={data.current.weatherCode} isDay={data.current.isDay} size={16} />
            <span>{location.locality || location.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RainStreaks() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[16, 31, 47, 61, 73, 86].map((left, index) => (
        <span
          key={left}
          className="weather-rain-streak absolute top-12 h-16 w-px rounded-full bg-white/68"
          style={{ left: `${left}%`, animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </div>
  );
}

function SnowDots() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[14, 25, 38, 52, 67, 79, 91].map((left, index) => (
        <span
          key={left}
          className="weather-snow-dot absolute top-10 h-2.5 w-2.5 rounded-full bg-white/78"
          style={{ left: `${left}%`, animationDelay: `${index * 0.45}s` }}
        />
      ))}
    </div>
  );
}

function getWeatherSceneTone(weatherCode: number, isDay: boolean) {
  if (!isDay) {
    return {
      panelClass: "bg-[linear-gradient(145deg,#102158_0%,#18367f_45%,#2b4ea4_100%)]",
      orbClass: "bg-[radial-gradient(circle,#dbe8ff_0%,rgba(219,232,255,0.28)_58%,transparent_72%)]",
      precipitation: "none" as const,
    };
  }

  if ([61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode)) {
    return {
      panelClass: "bg-[linear-gradient(145deg,#2750a2_0%,#4068c2_42%,#5f84dd_100%)]",
      orbClass: "bg-[radial-gradient(circle,#fff9d6_0%,rgba(255,249,214,0.34)_54%,transparent_72%)]",
      precipitation: "rain" as const,
    };
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return {
      panelClass: "bg-[linear-gradient(145deg,#6f8ec7_0%,#8aa6dd_45%,#b1c5f2_100%)]",
      orbClass: "bg-[radial-gradient(circle,#ffffff_0%,rgba(255,255,255,0.3)_58%,transparent_76%)]",
      precipitation: "snow" as const,
    };
  }

  if ([1, 2, 3, 45, 48].includes(weatherCode)) {
    return {
      panelClass: "bg-[linear-gradient(145deg,#4d74c2_0%,#6b90db_45%,#8fb0f0_100%)]",
      orbClass: "bg-[radial-gradient(circle,#fff4c4_0%,rgba(255,244,196,0.34)_56%,transparent_74%)]",
      precipitation: "none" as const,
    };
  }

  return {
    panelClass: "bg-[linear-gradient(145deg,#3072d3_0%,#5d97f0_45%,#88b6ff_100%)]",
    orbClass: "bg-[radial-gradient(circle,#ffe082_0%,rgba(255,224,130,0.38)_52%,transparent_72%)]",
    precipitation: "none" as const,
  };
}

function WeatherGlyph({
  weatherCode,
  isDay,
  size,
}: {
  weatherCode: number;
  isDay: boolean;
  size: number;
}) {
  if (weatherCode === 0) {
    return isDay ? <SunMedium size={size} /> : <CloudSun size={size} />;
  }

  if ([1, 2].includes(weatherCode)) {
    return <CloudSun size={size} />;
  }

  if ([61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode)) {
    return <CloudRain size={size} />;
  }

  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return <CloudSnow size={size} />;
  }

  return <Cloud size={size} />;
}

function formatDayLabel(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date);
}

function formatRelativeTime(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  return formatter.format(Math.round(diffHours / 24), "day");
}
