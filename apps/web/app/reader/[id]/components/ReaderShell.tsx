"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Reader workbench shell.
 *
 * Layout / interaction ideas (narrow activity bar that switches toggleable side
 * panels, plus a mobile bottom toolbar) are inspired by the AGPL-3.0 project Flow
 * (https://github.com/pacexy/flow). This is a clean-room, hand-written equivalent —
 * no Flow source was copied. See docs/third-party-flow-reader-shell.md.
 *
 * Important: this shell must never place a CSS transform/filter on an ancestor of the
 * fixed-positioned TokenPopup / HighlightMenu (which live as siblings of the shell),
 * otherwise their viewport-relative `position: fixed` would break. Only sticky /
 * overflow are used here, which do not create a containing block for fixed elements.
 */

export type ReaderPanelKey = "search" | "highlights" | "typography" | "theme";

export interface ReaderActivityItem {
  key: string;
  label: string;
  icon: ReactNode;
  kind: "panel" | "link";
  panelKey?: ReaderPanelKey;
  href?: string;
  badge?: number;
  testId?: string;
}

export interface ReaderPanelDef {
  key: ReaderPanelKey;
  title: string;
  content: ReactNode;
}

interface ReaderShellProps {
  items: ReaderActivityItem[];
  panels: ReaderPanelDef[];
  activePanel: ReaderPanelKey | null;
  onSelectPanel: (key: ReaderPanelKey | null) => void;
  children: ReactNode;
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const railButtonBase =
  "relative flex flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

function ActivityBadge({ count }: { count?: number }) {
  if (!count || count <= 0) {
    return null;
  }
  return (
    <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold leading-4 text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function ReaderShell({ items, panels, activePanel, onSelectPanel, children }: ReaderShellProps) {
  const renderActivityButton = (item: ReaderActivityItem, layout: "rail" | "bar") => {
    const active = item.kind === "panel" && item.panelKey === activePanel;
    // Desktop rail keeps the canonical reader-activity-* test ids; the mobile toolbar
    // renders the same items, so it must use distinct ids to avoid Playwright strict-mode
    // duplicate matches even while the toolbar is hidden.
    const testId = layout === "rail" ? item.testId : `reader-mobile-activity-${item.key}`;
    const sizing = layout === "rail" ? "h-12 w-12" : "h-full min-w-0 flex-1 py-1.5";
    const stateClasses = active
      ? "bg-white text-brand-700 shadow-sm dark:bg-zinc-800 dark:text-brand-100"
      : "text-zinc-500 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100";

    const inner = (
      <>
        <span className="relative grid h-5 w-5 place-items-center" aria-hidden="true">
          {item.icon}
          <ActivityBadge count={item.badge} />
        </span>
        <span className="leading-none">{item.label}</span>
      </>
    );

    if (item.kind === "link" && item.href) {
      return (
        <Link
          key={item.key}
          href={item.href}
          data-testid={testId}
          title={item.label}
          aria-label={item.label}
          className={cn(railButtonBase, sizing, stateClasses)}
        >
          {inner}
        </Link>
      );
    }

    return (
      <button
        key={item.key}
        type="button"
        data-testid={testId}
        title={item.label}
        aria-label={item.label}
        aria-pressed={active}
        onClick={() => item.panelKey && onSelectPanel(active ? null : item.panelKey)}
        className={cn(railButtonBase, sizing, stateClasses)}
      >
        {inner}
      </button>
    );
  };

  return (
    <>
      <div className="flex min-h-[calc(100dvh_-_7rem)] w-full items-stretch">
        {/* Desktop activity rail */}
        <nav
          aria-label="阅读器工具"
          data-testid="reader-activity-bar"
          className="sticky top-20 hidden h-[calc(100dvh_-_7rem)] w-16 shrink-0 flex-col items-center gap-1 rounded-l-2xl border border-stone-200 bg-stone-50/70 py-3 dark:border-zinc-800 dark:bg-zinc-950/40 md:flex"
        >
          {items.map((item) => renderActivityButton(item, "rail"))}
        </nav>

        {/* Side panel drawer — always mounted so panel content (e.g. highlight-list)
            stays in the DOM even when collapsed. */}
        <aside
          data-testid="reader-side-panel"
          data-open={activePanel ? "true" : "false"}
          className={cn(
            activePanel
              ? "fixed inset-x-0 bottom-14 top-0 z-40 flex flex-col overflow-hidden border-stone-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 md:sticky md:top-20 md:bottom-auto md:z-auto md:h-[calc(100dvh_-_7rem)] md:w-80 md:shrink-0 md:border-y md:border-l-0 md:border-r md:shadow-none"
              : "hidden"
          )}
        >
          {panels.map((panel) => (
            <div
              key={panel.key}
              className={cn(
                "min-h-0 flex-1 flex-col",
                activePanel === panel.key ? "flex" : "hidden"
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{panel.title}</h2>
                <button
                  type="button"
                  aria-label="关闭面板"
                  className="rounded-md p-1 text-zinc-400 hover:bg-stone-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  onClick={() => onSelectPanel(null)}
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{panel.content}</div>
            </div>
          ))}
        </aside>

        {/* Main reading column */}
        <div className="min-w-0 flex-1 pb-24 md:pb-6 md:pl-6">{children}</div>
      </div>

      {/* Mobile bottom toolbar (mirrors the activity rail) */}
      <nav
        aria-label="阅读器工具"
        data-testid="reader-mobile-toolbar"
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch justify-around border-t border-stone-200 bg-stone-50/95 px-1 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90 md:hidden"
      >
        {items.map((item) => renderActivityButton(item, "bar"))}
      </nav>
    </>
  );
}

/* --- Lightweight inline icons (currentColor stroke). --- */

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z" />
      <path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

export function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h12v16l-6-4-6 4z" />
    </svg>
  );
}

export function TypographyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V5h11v2" />
      <path d="M9.5 5v14" />
      <path d="M7.5 19h4" />
      <path d="M15 13v-1.5h6V13" />
      <path d="M18 11.5V19" />
      <path d="M16.5 19h3" />
    </svg>
  );
}

export function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16a8 8 0 0 0 0-16z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function VocabIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9h5M8 13h8M8 17h4" />
    </svg>
  );
}
