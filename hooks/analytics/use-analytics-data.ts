"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { useStoreStore } from "@/stores/store";
import { parseJson } from "@/lib/utils/typed-json";
import { rpc } from "@/lib/rpc";
import { apiUrl } from "@/lib/api-client";
import type {
  DateRange,
  KpiData,
  PrevKpiData,
  Refund,
  RevenueTrendPoint,
  AiInsight,
} from "@/types/analytics";

interface RefundsResponse {
  refunds?: Refund[];
}

interface RevenueTrendResponse {
  trend?: RevenueTrendPoint[];
}

interface AiInsightsResponse {
  insights?: AiInsight[];
}

interface ShopifyConnectedResponse {
  shopify?: unknown;
}

function useToken() {
  return useAuthStore((s) => s.session?.access_token ?? "");
}

export const analyticsKeys = {
  all: ["analytics"] as const,
  kpis: (range: DateRange, storeId: string | null) =>
    [...analyticsKeys.all, "kpis", range.from, range.to, storeId] as const,
  prevKpis: (range: DateRange, storeId: string | null) =>
    [...analyticsKeys.all, "prevKpis", range.from, range.to, storeId] as const,
  refunds: (range: DateRange, storeId: string | null) =>
    [...analyticsKeys.all, "refunds", range.from, range.to, storeId] as const,
  allRefunds: (storeId: string | null) =>
    [...analyticsKeys.all, "allRefunds", storeId] as const,
  revenueTrend: (range: DateRange, storeId: string | null) =>
    [
      ...analyticsKeys.all,
      "revenueTrend",
      range.from,
      range.to,
      storeId,
    ] as const,
  aiInsights: () => [...analyticsKeys.all, "aiInsights"] as const,
  shopifyConnected: () => [...analyticsKeys.all, "shopifyConnected"] as const,
};

export function useKpis(range: DateRange) {
  const token = useToken();
  const activeStoreId = useStoreStore((s) => s.activeStoreId);
  const storeParam = activeStoreId ? `&store_id=${activeStoreId}` : "";
  return useQuery<KpiData>({
    queryKey: analyticsKeys.kpis(range, activeStoreId),
    queryFn: async () => {
      const res = await fetch(
        `${apiUrl('shopify/kpis')}?from=${range.from}&to=${range.to}${storeParam}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      return parseJson<KpiData>(res);
    },
    enabled: !!token && !!activeStoreId,
    staleTime: 5 * 60_000,
  });
}

export function usePrevKpis(range: DateRange) {
  const token = useToken();
  const activeStoreId = useStoreStore((s) => s.activeStoreId);
  const storeParam = activeStoreId ? `&store_id=${activeStoreId}` : "";
  return useQuery<PrevKpiData>({
    queryKey: analyticsKeys.prevKpis(range, activeStoreId),
    queryFn: async () => {
      const res = await fetch(
        `${apiUrl('shopify/kpis')}?from=${range.from}&to=${range.to}${storeParam}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch previous KPIs");
      return parseJson<PrevKpiData>(res);
    },
    enabled: !!token && !!activeStoreId,
    staleTime: 5 * 60_000,
  });
}

export function useRefunds(range: DateRange) {
  const token = useToken();
  const activeStoreId = useStoreStore((s) => s.activeStoreId);
  const storeParam = activeStoreId ? `&store_id=${activeStoreId}` : "";
  return useQuery<Refund[]>({
    queryKey: analyticsKeys.refunds(range, activeStoreId),
    queryFn: async () => {
      const res = await fetch(
        `${apiUrl('shopify/refunds')}?from=${range.from}&to=${range.to}${storeParam}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch refunds");
      const d = await parseJson<RefundsResponse>(res);
      return d.refunds ?? [];
    },
    enabled: !!token && !!activeStoreId,
    staleTime: 5 * 60_000,
  });
}

export function useAllRefunds() {
  const token = useToken();
  const activeStoreId = useStoreStore((s) => s.activeStoreId);
  const storeParam = activeStoreId ? `&store_id=${activeStoreId}` : "";
  return useQuery<Refund[]>({
    queryKey: analyticsKeys.allRefunds(activeStoreId),
    queryFn: async () => {
      const from = new Date(Date.now() - 365 * 86400000)
        .toISOString()
        .slice(0, 10);
      const to = new Date().toISOString().slice(0, 10);
      const res = await fetch(
        `${apiUrl('shopify/refunds')}?from=${from}&to=${to}${storeParam}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch all refunds");
      const d = await parseJson<RefundsResponse>(res);
      return d.refunds ?? [];
    },
    enabled: !!token && !!activeStoreId,
    staleTime: 5 * 60_000,
  });
}

export function useRevenueTrend(range: DateRange) {
  const token = useToken();
  const activeStoreId = useStoreStore((s) => s.activeStoreId);
  const storeParam = activeStoreId ? `&store_id=${activeStoreId}` : "";
  return useQuery<RevenueTrendPoint[]>({
    queryKey: analyticsKeys.revenueTrend(range, activeStoreId),
    queryFn: async () => {
      const res = await fetch(
        `${apiUrl('shopify/revenue-trend')}?from=${range.from}&to=${range.to}${storeParam}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch revenue trend");
      const d = await parseJson<RevenueTrendResponse>(res);
      return d.trend ?? [];
    },
    enabled: !!token && !!activeStoreId,
    staleTime: 5 * 60_000,
  });
}

export function useAiInsights(refunds: Refund[]) {
  const token = useToken();
  return useQuery<AiInsight[]>({
    queryKey: analyticsKeys.aiInsights(),
    queryFn: async () => {
      const res = await fetch("/api/analytics/refund-insights", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refunds }),
      });
      if (!res.ok) throw new Error("Failed to fetch AI insights");
      const d = await parseJson<AiInsightsResponse>(res);
      return d.insights ?? [];
    },
    enabled: !!token && !!refunds.length,
    staleTime: 10 * 60_000,
  });
}

export function useShopifyConnected() {
  const token = useToken();
  const activeStoreId = useStoreStore((s) => s.activeStoreId);
  return useQuery<boolean>({
    queryKey: [...analyticsKeys.shopifyConnected(), activeStoreId],
    queryFn: async () => {
      const data = await rpc<ShopifyConnectedResponse>(
        "api_get_shopify_integration",
        { p_store_id: activeStoreId ?? null },
      );
      return Boolean(data?.shopify);
    },
    enabled: !!token && !!activeStoreId,
    staleTime: 5 * 60_000,
  });
}
