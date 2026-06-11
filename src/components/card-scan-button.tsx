"use client";

import { Camera } from "lucide-react";
import { useRef } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { useTranslations } from "@/lib/i18n/context";
import { useOffline } from "@/lib/offline/offline-provider";
import { prepareScanImage } from "@/lib/scan-image.client";
import { cn } from "@/lib/utils";

type CardScanButtonProps = {
  disabled?: boolean;
  onScanStart?: () => void;
  onScanComplete?: (file: File) => void;
  onScanError?: (error: unknown) => void;
  className?: string;
};

export function CardScanButton({
  disabled = false,
  onScanStart,
  onScanComplete,
  onScanError,
  className,
}: CardScanButtonProps) {
  const t = useTranslations();
  const { isOfflineView } = useOffline();
  const inputRef = useRef<HTMLInputElement>(null);
  const isDisabled = disabled || isOfflineView;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) {
            return;
          }

          onScanStart?.();
          try {
            const prepared = await prepareScanImage(file);
            onScanComplete?.(prepared);
          } catch (error) {
            onScanError?.(error);
          }
        }}
      />
      <IconButton
        type="button"
        variant="subtle"
        className={cn("h-12 w-12 rounded-2xl border border-white/10", className)}
        disabled={isDisabled}
        aria-label={t("search.scanButton")}
        title={isOfflineView ? t("offline.navDisabled") : t("search.scanButton")}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="h-5 w-5" />
      </IconButton>
    </>
  );
}
