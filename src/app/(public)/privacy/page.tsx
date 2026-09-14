import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { OutboundLink } from "@/components/public/outbound-link";
import { SITE_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    `How ${SITE_NAME} collects, uses, stores, and shares visitor data, including cookies used by Amazon Associates, eBay Partner Network, and our own analytics.`,
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "September 14, 2026";

const TOC = [
  { href: "#who-we-are", label: "Who we are" },
  { href: "#affiliate-programs", label: "Affiliate programs" },
  { href: "#information-we-collect", label: "Information we collect" },
  { href: "#how-we-use-information", label: "How we use information" },
  { href: "#cookies", label: "Cookies and similar technologies" },
  { href: "#third-parties", label: "Third parties" },
  { href: "#sharing", label: "How we share information" },
  { href: "#opt-out", label: "Advertising opt-outs" },
  { href: "#retention", label: "Retention" },
  { href: "#security", label: "Security" },
  { href: "#international", label: "International transfers" },
  { href: "#children", label: "Children" },
  { href: "#your-rights", label: "Your rights" },
  { href: "#changes", label: "Changes" },
  { href: "#contact", label: "Contact" },
] as const;

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

export default function PrivacyPage() {
  const email = privacyEmail();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-page-title">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          This Privacy Policy explains how {SITE_NAME} (&quot;we,&quot; &quot;us,&quot; or
          &quot;our&quot;) collects, uses, stores, and discloses information from visitors to this
          website (the &quot;Site&quot;). It also describes cookies, pixels, and similar technologies
          used by us and by third parties — including Amazon and other advertisers — as required by
          the Amazon Associates Program and other affiliate programs we participate in.
        </p>
        <p>
          {SITE_NAME} is a product discovery and review site. We do not sell products on the Site, we do
          not process payments, and public visitors are not asked to create an account. Purchases
          happen on third-party marketplaces such as Amazon and eBay, under those companies&apos;
          own terms and privacy notices. Our{" "}
          <Link href="/disclosure" className="underline underline-offset-2 hover:text-foreground">
            affiliate disclosure
          </Link>{" "}
          explains how we earn commissions.
        </p>
      </div>

      <nav aria-label="Privacy Policy contents" className="mt-8 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Contents</p>
        <ol className="mt-3 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
          {TOC.map((item, index) => (
            <li key={item.href}>
              <a href={item.href} className="underline-offset-2 hover:text-foreground hover:underline">
                {index + 1}. {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-muted-foreground">
        <Section id="who-we-are" title="1. Who we are">
          <p>
            {SITE_NAME} operates this Site as a product-curation and affiliate-referral service. For
            privacy questions, we are the operator of the Site and the controller of personal data
            we collect through it, except where a third party (such as Amazon or eBay) collects
            information directly from you on their own sites.
          </p>
          <p>
            Contact:{" "}
            <a href={`mailto:${email}`} className="underline underline-offset-2 hover:text-foreground">
              {email}
            </a>
          </p>
        </Section>

        <Section id="affiliate-programs" title="2. Affiliate programs">
          <p className="font-medium text-foreground">
            As an Amazon Associate we earn from qualifying purchases. We also participate in the
            eBay Partner Network and may participate in other affiliate programs.
          </p>
          <p>
            When you click a &quot;View on Amazon,&quot; &quot;View on eBay,&quot; or similar button,
            we send you through a first-party redirect on this Site and then to the retailer. That
            retailer may pay us a commission if you later complete a qualifying purchase, at no extra
            cost to you. Amazon generally attributes qualifying purchases from a click-through
            session (commonly 24 hours, with additional cart-based attribution under Amazon&apos;s
            then-current Associates terms).
          </p>
          <p>
            We do not currently embed Amazon Native Shopping Ads, Amazon oneTag, or other Amazon
            advertising widgets on the Site. Tracking for Amazon Associates happens when you click a
            Special Link and land on an Amazon site. If we add widgets, pixels, or oneTag later, we
            will update this policy and, where required by law, obtain consent.
          </p>
        </Section>

        <Section id="information-we-collect" title="3. Information we collect">
          <p>
            We do not ask public visitors for a name, email address, payment card, or shipping
            address. Marketplace checkouts are handled entirely by the retailer.
          </p>
          <p className="font-medium text-foreground">Information collected automatically</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Pages you view, product and category pages, and search terms you enter on the Site</li>
            <li>Clicks on affiliate and other outbound links, including the destination URL</li>
            <li>Approximate country (from our hosting or CDN headers, when available)</li>
            <li>Device type (desktop, mobile, or tablet), browser user agent, and referring URL</li>
            <li>Campaign or referral details if they are present in the link you used to arrive</li>
            <li>
              A one-way (hashed) form of your IP address for analytics and abuse prevention — we do
              not keep the raw address in our analytics records
            </li>
            <li>Anonymous identifiers stored in first-party cookies so we can tell visits apart</li>
          </ul>
          <p className="font-medium text-foreground">Information you choose to send us</p>
          <p>
            If you email us, we receive whatever you include in that message (typically your email
            address and the content of the request) so we can respond.
          </p>
          <p className="font-medium text-foreground">Staff accounts</p>
          <p>
            Editors and administrators who sign in to the private staff area provide an email
            address and password. That account data is used only to operate the Site, not as public
            visitor analytics.
          </p>
        </Section>

        <Section id="how-we-use-information" title="4. How we use information">
          <p>We use the information above to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Operate, secure, and improve the Site</li>
            <li>Understand which products, categories, and pages are useful to visitors</li>
            <li>Measure affiliate click-throughs and, where we later import reports, commissions</li>
            <li>Diagnose errors, prevent abuse, and keep redirects working</li>
            <li>Comply with law and with affiliate-program rules (including Amazon Associates)</li>
            <li>Respond to privacy or other requests you send us</li>
          </ul>
          <p>
            Where GDPR or UK GDPR applies, we rely on our legitimate interests in running an
            informational affiliate site, measuring traffic, attributing referrals, and keeping the
            Site secure. Staff login data is processed to provide the admin service. We do not use
            public visitor data to build a marketing list or send promotional email.
          </p>
        </Section>

        <Section id="cookies" title="5. Cookies, pixels, and similar technologies">
          <p>
            We and third parties use cookies, pixels, redirects, and similar technologies. A cookie
            is a small file stored on your device. A pixel or beacon is a small request that helps
            record that a page was viewed or a link was clicked.
          </p>
          <p>
            Third parties (including Amazon and other advertisers) may serve content and
            advertisements, collect information directly from visitors, and place or recognize
            cookies on visitors&apos; browsers. Those companies may use that information to provide
            measurement services and, where they operate ads, to target or measure advertising.
          </p>
          <p>
            Our own analytics uses first-party cookies and a small request made from this Site. When
            you click an affiliate button, we record that click on our servers before sending you on
            to Amazon, eBay, or another retailer.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[36rem] text-left text-xs sm:text-sm">
              <caption className="sr-only">Cookies used on {SITE_NAME}</caption>
              <thead className="border-b bg-muted/50 text-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Set by
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Purpose
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Typical duration
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-3 py-2 text-foreground">Visitor cookie</td>
                  <td className="px-3 py-2">{SITE_NAME}</td>
                  <td className="px-3 py-2">
                    Helps us recognize returning browsers for site analytics, without knowing who
                    you are
                  </td>
                  <td className="px-3 py-2">Up to 1 year</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 text-foreground">Session cookie</td>
                  <td className="px-3 py-2">{SITE_NAME}</td>
                  <td className="px-3 py-2">
                    Groups page views from a single visit; a new visit starts after a period of
                    inactivity
                  </td>
                  <td className="px-3 py-2">Up to 1 year</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 text-foreground">Staff sign-in cookie</td>
                  <td className="px-3 py-2">{SITE_NAME}</td>
                  <td className="px-3 py-2">
                    Keeps editors and administrators signed in to the private staff area. Not used
                    for public visitors
                  </td>
                  <td className="px-3 py-2">Up to 7 days</td>
                </tr>
                <tr className="border-b">
                  <td className="px-3 py-2 text-foreground">Retailer cookies</td>
                  <td className="px-3 py-2">Amazon</td>
                  <td className="px-3 py-2">
                    Set on Amazon sites after you click through from {SITE_NAME}. Used for affiliate
                    attribution, Amazon site features, and Amazon advertising where applicable
                  </td>
                  <td className="px-3 py-2">Set by Amazon</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-foreground">Retailer cookies</td>
                  <td className="px-3 py-2">eBay</td>
                  <td className="px-3 py-2">
                    Set on eBay sites after you click through from {SITE_NAME}. Used for referral
                    tracking, eBay site features, and advertising where applicable
                  </td>
                  <td className="px-3 py-2">Set by eBay</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            You can delete or block cookies in your browser settings. Blocking cookies may stop
            affiliate attribution (we may not be paid for a purchase you still make) and will limit
            our analytics. Essential redirects will still work.
          </p>
        </Section>

        <Section id="third-parties" title="6. Third parties">
          <p>
            When you follow an affiliate link, you leave {SITE_NAME} and the retailer&apos;s privacy
            notice applies. We do not control Amazon&apos;s or eBay&apos;s cookies or data practices
            on their sites.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Amazon privacy notice:{" "}
              <OutboundLink
                href="https://www.amazon.com/privacy"
                className="underline underline-offset-2 hover:text-foreground"
              >
                amazon.com/privacy
              </OutboundLink>
            </li>
            <li>
              Amazon interest-based ads:{" "}
              <OutboundLink
                href="https://www.amazon.com/adprefs"
                className="underline underline-offset-2 hover:text-foreground"
              >
                amazon.com/adprefs
              </OutboundLink>
            </li>
            <li>
              eBay user privacy notice:{" "}
              <OutboundLink
                href="https://www.ebay.com/help/policies/member-behaviour-policies/user-privacy-notice-privacy-policy?id=4260"
                className="underline underline-offset-2 hover:text-foreground"
              >
                eBay Privacy Policy
              </OutboundLink>
            </li>
            <li>
              eBay Partner Network:{" "}
              <OutboundLink
                href="https://partnernetwork.ebay.com/"
                className="underline underline-offset-2 hover:text-foreground"
              >
                partnernetwork.ebay.com
              </OutboundLink>
            </li>
          </ul>
          <p>
            We also use hosting, database, and related infrastructure providers to run the Site.
            They process data on our instructions to provide those services. We do not use Google
            Analytics, Meta Pixel, or similar third-party advertising pixels on the Site today.
          </p>
        </Section>

        <Section id="sharing" title="7. How we share information">
          <p>We disclose visitor information only as follows:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="font-medium text-foreground">Retailers you choose to visit.</span>{" "}
              Clicking an affiliate button sends your browser to Amazon, eBay, or another
              marketplace. That request includes standard browser information and any tracking
              details those programs attach to the link. We do not send them your name or email
              because we do not collect those from public visitors.
            </li>
            <li>
              <span className="font-medium text-foreground">Service providers.</span> Hosting and
              database vendors that process data to operate the Site.
            </li>
            <li>
              <span className="font-medium text-foreground">Legal and safety.</span> If required by
              law, regulation, legal process, or to protect the Site, our users, or others.
            </li>
            <li>
              <span className="font-medium text-foreground">Business transfers.</span> If we
              reorganize or transfer the Site, analytics and operating data may move with it under
              this policy.
            </li>
          </ul>
          <p>
            We do not sell your personal information for money. We do not share public visitor data
            with data brokers. We do not allow third-party ad networks to collect data on {SITE_NAME}
            pages themselves; collection by Amazon or eBay occurs on their sites after you click
            through.
          </p>
        </Section>

        <Section id="opt-out" title="8. Advertising and measurement opt-outs">
          <p>
            Amazon Associates and similar programs use cookies and related technologies so retailers
            can measure referrals. You can limit interest-based advertising through the tools below.
            These opt-outs are device- and browser-specific, and some retailers still use cookies
            that are needed for their sites to function.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Amazon advertising preferences:{" "}
              <OutboundLink
                href="https://www.amazon.com/adprefs"
                className="underline underline-offset-2 hover:text-foreground"
              >
                amazon.com/adprefs
              </OutboundLink>
            </li>
            <li>
              Digital Advertising Alliance:{" "}
              <OutboundLink
                href="https://optout.aboutads.info/"
                className="underline underline-offset-2 hover:text-foreground"
              >
                optout.aboutads.info
              </OutboundLink>
            </li>
            <li>
              Network Advertising Initiative:{" "}
              <OutboundLink
                href="https://optout.networkadvertising.org/"
                className="underline underline-offset-2 hover:text-foreground"
              >
                optout.networkadvertising.org
              </OutboundLink>
            </li>
            <li>
              European industry opt-out:{" "}
              <OutboundLink
                href="https://www.youronlinechoices.eu/"
                className="underline underline-offset-2 hover:text-foreground"
              >
                youronlinechoices.eu
              </OutboundLink>
            </li>
          </ul>
          <p>
            You can also use your browser to block or delete cookies, or use a browser setting that
            limits cross-site tracking. We do not currently respond to the Global Privacy Control
            (GPC) signal as a site-wide opt-out mechanism.
          </p>
        </Section>

        <Section id="retention" title="9. How long we keep information">
          <p>
            First-party analytics cookies are set for up to one year. We keep related analytics
            events, session records, and affiliate-click logs for as long as needed to operate the
            Site, understand traffic, reconcile affiliate reporting, debug issues, and meet legal
            or program-audit needs, after which we delete or aggregate them. Emails you send us are
            kept long enough to handle your request. Staff account records are kept while the
            account is active.
          </p>
        </Section>

        <Section id="security" title="10. Security">
          <p>
            We use encrypted connections and protect analytics identifiers so they are not stored in
            a directly readable form. No method of
            transmission or storage is completely secure. Because we never take payment card data,
            cardholder information is not stored on {SITE_NAME}.
          </p>
        </Section>

        <Section id="international" title="11. International transfers">
          <p>
            The Site may be hosted, and data processed, in countries other than the one you live in,
            including countries that may not provide the same data-protection laws as your home
            country. If you click through to Amazon, eBay, or another retailer, that company may
            also process your data in other countries under its own notice.
          </p>
        </Section>

        <Section id="children" title="12. Children">
          <p>
            The Site is not directed to children, and we do not knowingly collect personal
            information from children under 13 (or the equivalent age required by local law). The
            Amazon Associates Program does not permit sites that are directed toward children or
            that knowingly collect personal information from children under 13. If you believe a
            child has provided us information, contact us and we will delete it.
          </p>
        </Section>

        <Section id="your-rights" title="13. Your privacy rights">
          <p>
            Depending on where you live, you may have rights to access, correct, delete, or receive
            a copy of personal information we hold about you, to object to or restrict certain
            processing, and to lodge a complaint with a data-protection authority. California
            residents may also have rights under the CCPA/CPRA, including to know, delete, and
            opt out of the “sale” or “sharing” of personal information as those terms are defined
            by California law.
          </p>
          <p>
            Because we do not maintain customer accounts for public visitors, we may have only
            anonymous usage records. We may need enough
            information from you to reasonably verify a request. To exercise a right, email{" "}
            <a href={`mailto:${email}`} className="underline underline-offset-2 hover:text-foreground">
              {email}
            </a>
            . We will not discriminate against you for exercising privacy rights.
          </p>
          <p>
            We do not sell personal information. If you want us to delete first-party analytics
            cookies, you can clear cookies for this Site in your browser.
          </p>
        </Section>

        <Section id="changes" title="14. Changes to this policy">
          <p>
            We may update this Privacy Policy when our practices, affiliate programs, or legal
            requirements change. The &quot;Last updated&quot; date at the top will change when we do.
            Continued use of the Site after an update means you should read the revised policy.
          </p>
        </Section>

        <Section id="contact" title="15. Contact">
          <p>
            Questions about this Privacy Policy, cookies, or your privacy rights:{" "}
            <a href={`mailto:${email}`} className="underline underline-offset-2 hover:text-foreground">
              {email}
            </a>
            .
          </p>
          <p>
            For how we earn commissions, see our{" "}
            <Link href="/disclosure" className="underline underline-offset-2 hover:text-foreground">
              affiliate disclosure
            </Link>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
