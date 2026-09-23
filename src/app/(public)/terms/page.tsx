import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { SITE_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms governing your use of ${SITE_NAME}, including affiliate links, content disclaimers, and limitations of liability.`,
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "September 23, 2026";

const TOC = [
  { href: "#agreement", label: "Agreement to these terms" },
  { href: "#the-site", label: "What the Site is" },
  { href: "#eligibility", label: "Eligibility" },
  { href: "#affiliate", label: "Affiliate relationships" },
  { href: "#no-sales", label: "No sales or payments on this Site" },
  { href: "#content", label: "Content and accuracy" },
  { href: "#intellectual-property", label: "Intellectual property" },
  { href: "#acceptable-use", label: "Acceptable use" },
  { href: "#third-parties", label: "Third-party sites" },
  { href: "#disclaimers", label: "Disclaimers" },
  { href: "#limitation", label: "Limitation of liability" },
  { href: "#indemnity", label: "Indemnity" },
  { href: "#changes", label: "Changes" },
  { href: "#governing-law", label: "Governing law" },
  { href: "#contact", label: "Contact" },
] as const;

function legalEmail(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const host = new URL(siteUrl).hostname.replace(/^www\./, "");
    if (!host || host === "localhost" || host.endsWith(".local")) {
      return "legal@radarcut.local";
    }
    return `legal@${host}`;
  } catch {
    return "legal@radarcut.local";
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

export default function TermsPage() {
  const email = legalEmail();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-page-title">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the{" "}
          {SITE_NAME} website and related pages (the &quot;Site&quot;). By using the Site, you agree
          to these Terms. If you do not agree, do not use the Site.
        </p>
        <p>
          Our{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>{" "}
          explains how we collect and use information. Our{" "}
          <Link href="/disclosure" className="underline underline-offset-2 hover:text-foreground">
            affiliate disclosure
          </Link>{" "}
          explains how we earn commissions.
        </p>
      </div>

      <nav aria-label="Terms of Service contents" className="mt-8 rounded-xl border border-border bg-card p-4">
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
        <Section id="agreement" title="1. Agreement to these terms">
          <p>
            These Terms form a binding agreement between you and the operator of {SITE_NAME}{" "}
            (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). Continued use of the Site after we
            post changes constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <Section id="the-site" title="2. What the Site is">
          <p>
            {SITE_NAME} is a product discovery and review site. We publish editorial content,
            product information, and links to third-party marketplaces such as Amazon and eBay. We
            do not manufacture, stock, sell, or ship products ourselves.
          </p>
        </Section>

        <Section id="eligibility" title="3. Eligibility">
          <p>
            You may use the Site only if you can form a binding contract under applicable law. The
            Site is not directed to children under 13 (or the minimum age required where you live).
            Public visitors are not required to create an account. Staff accounts for editors and
            administrators are private and governed by internal access rules in addition to these
            Terms.
          </p>
        </Section>

        <Section id="affiliate" title="4. Affiliate relationships">
          <p className="font-medium text-foreground">
            As an Amazon Associate we earn from qualifying purchases. We also participate in the
            eBay Partner Network and may participate in other affiliate programs.
          </p>
          <p>
            When you click a retailer button or similar link, we may redirect you through our Site
            and then to the retailer. If you later complete a qualifying purchase, we may earn a
            commission at no extra cost to you. Affiliate relationships do not change the price you
            pay the retailer. Details are in our{" "}
            <Link href="/disclosure" className="underline underline-offset-2 hover:text-foreground">
              affiliate disclosure
            </Link>
            .
          </p>
        </Section>

        <Section id="no-sales" title="5. No sales or payments on this Site">
          <p>
            We do not sell products on the Site, process payments, or take shipping or billing
            information from public visitors. Any purchase you make is a contract solely between you
            and the retailer, under that retailer&apos;s terms, privacy notice, return policy, and
            customer service. We are not a party to those transactions and are not responsible for
            order fulfillment, product quality, warranties, refunds, or disputes with retailers.
          </p>
        </Section>

        <Section id="content" title="6. Content and accuracy">
          <p>
            Product titles, images, prices, availability, ratings, and other details shown on the
            Site are for reference only. They may be incomplete, outdated, or incorrect relative to
            what appears on the retailer&apos;s site at the time you buy. Always confirm price,
            shipping, taxes, and availability on the retailer&apos;s checkout before purchasing.
          </p>
          <p>
            Editorial opinions, comparisons, and recommendations reflect our judgment at the time of
            publication and are not guarantees of performance, safety, or suitability for your
            needs. We do not provide professional advice (including legal, medical, or financial
            advice).
          </p>
        </Section>

        <Section id="intellectual-property" title="7. Intellectual property">
          <p>
            The Site&apos;s design, branding, original text, and other materials we create are owned
            by us or our licensors and are protected by intellectual-property laws. You may view and
            share links to public pages for personal, non-commercial use. You may not copy,
            scrape at scale, republish, or commercially exploit Site content without our prior
            written permission, except as allowed by fair use or similar legal exceptions.
          </p>
          <p>
            Product names, logos, and images belonging to brands or retailers remain their property.
            Amazon, eBay, and other marks are trademarks of their respective owners.
          </p>
        </Section>

        <Section id="acceptable-use" title="8. Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Use the Site in any way that violates law or these Terms</li>
            <li>Interfere with or disrupt the Site, its servers, or security features</li>
            <li>
              Attempt unauthorized access to staff areas, accounts, data, or systems connected to the
              Site
            </li>
            <li>
              Use automated means (bots, scrapers, or similar) in a way that overloads the Site or
              circumvents rate limits, except for ordinary search-engine indexing of publicly
              available pages
            </li>
            <li>Misrepresent your affiliation with {SITE_NAME} or use our branding to imply endorsement</li>
          </ul>
          <p>We may suspend or block access if we reasonably believe these rules are being violated.</p>
        </Section>

        <Section id="third-parties" title="9. Third-party sites and services">
          <p>
            Links to Amazon, eBay, and other sites are provided for convenience. We do not control
            those sites and are not responsible for their content, availability, policies, or
            practices. Your use of third-party sites is at your own risk and subject to their terms.
          </p>
        </Section>

        <Section id="disclaimers" title="10. Disclaimers">
          <p>
            THE SITE AND ALL CONTENT ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot;
            WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING
            IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
            NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.
          </p>
          <p>
            We do not warrant that the Site will be uninterrupted, error-free, or free of harmful
            components, or that content (including prices and availability) will be accurate or
            current.
          </p>
        </Section>

        <Section id="limitation" title="11. Limitation of liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR OPERATORS, AFFILIATES, AND SUPPLIERS
            WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR
            PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF
            OR RELATED TO YOUR USE OF THE SITE, LINKS TO THIRD PARTIES, OR ANY PURCHASE YOU MAKE
            WITH A RETAILER, WHETHER BASED IN CONTRACT, TORT, STRICT LIABILITY, OR OTHERWISE, EVEN
            IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF
            OR RELATING TO THE SITE OR THESE TERMS WILL NOT EXCEED ONE HUNDRED U.S. DOLLARS (US
            $100).
          </p>
          <p>
            Some jurisdictions do not allow certain limitations; in those places, our liability is
            limited to the fullest extent permitted by law.
          </p>
        </Section>

        <Section id="indemnity" title="12. Indemnity">
          <p>
            You agree to defend, indemnify, and hold harmless {SITE_NAME} and its operators from and
            against claims, damages, losses, and expenses (including reasonable attorneys&apos;
            fees) arising out of your misuse of the Site, your violation of these Terms, or your
            violation of any third-party right in connection with your use of the Site.
          </p>
        </Section>

        <Section id="changes" title="13. Changes to the Site and these Terms">
          <p>
            We may modify, suspend, or discontinue any part of the Site at any time. We may update
            these Terms when our practices, affiliate programs, or legal requirements change. The
            &quot;Last updated&quot; date at the top will change when we do. Your continued use of
            the Site after an update means you accept the revised Terms.
          </p>
        </Section>

        <Section id="governing-law" title="14. Governing law">
          <p>
            These Terms are governed by the laws applicable where the Site operator is established,
            without regard to conflict-of-law principles, except where mandatory consumer
            protections in your country of residence require otherwise. Courts in that jurisdiction
            will have exclusive venue for disputes arising from these Terms, subject to those
            mandatory consumer rights.
          </p>
        </Section>

        <Section id="contact" title="15. Contact">
          <p>
            Questions about these Terms:{" "}
            <a href={`mailto:${email}`} className="underline underline-offset-2 hover:text-foreground">
              {email}
            </a>
            .
          </p>
          <p>
            Privacy questions: see our{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            . Commission and affiliate questions: see our{" "}
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
