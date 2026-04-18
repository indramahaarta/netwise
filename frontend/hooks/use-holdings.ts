'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Holding, Transaction, CashFlow, Dividend, PortfolioFee } from '@/lib/types'

export function useHoldings(portfolioId: number | string) {
  return useQuery<Holding[]>({
    queryKey: ['holdings', portfolioId],
    queryFn: () =>
      api.get(`/api/v1/portfolios/${portfolioId}/holdings`).then((r) => r.data),
    enabled: !!portfolioId,
    refetchInterval: 60_000, // refresh prices every minute
  })
}

export function useBuyStock(portfolioId: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      symbol: string
      quantity: number
      price: number
      fee?: number
    }) =>
      api
        .post(`/api/v1/portfolios/${portfolioId}/buy`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holdings', portfolioId] })
      qc.invalidateQueries({ queryKey: ['portfolios', portfolioId] })
      qc.invalidateQueries({ queryKey: ['transactions', portfolioId] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}

export function useSellStock(portfolioId: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      symbol: string
      quantity: number
      price: number
      fee?: number
    }) =>
      api
        .post(`/api/v1/portfolios/${portfolioId}/sell`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holdings', portfolioId] })
      qc.invalidateQueries({ queryKey: ['portfolios', portfolioId] })
      qc.invalidateQueries({ queryKey: ['transactions', portfolioId] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}

export function useTransactions(
  portfolioId: number | string,
  filters?: { ticker?: string; side?: string; from?: string; to?: string }
) {
  return useQuery<Transaction[]>({
    queryKey: ['transactions', portfolioId, filters],
    queryFn: () =>
      api
        .get(`/api/v1/portfolios/${portfolioId}/transactions`, {
          params: filters,
        })
        .then((r) => r.data),
    enabled: !!portfolioId,
  })
}

export function useCashFlows(portfolioId: number | string) {
  return useQuery<CashFlow[]>({
    queryKey: ['cashflows', portfolioId],
    queryFn: () =>
      api
        .get(`/api/v1/portfolios/${portfolioId}/cash-flows`)
        .then((r) => r.data),
    enabled: !!portfolioId,
  })
}

export function useDeposit(portfolioId: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { source_amount: number; broker_rate: number }) =>
      api
        .post(`/api/v1/portfolios/${portfolioId}/deposit`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolios', portfolioId] })
      qc.invalidateQueries({ queryKey: ['cashflows', portfolioId] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}

export function useWithdraw(portfolioId: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { target_amount: number; broker_rate: number }) =>
      api
        .post(`/api/v1/portfolios/${portfolioId}/withdraw`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolios', portfolioId] })
      qc.invalidateQueries({ queryKey: ['cashflows', portfolioId] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}

export function useDividends(portfolioId: number | string) {
  return useQuery<Dividend[]>({
    queryKey: ['dividends', portfolioId],
    queryFn: () =>
      api
        .get(`/api/v1/portfolios/${portfolioId}/dividends`)
        .then((r) => r.data),
    enabled: !!portfolioId,
  })
}

export function useAddDividend(portfolioId: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { symbol: string; amount: number; currency: string }) =>
      api
        .post(`/api/v1/portfolios/${portfolioId}/dividends`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dividends', portfolioId] })
      qc.invalidateQueries({ queryKey: ['portfolios', portfolioId] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}

export function useFees(portfolioId: number | string) {
  return useQuery<PortfolioFee[]>({
    queryKey: ['fees', portfolioId],
    queryFn: () =>
      api
        .get(`/api/v1/portfolios/${portfolioId}/fees`)
        .then((r) => r.data),
    enabled: !!portfolioId,
  })
}

export function useAddFee(portfolioId: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { amount: number; note?: string }) =>
      api
        .post(`/api/v1/portfolios/${portfolioId}/fees`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fees', portfolioId] })
      qc.invalidateQueries({ queryKey: ['portfolios', portfolioId] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}

export function useSetCash(portfolioId: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { amount: number }) =>
      api
        .put(`/api/v1/portfolios/${portfolioId}/cash`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolios', portfolioId] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}

export function useAddHoldingDirect(portfolioId: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { symbol: string; shares: number; avg_cost: number }) =>
      api
        .post(`/api/v1/portfolios/${portfolioId}/holdings`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holdings', portfolioId] })
      qc.invalidateQueries({ queryKey: ['portfolios', portfolioId] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}
