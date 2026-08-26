import type { LucideIcon } from "lucide-react";

export type HubModuleId =
  | "home"
  | "digest"
  | "fun"
  | "translate"
  | "tasks"
  | "calendar"
  | "rates"
  | "passwords"
  | "settings"
  | "admin"
  | "chat"
  | "inbox";

export type HubModule = {
  id: HubModuleId;
  title: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
  path: string;
  showInTabBar: boolean;
  showOnHome: boolean;
  order: number;
};

/** Plug-in slot: RSS today, Telegram/JSON later without UI rewrites. */
export type DigestFetcher = {
  type: DigestSourceType;
  fetch: (source: DigestSource) => Promise<{ text: string; date?: string }[]>;
};

export type City = {
  name: string;
  lat: number;
  lon: number;
  tz: string;
  country?: string;
};

export type DigestSourceType = "rss" | "tg";

export type DigestSource = {
  id: string;
  type: DigestSourceType;
  name: string;
  title: string;
  enabled: boolean;
};

export type RepeatRule = "none" | "daily" | "weekdays" | "weekly";

export type TaskItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  dueAt?: number | null;
  repeat?: RepeatRule;
  shared?: boolean;
  ownerName?: string;
};

export type InboxNote = {
  id: string;
  text: string;
  createdAt: number;
  shared?: boolean;
  ownerName?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
};

export type DictEntry = {
  id: string;
  src: string;
  dst: string;
  pair: string;
  createdAt: number;
};

export type CalEvent = {
  id: string;
  start: string;
  end?: string;
  summary: string;
  location?: string;
  source: "local" | "holiday" | "google" | "ics" | "shared";
  allDay?: boolean;
  shared?: boolean;
  ownerName?: string;
  googleEventId?: string;
  googleCalId?: string;
  icloudHref?: string;
};

export type CalendarProvider = {
  id: string;
  label: string;
  readonly: boolean;
  fetchRange: (fromIso: string, toIso: string) => Promise<CalEvent[]>;
  create?: (event: Omit<CalEvent, "id" | "source">) => Promise<CalEvent>;
  remove?: (id: string) => Promise<void>;
};
