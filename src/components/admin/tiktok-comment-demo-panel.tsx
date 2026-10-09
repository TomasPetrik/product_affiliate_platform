"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, MessageCircle, Package, Radio, Send } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  simulateTikTokKeywordMatch,
  type TikTokCommentDemoProduct,
  type TikTokCommentDemoSimulation,
} from "@/lib/tiktok-comment-demo";

type StepId = "comment" | "webhook" | "product" | "reply" | "result";

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: "comment", label: "TikTok comment" },
  { id: "webhook", label: "RadarCut webhook / API" },
  { id: "product", label: "Product ID match" },
  { id: "reply", label: "Comment reply + DM" },
  { id: "result", label: "Product link" },
];

interface TikTokCommentDemoPanelProps {
  products: TikTokCommentDemoProduct[];
}

export function TikTokCommentDemoPanel({ products }: TikTokCommentDemoPanelProps) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [commentText, setCommentText] = useState("LINK");
  const [stepIndex, setStepIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [simulation, setSimulation] = useState<TikTokCommentDemoSimulation | null>(null);
  const [, startTransition] = useTransition();

  const product = useMemo(
    () => products.find((item) => item.id === productId) ?? null,
    [products, productId],
  );

  useEffect(() => {
    if (!running || stepIndex < 0) return;
    if (stepIndex >= STEPS.length - 1) {
      setRunning(false);
      return;
    }
    const timer = window.setTimeout(() => setStepIndex((value) => value + 1), 1100);
    return () => window.clearTimeout(timer);
  }, [running, stepIndex]);

  function runDemo() {
    if (!product) return;
    startTransition(() => {
      const result = simulateTikTokKeywordMatch(product, commentText);
      setSimulation(result);
      setStepIndex(0);
      setRunning(true);
    });
  }

  function resetDemo() {
    setRunning(false);
    setStepIndex(-1);
    setSimulation(null);
  }

  const activeStep = stepIndex >= 0 ? STEPS[stepIndex]?.id : null;
  const reached = (id: StepId) => {
    const index = STEPS.findIndex((step) => step.id === id);
    return stepIndex >= index;
  };

  return (
    <div className="grid gap-6">
      <Alert>
        <AlertDescription>
          <span className="font-medium">Prototype / Planned API Integration.</span> This screen
          demonstrates the planned TikTok Accounts + Business Messaging flow for TikTok&apos;s
          Accounts API Access review. Live TikTok comment webhooks / DM send land after app
          approval; matching uses the same keyword rules as Meta.
        </AlertDescription>
      </Alert>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No products ready for this demo yet. Open a product, add a marketing TikTok post and/or
            enable <strong>TikTok</strong> on a Comment keyword → reply / DM rule, then return here.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Demo setup</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="tt-demo-product">Product</Label>
                <select
                  id="tt-demo-product"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={productId}
                  onChange={(event) => {
                    setProductId(event.target.value);
                    resetDemo();
                  }}
                >
                  {products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {item.rules.length ? ` · ${item.rules.length} TT rule(s)` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tt-demo-comment">Simulated TikTok comment</Label>
                <Input
                  id="tt-demo-comment"
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="LINK"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="button" onClick={runDemo} disabled={!product || running}>
                  {running ? "Running…" : "Run prototype flow"}
                </Button>
                <Button type="button" variant="outline" onClick={resetDemo} disabled={running}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-sm">TikTok · @{product?.tiktokAccountHint}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Simulated comment thread on a RadarCut marketing video
                  </p>
                </div>
                <Badge variant="outline">Prototype</Badge>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground">Video</p>
                  <p className="mt-1 text-sm font-medium">{product?.title ?? "—"}</p>
                  {product?.linkedTikTokPosts[0]?.permalinkUrl ? (
                    <p className="mt-1 break-all text-[11px] text-muted-foreground">
                      {product.linkedTikTokPosts[0].permalinkUrl}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Link a TikTok post on the product edit page for a real permalink in the demo.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                      U
                    </div>
                    <div className="grid gap-1">
                      <p className="text-sm font-medium">viewer123</p>
                      <p className="text-sm">{commentText || "…"}</p>
                      {reached("reply") && simulation?.publicReply ? (
                        <div className="mt-3 rounded-md border border-dashed bg-muted/40 px-3 py-2">
                          <p className="text-[11px] font-medium text-muted-foreground">
                            RadarCut reply
                          </p>
                          <p className="mt-1 text-sm">{simulation.publicReply}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {reached("result") && simulation?.dmReply ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Send className="size-3.5" />
                      <p className="text-xs font-medium">Private DM (planned Business Messaging)</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{simulation.dmReply}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">RadarCut processing</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {STEPS.map((step, index) => {
                  const done = stepIndex > index;
                  const current = stepIndex === index;
                  return (
                    <div key={step.id} className="grid gap-2">
                      <div
                        className={`flex items-start gap-3 rounded-md border px-3 py-3 ${
                          current
                            ? "border-foreground bg-muted/50"
                            : done
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "opacity-60"
                        }`}
                      >
                        <div className="mt-0.5">
                          {step.id === "comment" ? (
                            <MessageCircle className="size-4" />
                          ) : step.id === "webhook" ? (
                            <Radio className="size-4" />
                          ) : step.id === "product" ? (
                            <Package className="size-4" />
                          ) : (
                            <Send className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{step.label}</p>
                          {step.id === "comment" && reached("comment") ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Inbound comment “{commentText}” on @{product?.tiktokAccountHint}
                            </p>
                          ) : null}
                          {step.id === "webhook" && reached("webhook") ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Planned: TikTok Accounts comment webhook → RadarCut API
                            </p>
                          ) : null}
                          {step.id === "product" && reached("product") ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {simulation?.matched
                                ? `Product: ${simulation.productTitle}`
                                : simulation?.reason}
                            </p>
                          ) : null}
                          {step.id === "reply" && reached("reply") ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {simulation?.matched
                                ? `Keyword “${simulation.keyword}” → public reply${
                                    simulation.dmReply ? " + DM" : ""
                                  }`
                                : "No reply sent"}
                            </p>
                          ) : null}
                          {step.id === "result" && reached("result") ? (
                            <div className="mt-1 grid gap-1 text-xs text-muted-foreground">
                              {simulation?.productUrl ? (
                                <p className="break-all">Product: {simulation.productUrl}</p>
                              ) : null}
                              {simulation?.hopUrl ? (
                                <p className="break-all">Affiliate hop → Amazon / eBay: {simulation.hopUrl}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {done ? <Badge variant="secondary">OK</Badge> : null}
                        {current ? <Badge>Live</Badge> : null}
                      </div>
                      {index < STEPS.length - 1 ? (
                        <ArrowDown className="mx-auto size-3.5 text-muted-foreground" />
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {product ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active TikTok keyword rules</CardTitle>
              </CardHeader>
              <CardContent>
                {product.rules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This product has no TikTok-enabled rules yet. Open{" "}
                    <a className="underline" href={`/admin/products/${product.id}/edit`}>
                      product edit
                    </a>{" "}
                    → Comment keyword → reply / DM → enable <strong>TikTok</strong>.
                  </p>
                ) : (
                  <ul className="grid gap-2 text-sm">
                    {product.rules.map((rule) => (
                      <li key={rule.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
                        <span className="font-mono">{rule.keyword}</span>
                        {rule.isActive ? (
                          <Badge variant="secondary">Active</Badge>
                        ) : (
                          <Badge variant="outline">Disabled</Badge>
                        )}
                        {rule.enablePublicReply ? <Badge variant="outline">Comment</Badge> : null}
                        {rule.enablePrivateDm ? <Badge variant="outline">DM</Badge> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
