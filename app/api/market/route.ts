import { NextRequest, NextResponse } from "next/server";
import { getMarketQuote } from "@/lib/providers/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_INTERVALS = new Set(["1min", "5min", "15min", "30min", "1h", "4h", "1day"]);

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") || "XAU/USD";
  const interval = request.nextUrl.searchParams.get("interval") || "5min";
  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json({ status: "error", error: "Unsupported interval" }, { status: 400 });
  }

  try {
    const quote = await getMarketQuote(symbol, interval);
    return NextResponse.json({
      status: quote.mode,
      disclaimer: quote.mode === "demo"
        ? "DEMO MODE: no live quote is available. Do not use this response as a current price."
        : "Provider response. Check source timestamps and your data agreement for freshness and permitted display.",
      data: quote
    }, {
      headers: { "Cache-Control": quote.mode === "demo" ? "no-store" : "private, no-store" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provider error";
    return NextResponse.json({
      status: "unavailable",
      disclaimer: "Live data could not be verified. No demo price is substituted.",
      error: message
    }, { status: 502 });
  }
}
