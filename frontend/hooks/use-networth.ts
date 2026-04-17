'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { NetWorth, NetWorthSnapshot, PortfolioSnapshot, StockSearchResult } from '@/lib/types'

export function useNetWorth(currency: 'USD' | 'IDR' = 'USD') {
  return useQuery<NetWorth>({
    queryKey: ['networth', currency],
    queryFn: () =>
      api.get('/api/v1/networth', { params: { currency } }).then((r) => r.data),
    staleTime: 60_000,
  })
}

export function useNetWorthSnapshots(range: string, currency: 'USD' | 'IDR' = 'USD') {
  return useQuery<NetWorthSnapshot[]>({
    queryKey: ['networth-snapshots', range, currency],
    queryFn: () =>
      api
        .get('/api/v1/networth/snapshots', { params: { range, currency } })
        .then((r) => r.data),
  })
}

export function usePortfolioSnapshots(portfolioId: string | number | null, range: string, currency: 'USD' | 'IDR' = 'USD') {
  return useQuery<PortfolioSnapshot[]>({
    queryKey: ['portfolio-snapshots', portfolioId, range, currency],
    queryFn: () =>
      api
        .get(`/api/v1/portfolios/${portfolioId}/snapshots`, { params: { range, currency } })
        .then((r) => r.data),
    enabled: !!portfolioId,
  })
}

export function useStockSearch(query: string, market: 'US' | 'ID' = 'US') {
  return useQuery<{ count: number; result: StockSearchResult[] }>({
    queryKey: ['stock-search', query, market],
    queryFn: () =>
      api.get('/api/v1/stocks/search', { params: { q: query, market } }).then((r) => r.data),
    enabled: query.length >= 2,
    staleTime: 10_000,
  })
}
