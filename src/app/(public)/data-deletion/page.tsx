import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { SITE_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Data Deletion",
  description: `How to request deletion of your data from ${SITE_NAME}, including instructions for Meta / Facebook app review.`,
  alternates: { canonical: "/data-deletion" },
};

const LAST_UPDATED = "September 23, 2026";

function privacyEmail(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const host = new URL(siteUrl).hostname.replace(/^www\./, "");
    if (!host || host === "localhost" || host.endsWith(".local")) {
      return "privacy@radarcut.local";
    }
    return `privacy@${host}`;
  } catch {
    return "privacy@radarcut.local";
  }
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function DataDeletionPage() {
  const email = privacyEmail();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-page-title">Data Deletion Request</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          This page explains how to request that {SITE_NAME} delete personal data associated with
          you. It also satisfies Meta / Facebook requirements for apps that access user data to
          provide a clear way for people to request deletion of their data from the app or website.
        </p>
        <p>
          {SITE_NAME} is a product discovery and review site. Public visitors are not asked to create
          an account, and we do not use Facebook Login for consumer sign-in on the Site. More detail
          is in our{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
        <Section id="what-we-store" title="1. What data we may hold">
          <p>Depending on how you used the Site, we may have:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              First-party analytics records (pages viewed, affiliate clicks, approximate location
              from IP, device type, and anonymous cookie identifiers). Raw IP addresses are not kept
              in analytics rows; we store a one-way hash where used for analytics or abuse
              prevention.
            </li>
            <li>
              Consent / privacy preference cookies stored in your browser (Accept, Reject, or custom
              choices).
            </li>
            <li>
              Emails and related content you send us if you contact us (for example a deletion
              request).
            </li>
            <li>
              Staff admin accounts (email and password hash) only for editors and administrators —
              not for public visitors.
            </li>
          </ul>
          <p>
            We do not sell products on the Site or process payment cards. Purchases happen on
            retailer sites (such as Amazon or eBay) under those companies&apos; own policies.
          </p>
          <p>
            If our Meta (Facebook / Instagram) integration is used, it is typically for RadarCut
            Page / content metrics under our own Page access token — not a store of your personal
            Facebook profile for public visitors. If you authorized a Meta product in connection
            with {SITE_NAME} and want that connection removed, say so in your request and we will
            revoke or delete related tokens and cached metrics where we control them.
          </p>
        </Section>

        <Section id="self-serve" title="2. What you can delete yourself">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Use{" "}
              <Link href="/privacy#cookies" className="underline underline-offset-2 hover:text-foreground">
                Privacy Settings
              </Link>{" "}
              in the site footer (or the privacy notice) to reject optional analytics cookies or
              reset preferences.
            </li>
            <li>
              Clear cookies and site data for radarcut.com in your browser settings to remove local
              identifiers and consent cookies.
            </li>
            <li>
              Use advertising opt-out tools described in our{" "}
              <Link href="/privacy#opt-out" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </Link>{" "}
              for interest-based ads on third-party sites.
            </li>
          </ul>
        </Section>

        <Section id="how-to-request" title="3. How to request deletion">
          <p className="font-medium text-foreground">
            Email{" "}
            <a href={`mailto:${email}?subject=${encodeURIComponent(`${SITE_NAME} data deletion request`)}`} className="underline underline-offset-2 hover:text-foreground">
              {email}
            </a>{" "}
            with the subject line &quot;{SITE_NAME} data deletion request&quot;.
          </p>
          <p>Please include:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your name (optional but helpful)</li>
            <li>The email address you used to contact us, if any</li>
            <li>
              Any Facebook / Instagram / Meta username, Page name, or app authorization details that
              help us find related records
            </li>
            <li>
              Approximate dates you used the Site, or a description of the data you want deleted
            </li>
            <li>
              Confirmation that you are requesting deletion of your personal data from {SITE_NAME}
            </li>
          </ul>
          <p>
            We may ask for reasonable information to verify the request. We will not ask for
            passwords to third-party accounts.
          </p>
        </Section>

        <Section id="what-we-do" title="4. What we do after a request">
          <p>After we verify your request, we will:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Delete or anonymize personal data we hold about you that is not required to keep for
              legal, security, or affiliate-program audit reasons
            </li>
            <li>
              Remove or revoke Meta-related tokens or cached content metrics tied to your request
              when we control them
            </li>
            <li>
              Confirm by email when the request is completed, or explain if something cannot be
              fully deleted and why
            </li>
          </ol>
          <p>
            We aim to complete verified requests within <span className="font-medium text-foreground">30 days</span>
            . Aggregated statistics that no longer identify you may be retained.
          </p>
        </Section>

        <Section id="facebook" title="5. Meta / Facebook note">
          <p>
            If you reached this page from Meta / Facebook app settings, use the email instructions
            above to request deletion of data associated with our app or website. Removing the app
            from your Facebook settings does not automatically delete data already stored by{" "}
            {SITE_NAME}; emailing us ensures we process the request on our side.
          </p>
          <p>
            This URL —{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              https://radarcut.com/data-deletion
            </code>{" "}
            — is the public Data Deletion Instructions URL for our Meta app configuration.
          </p>
        </Section>

        <Section id="contact" title="6. Contact">
          <p>
            Data deletion and privacy requests:{" "}
            <a href={`mailto:${email}`} className="underline underline-offset-2 hover:text-foreground">
              {email}
            </a>
            .
          </p>
          <p>
            See also our{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms of Service
            </Link>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
