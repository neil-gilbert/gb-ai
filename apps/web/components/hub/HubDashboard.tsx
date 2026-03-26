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
  Settings2,
  Sparkles,
  SunMedium,
  Wind,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import HubShell from "@/components/layout/HubShell";
import { apiFetch } from "@/lib/api";
import { buildGreetingText } from "@/lib/greeting";
import { useHubPreferences } from "@/lib/useHubPreferences";
import type {
  ChatSummary,
  NewsWidgetData,
  WidgetKey,
  WidgetLocationPreference,
  WeatherWidgetData,
} from "@/lib/types";
import { widgetRegistryMap } from "@/lib/widgets/registry";

type HubProfileResponse = {
  user: {
    email: string;
    isGuest?: boolean;
  };
};

export default function HubDashboard() {
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { preferences, error: preferencesError } = useHubPreferences();
  const [profile, setProfile] = useState<HubProfileResponse | null>(null);
  const [recentChats, setRecentChats] = useState<ChatSummary[]>([]);
  const [isHubLoading, setIsHubLoading] = useState(true);
  const [hubError, setHubError] = useState<string | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const greetingText = useMemo(
    () => buildGreetingText(profile?.user.isGuest ? undefined : profile?.user.email),
    [profile?.user.email, profile?.user.isGuest],
  );
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

        const [profileData, chatsData] = await Promise.all([
          apiFetch<HubProfileResponse>("/api/v1/auth/me", { token }),
          apiFetch<{ items: ChatSummary[] }>("/api/v1/chats", { token }),
        ]);

        if (!cancelled) {
          setProfile(profileData);
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
        <header className="rounded-[2rem] border border-[#C2CFEC] bg-white/88 px-5 py-5 shadow-[0_18px_50px_rgba(8,21,66,0.12)] backdrop-blur md:px-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-[#4e618f] uppercase">GB-AI Home</p>
              <h1 className="mt-2 font-serif text-3xl text-[#081542] md:text-4xl">{greetingText}</h1>
              <p className="mt-3 max-w-2xl text-sm text-[#4e618f] md:text-base">
                Your front page is now reserved for the live board: local widgets on one side, your conversation launcher on the other.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#00247D]/10 bg-[#F8FAFF] px-3 py-1 text-xs font-semibold text-[#00247D]">
                  <MapPin size={13} />
                  <span>{preferences.location?.label || "Area not set"}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#00247D]/10 bg-[#F8FAFF] px-3 py-1 text-xs font-semibold text-[#00247D]">
                  <Sparkles size={13} />
                  <span>{widgetStatusLabel}</span>
                </span>
                {preferences.location?.source === "ip" ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                    Approximate area
                  </span>
                ) : null}
              </div>
            </div>

            <div className="max-w-sm rounded-[1.6rem] border border-[#00247D]/10 bg-[#F8FAFF] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-3 text-[#00247D] shadow-sm">
                  <Settings2 size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase">Setup moved</p>
                  <p className="mt-2 text-sm leading-6 text-[#4e618f]">
                    Widget selection, ordering, and local area settings now live in the dedicated setup area from the left menu.
                  </p>
                </div>
              </div>
              <Link
                href="/chat"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#00247D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#001B54]"
              >
                <Sparkles size={15} />
                <span>Open chat</span>
              </Link>
            </div>
          </div>
        </header>

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

        <section className="grid gap-4 lg:grid-cols-4">
          <ChatLauncherCard
            chats={recentChats}
            isLoading={isHubLoading}
            isCreatingChat={isCreatingChat}
            onCreateChat={createChatAndOpen}
          />

          {activeWidgets.length === 0 ? (
            <OnboardingCard hasLocation={Boolean(preferences.location)} />
          ) : (
            activeWidgets.map((widgetKey) => {
              if (!preferences.location) {
                return <LocationRequiredCard key={widgetKey} widgetKey={widgetKey} />;
              }

              if (widgetKey === "weather.local") {
                return <WeatherWidgetCard key={widgetKey} location={preferences.location} />;
              }

              if (widgetKey === "news.local") {
                return <NewsWidgetCard key={widgetKey} location={preferences.location} />;
              }

              return null;
            })
          )}
        </section>
      </div>
    </HubShell>
  );
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
    <section className="rounded-[1.75rem] border border-[#C2CFEC] bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(232,238,249,0.92))] p-5 shadow-[0_18px_46px_rgba(8,21,66,0.12)] lg:col-span-2">
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
                className="inline-flex items-center gap-2 rounded-full bg-[#00247D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#001B54]"
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
              className="inline-flex items-center gap-2 rounded-full bg-[#00247D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#001B54] disabled:cursor-not-allowed disabled:opacity-60"
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
    <section className="rounded-[1.75rem] border border-dashed border-[#C2CFEC] bg-white/92 p-6 shadow-[0_14px_34px_rgba(8,21,66,0.08)] lg:col-span-2">
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
          className="inline-flex items-center gap-2 rounded-full bg-[#00247D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#001B54]"
        >
          <Settings2 size={15} />
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
    <section className={`rounded-[1.75rem] border border-dashed border-[#C2CFEC] bg-white/92 p-5 shadow-[0_14px_34px_rgba(8,21,66,0.08)] ${widget.desktopSpan} ${widget.mobileSpan}`}>
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
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#00247D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#001B54]"
      >
        <Settings2 size={15} />
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
    <section className="rounded-[1.75rem] border border-[#C2CFEC] bg-white/92 p-5 shadow-[0_18px_46px_rgba(8,21,66,0.12)] lg:col-span-2">
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
        <div className="mt-6 grid gap-4 md:grid-cols-[1.1fr_1.4fr]">
          <div className="rounded-2xl bg-[#F8FAFF] p-4">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase">Now</p>
            <div className="mt-3 flex items-end gap-3">
              <span className="font-serif text-5xl text-[#081542]">{Math.round(data.current.temperatureC)}&deg;</span>
              <span className="pb-2 text-sm text-[#4e618f]">{data.current.condition}</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-[#4e618f]">
              <div className="flex items-center gap-2">
                <CloudSun size={15} className="text-[#00247D]" />
                <span>Feels like {Math.round(data.current.apparentTemperatureC)}&deg;</span>
              </div>
              <div className="flex items-center gap-2">
                <Wind size={15} className="text-[#00247D]" />
                <span>{Math.round(data.current.windSpeedKph)} km/h wind</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            {data.forecast.map((day) => {
              return (
                <div key={day.date} className="rounded-2xl border border-[#00247D]/10 bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold text-[#081542]">{formatDayLabel(day.date)}</p>
                  <div className="mt-3 flex items-center gap-2 text-[#00247D]">
                    <WeatherGlyph weatherCode={day.weatherCode} isDay size={16} />
                    <span className="text-xs text-[#4e618f]">{day.condition}</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[#081542]">
                    {Math.round(day.maxTemperatureC)}&deg; / {Math.round(day.minTemperatureC)}&deg;
                  </p>
                </div>
              );
            })}
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
    <section className="rounded-[1.75rem] border border-[#C2CFEC] bg-white/92 p-5 shadow-[0_18px_46px_rgba(8,21,66,0.12)] lg:col-span-2">
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
