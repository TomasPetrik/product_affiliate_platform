import { SITE_NAME } from "@/lib/brand";

/**
 * Single source of truth for affiliate-disclosure copy. Public components
 * should import from here rather than hardcoding the FTC notice.
 */
export const AFFILIATE_DISCLOSURE_SHORT = `${SITE_NAME} may earn a commission when you purchase through links on our site. This comes at no additional cost to you.`;

export const AFFILIATE_DISCLOSURE_BANNER = `We participate in the Amazon Associates and eBay Partner Network affiliate programs. As an affiliate, we earn from qualifying purchases at no extra cost to you.`;
