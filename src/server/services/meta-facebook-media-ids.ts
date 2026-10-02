import { metaGraphUrl } from "@/lib/meta";
import {
  getMetaConnectionInternal,
  getValidMetaPageAccessToken,
} from "@/server/services/meta-oauth.service";

function collectIdsFromPermalink(permalink: string | null | undefined, out: Set<string>): void {
  if (!permalink) return;
  const reelMatch = permalink.match(/\/(?:reel|videos|watch)\/(\d+)/);
  if (reelMatch?.[1]) out.add(reelMatch[1]);
  try {
    const vParam = new URL(permalink).searchParams.get("v");
    if (vParam && /^\d+$/.test(vParam)) out.add(vParam);
  } catch {
    // ignore
  }
}

/**
 * Facebook feed webhooks send page post_id values like "{pageId}_{postId}" that
 * differ from Graph video/reel IDs stored from /{page}/videos. Expand via
 * permalink (and page feed lookup) — avoid deprecated singular attachment fields.
 */
export async function expandFacebookMediaIdCandidates(
  mediaIdCandidates: string[],
): Promise<string[]> {
  const out = new Set(mediaIdCandidates.filter(Boolean));
  if (out.size === 0) return [];

  let token: string;
  try {
    token = await getValidMetaPageAccessToken();
  } catch {
    return [...out];
  }

  const connection = await getMetaConnectionInternal();
  const pageId = connection?.pageId ?? null;

  // 1) Resolve each candidate with safe fields only (permalink_url).
  for (const id of [...out].slice(0, 6)) {
    try {
      const url = metaGraphUrl(`/${id}`, {
        fields: "id,permalink_url",
        access_token: token,
      });
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await response.json()) as {
        id?: string;
        permalink_url?: string;
        error?: { message?: string };
      };
      if (!response.ok || data.error) continue;
      if (data.id) out.add(String(data.id));
      collectIdsFromPermalink(data.permalink_url, out);
    } catch {
      // best-effort
    }
  }

  // 2) Page feed maps post_id → reel/video target id (reliable for Reels).
  if (pageId) {
    try {
      let nextUrl: string | null = metaGraphUrl(`/${pageId}/feed`, {
        fields: "id,permalink_url,attachments{target{id},type,url}",
        limit: "50",
        access_token: token,
      });
      let pages = 0;
      const wanted = new Set(mediaIdCandidates.filter(Boolean));

      while (nextUrl && pages < 3) {
        pages += 1;
        const response = await fetch(nextUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
        const data = (await response.json()) as {
          data?: Array<{
            id?: string;
            permalink_url?: string;
            attachments?: {
              data?: Array<{ target?: { id?: string }; url?: string }>;
            };
          }>;
          paging?: { next?: string };
          error?: { message?: string };
        };
        if (!response.ok || data.error) break;

        for (const item of data.data ?? []) {
          const itemId = item.id;
          if (!itemId) continue;
          const isWanted =
            wanted.has(itemId) ||
            [...wanted].some(
              (candidate) => itemId === candidate || itemId.endsWith(`_${candidate}`),
            );
          if (!isWanted) continue;

          out.add(itemId);
          collectIdsFromPermalink(item.permalink_url, out);
          for (const attachment of item.attachments?.data ?? []) {
            if (attachment.target?.id) out.add(String(attachment.target.id));
            collectIdsFromPermalink(attachment.url, out);
          }
        }

        nextUrl = data.paging?.next ?? null;
      }
    } catch {
      // best-effort
    }
  }

  return [...out];
}
