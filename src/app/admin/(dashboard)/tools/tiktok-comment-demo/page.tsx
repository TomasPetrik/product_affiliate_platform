import type { Metadata } from "next";

import { TikTokCommentDemoPanel } from "@/components/admin/tiktok-comment-demo-panel";
import { listTikTokCommentDemoProducts } from "@/server/services/tiktok-comment-demo.service";

export const metadata: Metadata = { title: "TikTok comment demo" };

export default async function AdminTikTokCommentDemoPage() {
  const products = await listTikTokCommentDemoProducts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">TikTok comment demo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prototype flow for TikTok Accounts API Access review: comment keyword → product match →
          public reply / DM → RadarCut product link (Amazon / eBay hop).
        </p>
      </div>
      <TikTokCommentDemoPanel products={products} />
    </div>
  );
}
