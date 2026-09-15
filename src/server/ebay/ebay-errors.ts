export type EbayErrorCode =
  | "NOT_CONFIGURED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK"
  | "INVALID_URL"
  | "INVALID_ITEM_ID"
  | "NOT_FOUND"
  | "UNAVAILABLE"
  | "MISSING_TITLE"
  | "MISSING_PRICE"
  | "MISSING_IMAGE"
  | "AFFILIATE_URL"
  | "API_ERROR";

export class EbayServiceError extends Error {
  readonly code: EbayErrorCode;
  readonly status?: number;

  constructor(code: EbayErrorCode, message: string, status?: number) {
    super(message);
    this.name = "EbayServiceError";
    this.code = code;
    this.status = status;
  }
}

export function userFacingEbayMessage(error: unknown): string {
  if (error instanceof EbayServiceError) {
    return error.message;
  }
  if (error instanceof Error) {
    const message = error.message.trim();
    if (
      message &&
      message.length < 240 &&
      !message.toLowerCase().includes("secret") &&
      !message.toLowerCase().includes("password") &&
      !message.includes("EBAY_CLIENT")
    ) {
      return message;
    }
  }
  return "Could not reach eBay. Try again in a moment.";
}
