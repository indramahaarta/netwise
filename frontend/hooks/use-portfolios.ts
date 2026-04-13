'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Portfolio } from '@/lib/types'

export function usePortfolios() {
  return useQuery<Portfolio[]>({
    queryKey: ['portfolios'],
    queryFn: () => api.get('/api/v1/portfolios').then((r) => r.data),
  })
}

export function usePortfolio(id: number | string) {
  return useQuery<Portfolio>({
    queryKey: ['portfolios', id],
    queryFn: () => api.get(`/api/v1/portfolios/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreatePortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; currency: string }) =>
      api.post('/api/v1/portfolios', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolios'] }),
  })
}

export function useUpdatePortfolio(id: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string; currency?: string }) =>
      api.put(`/api/v1/portfolios/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolios'] })
      qc.invalidateQueries({ queryKey: ['portfolios', id] })
    },
  })
}

export function usePortfolioRealized(id: number | string) {
  return useQuery<{ realized_pnl: string }>({
    queryKey: ['portfolio-realized', id],
    queryFn: () =>
      api.get(`/api/v1/portfolios/${id}/realized`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useDeletePortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) =>
      api.delete(`/api/v1/portfolios/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolios'] }),
  })
}
