"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import Link from "next/link";

import { RadarMark } from "@/components/public/site-logo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SITE_NAME } from "@/lib/brand";
import {
  acceptAllConsent,
  clientHasGpc,
  CONSENT_CHANGE_EVENT,
  defaultConsent,
  OPEN_PRIVACY_SETTINGS_EVENT,
  rejectNonEssentialConsent,
  type ConsentRegion,
  type ConsentState,
} from "@/lib/consent";
import { cn } from "@/lib/utils";

interface PrivacyConsentProps {
  region: ConsentRegion;
  initialConsent: ConsentState | null;
  gpc: boolean;
}

export function PrivacyConsent({ region, initialConsent, gpc }: PrivacyConsentProps) {
  const [consent, setConsent] = useState(initialConsent);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentState>(() => initialConsent ?? defaultConsent(region, gpc));
  const [saving, setSaving] = useState(false);
  const bannerVisible = consent === null;

  useEffect(() => {
    function openSettings() {
      setDraft(consent ?? defaultConsent(region, gpc || clientHasGpc()));
      setSettingsOpen(true);
    }

    window.addEventListener(OPEN_PRIVACY_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(OPEN_PRIVACY_SETTINGS_EVENT, openSettings);
  }, [consent, region, gpc]);

  async function persist(next: ConsentState) {
    setSaving(true);

    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analytics: next.analytics, doNotSell: next.doNotSell }),
        keepalive: true,
      });
    } catch {
      // UI still reflects the choice; the next page load re-reads the cookie if it landed.
    }

    setConsent(next);
    setDraft(next);
    setSettingsOpen(false);
    setSaving(false);
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: next }));
  }

  function openSettingsFromBanner() {
    setDraft(consent ?? defaultConsent(region, gpc || clientHasGpc()));
    setSettingsOpen(true);
  }

  return (
    <>
      {bannerVisible ? (
        <div
          role="region"
          aria-label="Privacy notice"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 shadow-[0_-12px_40px_oklch(0.2_0.02_55_/_0.08)] backdrop-blur-md"
        >
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_12.5rem] lg:items-start lg:gap-10 lg:py-6">
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p className="font-heading text-base font-bold text-foreground">Privacy Notice</p>
              {region === "eu" ? <EuBannerCopy /> : <UsBannerCopy />}
            </div>

            <div className="hidden space-y-2 text-sm leading-relaxed text-muted-foreground lg:block">
              <p className="font-heading text-base font-bold text-foreground">Ways we may use your data</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Remember this privacy choice on your device</li>
                <li>Keep the site secure and send you to a retailer you click</li>
                <li>Measure visits and product interest with first-party analytics cookies</li>
                {region === "us" ? (
                  <li>California residents can opt out of the “sale” or “sharing” of personal information</li>
                ) : null}
              </ul>
              <p>
                Retailers such as Amazon and eBay set their own cookies after you click through.{" "}
                <Link href="/privacy#cookies" className="underline underline-offset-2 hover:text-foreground">
                  Cookie Policy
                </Link>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button size="cta" className="w-full" disabled={saving} onClick={() => persist(acceptAllConsent())}>
                Accept
              </Button>
              <Button
                size="cta"
                className="w-full"
                disabled={saving}
                onClick={() => persist(rejectNonEssentialConsent())}
              >
                Reject Non-Essential
              </Button>
              <Button size="cta" variant="outline" className="w-full" disabled={saving} onClick={openSettingsFromBanner}>
                Manage Settings
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <PrivacyCenter
        region={region}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        draft={draft}
        onDraftChange={setDraft}
        saving={saving}
        onAllowAll={() => persist(acceptAllConsent())}
        onReject={() => persist(rejectNonEssentialConsent())}
        onConfirm={() => persist(draft)}
      />
    </>
  );
}

function EuBannerCopy() {
  return (
    <p>
      We store and access information on your device, such as cookies, to run this site and — if you
      agree — to measure how it is used. Selecting <span className="text-foreground">Accept</span>{" "}
      turns on optional analytics cookies. Selecting{" "}
      <span className="text-foreground">Reject Non-Essential</span> keeps only cookies needed to
      operate the site, remember this choice, and send you to Amazon or eBay when you click a
      product link. You can change your choices at any time via Privacy Settings.{" "}
      <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
        Privacy Policy
      </Link>
    </p>
  );
}

function UsBannerCopy() {
  return (
    <p>
      We use cookies and similar technologies to operate this site, measure visits, and attribute
      affiliate referrals. You can accept optional analytics cookies, reject them, or manage
      settings. We do not sell personal information for money. California residents can opt out of
      the “sale” or “sharing” of personal information as those terms are defined by California law.
      Your choices apply to this browser.{" "}
      <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
        Privacy Policy
      </Link>
    </p>
  );
}

function PrivacyCenter({
  region,
  open,
  onOpenChange,
  draft,
  onDraftChange,
  saving,
  onAllowAll,
  onReject,
  onConfirm,
}: {
  region: ConsentRegion;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ConsentState;
  onDraftChange: (next: ConsentState) => void;
  saving: boolean;
  onAllowAll: () => void;
  onReject: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup className="fixed top-[50%] left-[50%] z-[60] flex max-h-[min(44rem,calc(100vh-2rem))] w-[calc(100%-1.5rem)] max-w-lg origin-center -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-background text-foreground shadow-lg ring-1 ring-foreground/10 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-center gap-2 font-heading text-lg font-bold tracking-tight">
              <RadarMark className="size-6 text-foreground" />
              {SITE_NAME}
            </div>
            <Dialog.Close
              disabled={saving}
              render={<Button variant="outline" size="icon" className="size-9" />}
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <Dialog.Title className="font-heading text-xl font-bold tracking-tight">Privacy Center</Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {region === "eu" ? (
                <>
                  We process limited device and usage data to run this site and, if you allow it, to
                  measure traffic. These choices are stored on your device for up to one year. You
                  can change them at any time from Privacy Settings in the footer.
                </>
              ) : (
                <>
                  We process limited device and usage data to run this site, measure traffic, and
                  attribute affiliate clicks. We do not sell personal information. You can opt out
                  of sale or sharing, and you can turn off analytics cookies. Choices are stored on
                  this device for up to one year.
                </>
              )}{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </Link>
            </Dialog.Description>

            <Button className="mt-5" disabled={saving} onClick={onAllowAll}>
              Allow All
            </Button>

            <h3 className="mt-8 font-heading text-lg font-bold tracking-tight">Manage Consent Preferences</h3>

            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <PreferenceRow
                title="Strictly Necessary Cookies"
                description="Required to operate the site, keep it secure, remember this privacy choice, and send you to Amazon or eBay when you click a product link."
                details={[
                  "Consent cookie (findit_consent) — stores Accept / Reject / custom choices for up to 1 year",
                  "Staff sign-in cookie — used only in the private admin area, never for public visitors",
                  "Affiliate redirect — a first-party hop on this site when you click a retailer button",
                ]}
                lockedLabel="Essential"
              />
              <PreferenceRow
                title="Analytics Cookies"
                description="First-party visitor and session cookies help us understand which pages and products people use. They do not identify you by name."
                details={[
                  "Visitor cookie (findit_vid) — recognizes returning browsers for up to 1 year",
                  "Session cookie (findit_sid) — groups page views from a single visit",
                  "Page-view beacon — a small request from this site to record the path you viewed",
                ]}
                checked={draft.analytics}
                onCheckedChange={(analytics) => onDraftChange({ ...draft, analytics })}
                disabled={saving}
              />
              {region === "us" ? (
                <PreferenceRow
                  title="Sale or sharing of personal information"
                  description="We do not sell personal information for money or share it with ad networks on this site. Turning this off records your “Do Not Sell or Share” request for this browser."
                  details={[
                    "This preference is for US state privacy laws (including CCPA/CPRA).",
                    "Global Privacy Control (GPC) in your browser is treated as an opt-out.",
                    "Amazon and eBay may still set cookies on their own sites after you click through.",
                  ]}
                  checked={!draft.doNotSell}
                  onCheckedChange={(allowed) => onDraftChange({ ...draft, doNotSell: !allowed })}
                  disabled={saving}
                />
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 border-t border-border bg-background p-4 sm:grid-cols-2">
            <Button size="lg" disabled={saving} onClick={onReject}>
              Reject Non-Essential
            </Button>
            <Button size="lg" disabled={saving} onClick={onConfirm}>
              Confirm My Choices
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PreferenceRow({
  title,
  description,
  details,
  lockedLabel,
  checked,
  onCheckedChange,
  disabled,
}: {
  title: string;
  description: string;
  details: string[];
  lockedLabel?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const switchId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-start gap-3 px-4 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-bold text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {lockedLabel ? (
          <p className="shrink-0 pt-0.5 text-sm font-medium text-primary">{lockedLabel}</p>
        ) : (
          <Switch
            id={switchId}
            checked={checked}
            disabled={disabled}
            onCheckedChange={onCheckedChange}
            className="mt-0.5"
            aria-label={title}
          />
        )}
        <button
          type="button"
          className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          <span className="sr-only">{open ? "Hide details" : "Show details"}</span>
        </button>
      </div>
      {open ? (
        <ul className="list-disc space-y-1 border-t border-border bg-muted/40 px-8 py-3 text-sm text-muted-foreground">
          {details.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
