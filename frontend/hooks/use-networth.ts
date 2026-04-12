'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { NetWorth, NetWorthSnapshot, StockSearchResult } from '@/lib/types'

export function useNetWorth(currency: 'USD' | 'IDR' = 'USD') {
  return useQuery<NetWorth>({
    queryKey: ['networth', currency],
    queryFn: () =>
      api.get('/api/v1/networth', { params: { currency } }).then((r) => r.data),
    staleTime: 60_000,
  })
}

export function useNetWorthSnapshots(range: string) {
  return useQuery<NetWorthSnapshot[]>({
    queryKey: ['networth-snapshots', range],
    queryFn: () =>
      api
        .get('/api/v1/networth/snapshots', { params: { range } })
        .then((r) => r.data),
  })
}

export function useStockSearch(query: string) {
  return useQuery<{ count: number; result: StockSearchResult[] }>({
    queryKey: ['stock-search', query],
    queryFn: () =>
      api.get('/api/v1/stocks/search', { params: { q: query } }).then((r) => r.data),
    enabled: query.length >= 2,
    staleTime: 10_000,
  })
}
