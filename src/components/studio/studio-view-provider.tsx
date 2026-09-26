"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type StudioView = "studio" | "tracks" | "mixer" | "settings";
type StudioViewState = {
  view: StudioView;
  setView: (view: StudioView) => void;
  inputOpen: boolean;
  setInputOpen: (open: boolean) => void;
};
const StudioViewContext = createContext<StudioViewState | null>(null);

export function StudioViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<StudioView>("studio");
  const [inputOpen, setInputOpen] = useState(false);
  const value = useMemo(() => ({ view, setView, inputOpen, setInputOpen }), [view, inputOpen]);
  return <StudioViewContext value={value}>{children}</StudioViewContext>;
}

export function useStudioView() {
  const context = useContext(StudioViewContext);
  if (!context) throw new Error("StudioViewProvider is required");
  return context;
}
