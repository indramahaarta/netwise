'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useWallets, useWalletPortfolioDeposit, useWalletPortfolioWithdraw } from '@/hooks/use-wallets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  portfolioId: number | string
  portfolioCurrency: string
  type: 'DEPOSIT' | 'WITHDRAWAL'
  open: boolean
  onClose: () => void
}

export function CashFlowDialog({ portfolioId, portfolioCurrency, type, open, onClose }: Props) {
  const [walletId, setWalletId] = useState('')
  const [amount, setAmount] = useState('')
  const [brokerRate, setBrokerRate] = useState('')
  const [error, setError] = useState('')

  const { data: wallets } = useWallets()
  const deposit = useWalletPortfolioDeposit()
  const withdraw = useWalletPortfolioWithdraw()
  const isPending = deposit.isPending || withdraw.isPending

  const convertedAmount = amount && brokerRate
    ? type === 'DEPOSIT'
      ? (parseFloat(amount) / parseFloat(brokerRate)).toFixed(4)
      : (parseFloat(amount) * parseFloat(brokerRate)).toFixed(0)
    : null

  function handleClose() {
    setWalletId('')
    setAmount('')
    setBrokerRate('')
    setError('')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!walletId) {
      setError('Please select a wallet')
      return
    }
    try {
      if (type === 'DEPOSIT') {
        await deposit.mutateAsync({
          walletId: parseInt(walletId),
          portfolioId: Number(portfolioId),
          sourceAmount: parseFloat(amount),
          brokerRate: parseFloat(brokerRate),
        })
      } else {
        await withdraw.mutateAsync({
          walletId: parseInt(walletId),
          portfolioId: Number(portfolioId),
          targetAmount: parseFloat(amount),
          brokerRate: parseFloat(brokerRate),
        })
      }
      handleClose()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Transaction failed')
    }
  }

  const hasWallets = (wallets ?? []).length > 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {type === 'DEPOSIT' ? 'Deposit from Wallet' : 'Withdraw to Wallet'}
          </DialogTitle>
        </DialogHeader>

        {!hasWallets ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              You need at least one wallet to {type === 'DEPOSIT' ? 'deposit from' : 'withdraw to'}.
            </p>
            <Link href="/wallets/new">
              <Button className="w-full" onClick={handleClose}>Create a Wallet</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Wallet selector */}
            <div className="space-y-2">
              <Label>{type === 'DEPOSIT' ? 'Source Wallet' : 'Destination Wallet'}</Label>
              <select
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                required
              >
                <option value="">Select wallet...</option>
                {(wallets ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {w.balance !== undefined
                      ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(parseFloat(w.balance ?? '0'))
                      : w.currency}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>
                {type === 'DEPOSIT' ? 'Amount (IDR)' : `Amount (${portfolioCurrency})`}
              </Label>
              <Input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            {/* Broker rate */}
            <div className="space-y-2">
              <Label>Broker Rate (IDR per {portfolioCurrency})</Label>
              <Input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                placeholder="e.g. 16000"
                value={brokerRate}
                onChange={(e) => setBrokerRate(e.target.value)}
                required
              />
            </div>

            {/* Conversion preview */}
            {convertedAmount && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {type === 'DEPOSIT'
                      ? `Credited to portfolio (${portfolioCurrency})`
                      : 'IDR received by wallet'}
                  </span>
                  <span className="font-medium">
                    {type === 'DEPOSIT'
                      ? `${convertedAmount} ${portfolioCurrency}`
                      : `Rp ${parseInt(convertedAmount).toLocaleString('id-ID')}`}
                  </span>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? 'Processing...' : type === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
