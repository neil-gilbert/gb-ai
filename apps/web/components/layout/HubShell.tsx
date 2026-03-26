"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";
import { House, Menu, Settings2, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

type HubShellProps = {
  children: ReactNode;
  sectionTitle: string;
  sectionDescription: string;
};

type NavigationItem = {
  href: string;
  label: string;
  detail: string;
  icon: typeof House;
  matches: (pathname: string) => boolean;
};

const navigationItems: NavigationItem[] = [
  {
    href: "/",
    label: "Hub",
    detail: "live board",
    icon: House,
    matches: (pathname) => pathname === "/",
  },
  {
    href: "/chat",
    label: "Chat",
    detail: "conversations",
    icon: Sparkles,
    matches: (pathname) => pathname.startsWith("/chat"),
  },
  {
    href: "/widgets",
    label: "Setup",
    detail: "widgets and area",
    icon: Settings2,
    matches: (pathname) => pathname.startsWith("/widgets"),
  },
];

export default function HubShell({ children, sectionTitle, sectionDescription }: HubShellProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const activeItem = useMemo(
    () => navigationItems.find((item) => item.matches(pathname)) ?? navigationItems[0],
    [pathname],
  );

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isSidebarOpen]);

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_left,rgba(207,20,43,0.08),transparent_34%),linear-gradient(180deg,#f5f7ff_0%,#eaf0ff_100%)] text-[#102158]">
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-20 bg-slate-900/30 backdrop-blur-[1px] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <div className="mx-auto flex min-h-dvh max-w-[1480px]">
        <aside
          className={`fixed inset-y-0 left-0 z-30 flex w-[290px] max-w-[calc(100vw-2rem)] flex-col border-r border-[#C2CFEC] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,244,255,0.96))] shadow-xl shadow-blue-900/10 transition-transform duration-300 md:sticky md:top-0 md:h-dvh md:translate-x-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-[120%]"
          }`}
        >
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#00247D] via-[#C8102E] to-[#00247D]" />

          <div className="px-6 pt-7">
            <div className="relative h-12 w-36">
              <Image src="/LogoTransp.png" alt="gb-ai" fill className="object-contain object-left" />
            </div>
            <div className="mt-6 rounded-[1.6rem] border border-white/80 bg-white/85 p-4 shadow-[0_18px_40px_rgba(8,21,66,0.08)]">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-[#4e618f] uppercase">Current area</p>
              <h2 className="mt-2 font-serif text-2xl text-[#081542]">{sectionTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[#4e618f]">{sectionDescription}</p>
            </div>
          </div>

          <nav className="mt-6 grid gap-2 px-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === activeItem.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`group flex items-center gap-3 rounded-[1.3rem] px-4 py-3 transition-all duration-200 ${
                    isActive
                      ? "bg-[#00247D] text-white shadow-[0_14px_30px_rgba(0,36,125,0.18)]"
                      : "bg-white/70 text-[#17306f] hover:bg-white"
                  }`}
                >
                  <div className={`rounded-2xl p-2.5 ${isActive ? "bg-white/16" : "bg-[#F4F7FF] text-[#00247D]"}`}>
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className={`text-xs ${isActive ? "text-white/72" : "text-[#4e618f]"}`}>{item.detail}</p>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="mx-4 mt-6 rounded-[1.6rem] border border-[#00247D]/10 bg-[#F8FAFF] p-4">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase">Why this split</p>
            <p className="mt-2 text-sm leading-6 text-[#4e618f]">
              The hub stays focused on live cards and chat. Setup is where widget choices and local area changes belong.
            </p>
          </div>

          <div className="mt-auto px-4 pb-4">
            <SignedIn>
              <div className="flex items-center gap-3 rounded-[1.4rem] border border-[#00247D]/10 bg-white px-4 py-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#081542]">Account</p>
                  <p className="text-xs text-[#4e618f]">Signed in</p>
                </div>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "h-9 w-9",
                      userButtonTrigger: "focus:shadow-none",
                    },
                  }}
                />
              </div>
            </SignedIn>
            <SignedOut>
              <div className="grid grid-cols-2 gap-2">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="rounded-[1rem] border border-[#00247D]/18 bg-white px-3 py-2.5 text-xs font-semibold text-[#00247D] transition-colors hover:bg-[#F4F7FF]"
                  >
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="rounded-[1rem] bg-[#00247D] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#001B54]"
                  >
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-6">
          <div className="mb-4 flex items-center justify-between rounded-[1.4rem] border border-[#C2CFEC] bg-white/85 px-4 py-3 shadow-sm md:hidden">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F7FF] text-[#00247D]"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <div className="text-right">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-[#4e618f] uppercase">GB-AI</p>
              <p className="text-sm font-semibold text-[#081542]">{activeItem.label}</p>
              <p className="text-xs text-[#4e618f]">{activeItem.detail}</p>
            </div>
            <div className="h-10 w-10" aria-hidden="true" />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
