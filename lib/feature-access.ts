export type AccessTier = "FREE" | "PRO" | "VIP";
export type FeatureRule = { title: string; tier: AccessTier; subscriptionUrl?: string; enabled: boolean };

export const FEATURE_DEFINITIONS: Array<{ title: string; defaultTier: AccessTier }> = [
  { title: "Order Flow Footprint", defaultTier: "VIP" },
  { title: "Volume Profile & Footprint Analysis", defaultTier: "PRO" },
  { title: "Integrated Trade Journal & Analytics", defaultTier: "FREE" },
  { title: "Master Confluence & Probability Engine", defaultTier: "FREE" },
  { title: "Master Scorecard & Key Levels", defaultTier: "PRO" },
  { title: "COT Institutional Sentiment", defaultTier: "FREE" },
  { title: "Institutional Liquidity & Book Depth Map", defaultTier: "FREE" },
  { title: "Institutional Liquidity Heatmap", defaultTier: "FREE" },
  { title: "Volumetric Delta & VWAP Bands", defaultTier: "FREE" },
  { title: "Intermarket Correlation Matrix", defaultTier: "FREE" },
  { title: "Monetary Policy Watch & Macro Events", defaultTier: "PRO" },
];

export function defaultFeatureRules(): FeatureRule[] {
  const proUrl = process.env.NEXT_PUBLIC_PRO_SUBSCRIPTION_URL || process.env.PRO_SUBSCRIPTION_URL || "";
  const vipUrl = process.env.NEXT_PUBLIC_VIP_SUBSCRIPTION_URL || process.env.VIP_SUBSCRIPTION_URL || "";
  return FEATURE_DEFINITIONS.map(({ title, defaultTier }) => ({
    title,
    tier: defaultTier,
    enabled: true,
    subscriptionUrl: defaultTier === "VIP" ? vipUrl : defaultTier === "PRO" ? proUrl : "",
  }));
}

export function normalizeFeatureRules(input: unknown): FeatureRule[] {
  const defaults = defaultFeatureRules();
  if (!Array.isArray(input)) return defaults;
  const byTitle = new Map<string, Record<string, unknown>>();
  for (const item of input) if (item && typeof item === "object" && typeof (item as {title?: unknown}).title === "string") byTitle.set((item as {title: string}).title, item as Record<string, unknown>);
  return defaults.map((fallback) => {
    const item = byTitle.get(fallback.title);
    if (!item) return fallback;
    const tier = item.tier === "PRO" || item.tier === "VIP" || item.tier === "FREE" ? item.tier : fallback.tier;
    return { title: fallback.title, tier, enabled: typeof item.enabled === "boolean" ? item.enabled : true, subscriptionUrl: typeof item.subscriptionUrl === "string" ? item.subscriptionUrl.slice(0, 2000) : fallback.subscriptionUrl };
  });
}
