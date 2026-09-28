"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import Card from "@/components/studio/ui/Card";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { PLACEHOLDER_ART_PATTERN } from "@/components/studio/ui/Thumbnail";
import { cn } from "@/utils/cn";

interface Destination {
  id: string;
  title: string;
  meta: string;
}

const DESTINATIONS: Destination[] = [
  { id: "public", title: "Public link", meta: "VIEW + PRINT" },
  { id: "classroom", title: "Classroom pack", meta: "30 COPIES" },
  { id: "print-on-demand", title: "Print-on-demand PDF", meta: "CMYK" },
];

export interface PublishScreenProps {
  bookTitle?: string;
  pageCount?: number;
  url?: string;
}

/** 1k: publish, restyled to the light shell. */
export default function PublishScreen({ bookTitle = "Forest Friends", pageCount = 24, url = "pagewright.app/b/forest-friends" }: PublishScreenProps) {
  const [destination, setDestination] = useState(DESTINATIONS[0].id);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (permissions, non-secure context) — fails silently rather than throwing in the UI; "Copy" just doesn't confirm.
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-panel bg-panel p-5 shadow-panel" style={{ width: 460 }}>
      <div>
        <p className="text-modal-title font-semibold tracking-[-0.02em] text-ink">Publish {bookTitle}</p>
        <MetaLabel>{pageCount} pages · Preflight passed</MetaLabel>
      </div>

      <Card className="flex items-center gap-3 p-3.5">
        <div className="h-16 w-14 shrink-0 rounded-paper-sm" style={{ backgroundImage: PLACEHOLDER_ART_PATTERN }} />
        <div className="flex-1">
          <p className="text-body font-medium text-ink">Cover & listing</p>
          <p className="mt-0.5 text-helper text-ink-secondary">Twelve calm forest scenes with thick, crayon-friendly outlines. Ages 4-8.</p>
          <button type="button" className="mt-1 text-helper font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            Edit listing
          </button>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <MetaLabel>Where</MetaLabel>
        {DESTINATIONS.map((dest) => {
          const active = dest.id === destination;
          return (
            <button
              key={dest.id}
              type="button"
              onClick={() => setDestination(dest.id)}
              className={cn(
                "flex items-center justify-between rounded-row-sm border px-3.5 py-2.5 text-left outline-none transition-colors duration-150 motion-reduce:transition-none",
                "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                active ? "border-accent bg-accent-tint" : "border-hairline hover:bg-inset-alt"
              )}
            >
              <span className="flex items-center gap-2.5">
                <span className={cn("h-3.5 w-3.5 shrink-0 rounded-pill border-2", active ? "border-accent" : "border-hairline")}>
                  {active && <span className="block h-full w-full scale-50 rounded-pill bg-accent" />}
                </span>
                <span className="text-body font-medium text-ink">{dest.title}</span>
              </span>
              <MetaLabel>{dest.meta}</MetaLabel>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 rounded-row-sm bg-inset-alt px-3.5 py-2.5">
        <p className="flex-1 truncate text-helper text-ink-secondary">{url}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-pill bg-panel px-2.5 py-1 text-helper font-medium text-ink shadow-resting outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <Copy size={11} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary">Save draft</Button>
        <Button variant="primary">Publish</Button>
      </div>
    </div>
  );
}
