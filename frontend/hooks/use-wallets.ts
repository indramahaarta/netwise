'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Wallet, WalletCategory, WalletTransaction } from '@/lib/types'

export function useWallets() {
  return useQuery<Wallet[]>({
    queryKey: ['wallets'],
    queryFn: () => api.get('/api/v1/wallets').then((r) => r.data),
  })
}

export function useWallet(id: string | number) {
  return useQuery<Wallet>({
    queryKey: ['wallets', id],
    queryFn: () => api.get(`/api/v1/wallets/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useWalletTransactions(id: string | number, limit = 50, offset = 0) {
  return useQuery<WalletTransaction[]>({
    queryKey: ['wallet-transactions', id, limit, offset],
    queryFn: () =>
      api
        .get(`/api/v1/wallets/${id}/transactions`, { params: { limit, offset } })
        .then((r) => r.data),
    enabled: !!id,
  })
}

export function useWalletCategories() {
  return useQuery<WalletCategory[]>({
    queryKey: ['wallet-categories'],
    queryFn: () => api.get('/api/v1/wallet-categories').then((r) => r.data),
  })
}

export function useCreateWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) =>
      api.post('/api/v1/wallets', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  })
}

export function useUpdateWallet(id: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) =>
      api.put(`/api/v1/wallets/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallets'] })
      qc.invalidateQueries({ queryKey: ['wallets', id] })
    },
  })
}

export function useDeleteWallet(id: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(`/api/v1/wallets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  })
}

export function useSetInitialBalance(id: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { amount: number }) =>
      api.post(`/api/v1/wallets/${id}/import`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallets', id] })
      qc.invalidateQueries({ queryKey: ['wallet-transactions', id] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}

export function useAddWalletTransaction(id: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { type: 'INCOME' | 'EXPENSE'; amount: number; category_id: number; note?: string }) =>
      api.post(`/api/v1/wallets/${id}/transactions`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallets', id] })
      qc.invalidateQueries({ queryKey: ['wallet-transactions', id] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}

export function useTransferWallets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { from_wallet_id: number; to_wallet_id: number; amount: number; note?: string }) =>
      api.post('/api/v1/wallets/transfer', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  })
}

export function useWalletToPortfolio(id: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { portfolio_id: number; source_amount: number; broker_rate: number }) =>
      api.post(`/api/v1/wallets/${id}/portfolio-deposit`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallets'] })
      qc.invalidateQueries({ queryKey: ['networth'] })
      qc.invalidateQueries({ queryKey: ['portfolios'] })
    },
  })
}

export function usePortfolioToWallet(id: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { portfolio_id: number; target_amount: number; broker_rate: number }) =>
      api.post(`/api/v1/wallets/${id}/portfolio-withdraw`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallets'] })
      qc.invalidateQueries({ queryKey: ['networth'] })
      qc.invalidateQueries({ queryKey: ['portfolios'] })
    },
  })
}

// Portfolio-level transfers (used from CashFlowDialog — wallet ID is dynamic)
export function useWalletPortfolioDeposit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ walletId, portfolioId, sourceAmount, brokerRate }: {
      walletId: number; portfolioId: number; sourceAmount: number; brokerRate: number
    }) =>
      api.post(`/api/v1/wallets/${walletId}/portfolio-deposit`, {
        portfolio_id: portfolioId,
        source_amount: sourceAmount,
        broker_rate: brokerRate,
      }).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['wallets'] })
      qc.invalidateQueries({ queryKey: ['wallets', String(vars.walletId)] })
      qc.invalidateQueries({ queryKey: ['wallet-transactions', String(vars.walletId)] })
      qc.invalidateQueries({ queryKey: ['networth'] })
      qc.invalidateQueries({ queryKey: ['portfolios'] })
    },
  })
}

export function useWalletPortfolioWithdraw() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ walletId, portfolioId, targetAmount, brokerRate }: {
      walletId: number; portfolioId: number; targetAmount: number; brokerRate: number
    }) =>
      api.post(`/api/v1/wallets/${walletId}/portfolio-withdraw`, {
        portfolio_id: portfolioId,
        target_amount: targetAmount,
        broker_rate: brokerRate,
      }).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['wallets'] })
      qc.invalidateQueries({ queryKey: ['wallets', String(vars.walletId)] })
      qc.invalidateQueries({ queryKey: ['wallet-transactions', String(vars.walletId)] })
      qc.invalidateQueries({ queryKey: ['networth'] })
      qc.invalidateQueries({ queryKey: ['portfolios'] })
    },
  })
}

export function useCreateWalletCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; type: 'INCOME' | 'EXPENSE' }) =>
      api.post('/api/v1/wallet-categories', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet-categories'] }),
  })
}

export function useDeleteWalletCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/api/v1/wallet-categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet-categories'] }),
  })
}

export function useUpdateWalletTransaction(walletId: string | number, txId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      type: 'INCOME' | 'EXPENSE'
      amount: number
      category_id: number
      note?: string
      transaction_time: string
    }) =>
      api.put(`/api/v1/wallets/${walletId}/transactions/${txId}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-transactions', walletId] })
      qc.invalidateQueries({ queryKey: ['wallets', walletId] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}

export function useDeleteWalletTransaction(walletId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (txId: number) =>
      api.delete(`/api/v1/wallets/${walletId}/transactions/${txId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet-transactions', walletId] })
      qc.invalidateQueries({ queryKey: ['wallets', walletId] })
      qc.invalidateQueries({ queryKey: ['networth'] })
    },
  })
}

export function useWalletSummary(id: string | number, from: string, to: string) {
  return useQuery<any>({
    queryKey: ['wallet-summary', id, from, to],
    queryFn: () =>
      api.get(`/api/v1/wallets/${id}/summary`, { params: { from, to } }).then((r) => r.data),
    enabled: !!id && !!from && !!to,
  })
}

export function useWalletCategoryBreakdown(id: string | number, from: string, to: string) {
  return useQuery<any[]>({
    queryKey: ['wallet-category-breakdown', id, from, to],
    queryFn: () =>
      api.get(`/api/v1/wallets/${id}/summary/categories`, { params: { from, to } }).then((r) => r.data),
    enabled: !!id && !!from && !!to,
  })
}

export function useWalletSnapshots(id: string | number, from: string, to: string) {
  return useQuery<any[]>({
    queryKey: ['wallet-snapshots', id, from, to],
    queryFn: () =>
      api.get(`/api/v1/wallets/${id}/snapshots`, { params: { from, to } }).then((r) => r.data),
    enabled: !!id && !!from && !!to,
  })
}

export function useWalletTransactionsByDateRange(id: string | number, from?: string, to?: string) {
  return useQuery<any[]>({
    queryKey: ['wallet-transactions-range', id, from, to],
    queryFn: () =>
      api.get(`/api/v1/wallets/${id}/transactions`, { params: { from, to } }).then((r) => r.data),
    enabled: !!id,
  })
}

export function useAggregatedWalletSnapshots(range: string) {
  return useQuery<{ snapshot_date: string; total_balance: string }[]>({
    queryKey: ['wallet-snapshots-aggregate', range],
    queryFn: () =>
      api.get('/api/v1/wallets/snapshots', { params: { range } }).then((r) => r.data),
    enabled: !!range,
    staleTime: 60 * 60 * 1000, // 1 hour — matches backend cache TTL
  })
}
