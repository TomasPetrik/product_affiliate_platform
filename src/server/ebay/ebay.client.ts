import { EbayServiceError } from "@/server/ebay/ebay-errors";

export interface EbayClientConfig {
  clientId: string;
  clientSecret: string;
  marketplaceId: string;
  environment: "production" | "sandbox";
  affiliateCampaignId?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const TOKEN_SKEW_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;

export class EbayClient {
  private token: CachedToken | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly config: EbayClientConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? Date.now;
  }

  apiHost(): string {
    return this.config.environment === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  }

  async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - TOKEN_SKEW_MS > this.now()) {
      return this.token.accessToken;
    }

    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    });

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiHost()}/identity/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw wrapNetwork(error, "Could not authenticate with eBay.");
    }

    if (!response.ok) {
      const oauthError = await readOAuthError(response);
      throw new EbayServiceError(
        "AUTH_FAILED",
        authFailedMessage(this.config.environment, oauthError),
        response.status,
      );
    }

    const json = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
      throw new EbayServiceError("AUTH_FAILED", authFailedMessage(this.config.environment, null));
    }

    this.token = {
      accessToken: json.access_token,
      expiresAt: this.now() + Math.max(30, json.expires_in ?? 7200) * 1000,
    };
    return this.token.accessToken;
  }

  async browseGet(path: string, affiliateReferenceId?: string): Promise<unknown> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": this.config.marketplaceId,
      Accept: "application/json",
    };

    if (this.config.affiliateCampaignId && affiliateReferenceId) {
      headers["X-EBAY-C-ENDUSERCTX"] =
        `affiliateCampaignId=${this.config.affiliateCampaignId},affiliateReferenceId=${affiliateReferenceId}`;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiHost()}${path}`, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw wrapNetwork(error, "eBay request timed out. Try again.");
    }

    if (response.status === 401 || response.status === 403) {
      this.token = null;
      throw new EbayServiceError(
        "AUTH_FAILED",
        "eBay rejected the API credentials or the Browse API is not enabled for this app.",
        response.status,
      );
    }

    if (response.status === 429) {
      throw new EbayServiceError(
        "RATE_LIMITED",
        "eBay rate-limited this request. Wait a moment and try again.",
        429,
      );
    }

    if (response.status === 404) {
      throw new EbayServiceError(
        "NOT_FOUND",
        this.config.environment === "sandbox"
          ? "That listing was not found in the eBay sandbox catalog. Use Search eBay below, not a live ebay.com URL."
          : "That eBay listing was not found.",
        404,
      );
    }

    if (!response.ok) {
      const detail = await readEbayErrorDetail(response);
      throw new EbayServiceError(
        "API_ERROR",
        detail ?? "eBay returned an unexpected error. Try again.",
        response.status,
      );
    }

    return response.json();
  }

  async getNotificationPublicKey(kid: string): Promise<string | null> {
    const token = await this.getAccessToken();
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.apiHost()}/commerce/notification/v1/public_key/${encodeURIComponent(kid)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const json = (await response.json().catch(() => null)) as { key?: string } | null;
    return json?.key?.trim() || null;
  }
}

function wrapNetwork(error: unknown, timeoutMessage: string): EbayServiceError {
  if (error instanceof EbayServiceError) {
    return error;
  }
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new EbayServiceError("TIMEOUT", timeoutMessage);
  }
  return new EbayServiceError("NETWORK", "Could not reach eBay. Check the network connection and try again.");
}

function authFailedMessage(environment: "production" | "sandbox", oauthError: string | null): string {
  const vars =
    environment === "sandbox"
      ? "EBAY_SANDBOX_CLIENT_ID and EBAY_SANDBOX_CLIENT_SECRET"
      : "EBAY_PRODUCTION_CLIENT_ID and EBAY_PRODUCTION_CLIENT_SECRET";
  if (oauthError === "invalid_client") {
    return (
      `eBay rejected the ${environment} App ID / Cert ID pair. ${vars} are set, ` +
      `but they are not valid. Re-copy them from the ${environment} keyset at developer.ebay.com ` +
      `(reset the Cert ID if it was already revealed) and restart the app.`
    );
  }
  return `eBay authentication failed. Check ${vars}.`;
}

async function readOAuthError(response: Response): Promise<string | null> {
  const json = (await response.json().catch(() => null)) as { error?: string } | null;
  const error = json?.error?.trim();
  if (!error || error.length > 64 || /secret|password|token|credential/i.test(error)) {
    return null;
  }
  return error;
}

async function readEbayErrorDetail(response: Response): Promise<string | null> {
  const json = (await response.json().catch(() => null)) as
    | { errors?: Array<{ message?: string; longMessage?: string }> }
    | null;
  const message = json?.errors?.[0]?.longMessage || json?.errors?.[0]?.message;
  if (!message || message.length > 240) {
    return null;
  }
  if (/secret|password|token|credential/i.test(message)) {
    return null;
  }
  return message;
}
