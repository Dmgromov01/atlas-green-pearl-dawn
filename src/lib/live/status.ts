import { create } from "zustand";
import type { LiveStatus, LiveTag } from "./tags";

type LiveState = {
  status: LiveStatus;
  lastTag?: LiveTag;
  at?: number;
};

export const useLive = create<LiveState>(() => ({ status: "off" }));
