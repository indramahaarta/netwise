'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useWallet,
  useWalletTransactions,
  useWalletCategories,
  useAddWalletTransaction,
  useSetInitialBalance,
  useTransferWallets,
  useWalletToPortfolio,
  usePortfolioToWallet,
  useDeleteWallet,
} from '@/hooks/use-wallets'
import { useWallets } from '@/hooks/use-wallets'
import { usePortfolios } from '@/hooks/use-portfolios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, TrendingUp, TrendingDown, ArrowLeftRight, Building2, Wallet, Plus } from 'lucide-react'
import type { WalletTransaction } from '@/lib/types'

function fmtIDR(value: string | number | undefined) {
  const num = parseFloat(String(value ?? '0'))
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function txSign(tx: WalletTransaction) {
  return ['INCOME', 'TRANSFER_IN', 'PORTFOLIO_WITHDRAWAL'].includes(tx.type) ? '+' : '-'
}

function txColor(tx: WalletTransaction) {
  return ['INCOME', 'TRANSFER_IN', 'PORTFOLIO_WITHDRAWAL'].includes(tx.type)
    ? 'text-green-600'
    : 'text-destructive'
}

function txLabel(tx: WalletTransaction) {
  switch (tx.type) {
    case 'INCOME': return tx.category_name ?? 'Income'
    case 'EXPENSE': return tx.category_name ?? 'Expense'
    case 'TRANSFER_IN': return `From ${tx.related_wallet_name ?? 'wallet'}`
    case 'TRANSFER_OUT': return `To ${tx.related_wallet_name ?? 'wallet'}`
    case 'PORTFOLIO_DEPOSIT': return 'To Portfolio'
    case 'PORTFOLIO_WITHDRAWAL': return 'From Portfolio'
    default: return tx.type
  }
}

type ActionType = 'income' | 'expense' | 'transfer' | 'portfolio-deposit' | 'portfolio-withdraw' | 'import' | null

export default function WalletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { data: wallet, isLoading: wLoading } = useWallet(id)
  const { data: txs, isLoading: txLoading } = useWalletTransactions(id)
  const { data: categories } = useWalletCategories()
  const { data: wallets } = useWallets()
  const { data: portfolios } = usePortfolios()

  const addTx = useAddWalletTransaction(id)
  const setInitial = useSetInitialBalance(id)
  const transfer = useTransferWallets()
  const walletToPortfolio = useWalletToPortfolio(id)
  const portfolioToWallet = usePortfolioToWallet(id)
  const deleteWallet = useDeleteWallet(id)

  const [action, setAction] = useState<ActionType>(null)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [toWalletId, setToWalletId] = useState('')
  const [portfolioId, setPortfolioId] = useState('')
  const [brokerRate, setBrokerRate] = useState('')
  const [saving, setSaving] = useState(false)

  const incomeCategories = (categories ?? []).filter((c) => c.type === 'INCOME')
  const expenseCategories = (categories ?? []).filter((c) => c.type === 'EXPENSE')
  const otherWallets = (wallets ?? []).filter((w) => String(w.id) !== id)

  function resetForm() {
    setAmount('')
    setCategoryId('')
    setNote('')
    setToWalletId('')
    setPortfolioId('')
    setBrokerRate('')
    setAction(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return
    setSaving(true)

    try {
      if (action === 'income') {
        await addTx.mutateAsync({ type: 'INCOME', amount: parseFloat(amount), category_id: parseInt(categoryId), note })
      } else if (action === 'expense') {
        await addTx.mutateAsync({ type: 'EXPENSE', amount: parseFloat(amount), category_id: parseInt(categoryId), note })
      } else if (action === 'import') {
        await setInitial.mutateAsync({ amount: parseFloat(amount) })
      } else if (action === 'transfer') {
        await transfer.mutateAsync({
          from_wallet_id: parseInt(id),
          to_wallet_id: parseInt(toWalletId),
          amount: parseFloat(amount),
          note,
        })
      } else if (action === 'portfolio-deposit') {
        await walletToPortfolio.mutateAsync({
          portfolio_id: parseInt(portfolioId),
          source_amount: parseFloat(amount),
          broker_rate: parseFloat(brokerRate),
        })
      } else if (action === 'portfolio-withdraw') {
        await portfolioToWallet.mutateAsync({
          portfolio_id: parseInt(portfolioId),
          target_amount: parseFloat(amount),
          broker_rate: parseFloat(brokerRate),
        })
      }
      resetForm()
    } catch {
      // error handled by mutations
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete wallet "${wallet?.name}"? This cannot be undone.`)) return
    await deleteWallet.mutateAsync()
    router.push('/wallets')
  }

  if (wLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!wallet) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/wallets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">{wallet.name}</h1>
            <p className="text-xs text-muted-foreground">{wallet.currency}</p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          Delete
        </Button>
      </div>

      {/* Balance card */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <p className="text-xs text-muted-foreground">Current Balance</p>
          <p className="text-3xl font-bold mt-1">{fmtIDR(wallet.balance)}</p>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAction('income')}>
          <TrendingUp className="h-4 w-4 text-green-600" /> Income
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAction('expense')}>
          <TrendingDown className="h-4 w-4 text-destructive" /> Expense
        </Button>
        {otherWallets.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAction('transfer')}>
            <ArrowLeftRight className="h-4 w-4" /> Transfer
          </Button>
        )}
        {(portfolios ?? []).length > 0 && (
          <>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAction('portfolio-deposit')}>
              <Building2 className="h-4 w-4" /> To Portfolio
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAction('portfolio-withdraw')}>
              <Wallet className="h-4 w-4" /> From Portfolio
            </Button>
          </>
        )}
        {parseFloat(wallet.balance ?? '0') === 0 && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAction('import')}>
            <Plus className="h-4 w-4" /> Set Initial Balance
          </Button>
        )}
      </div>

      {/* Action form */}
      {action && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {action === 'income' && 'Add Income'}
              {action === 'expense' && 'Add Expense'}
              {action === 'transfer' && 'Transfer to Wallet'}
              {action === 'portfolio-deposit' && 'Move to Portfolio'}
              {action === 'portfolio-withdraw' && 'Move from Portfolio'}
              {action === 'import' && 'Set Initial Balance'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Amount */}
              <div className="space-y-1.5">
                <Label>
                  {action === 'portfolio-withdraw' ? 'Portfolio Amount (USD)' : 'Amount (IDR)'}
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              {/* Category selector */}
              {(action === 'income' || action === 'expense') && (
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                  >
                    <option value="">Select category...</option>
                    {(action === 'income' ? incomeCategories : expenseCategories).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Transfer target wallet */}
              {action === 'transfer' && (
                <div className="space-y-1.5">
                  <Label>Destination Wallet</Label>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={toWalletId}
                    onChange={(e) => setToWalletId(e.target.value)}
                    required
                  >
                    <option value="">Select wallet...</option>
                    {otherWallets.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Portfolio + broker rate */}
              {(action === 'portfolio-deposit' || action === 'portfolio-withdraw') && (
                <>
                  <div className="space-y-1.5">
                    <Label>Portfolio</Label>
                    <select
                      className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                      value={portfolioId}
                      onChange={(e) => setPortfolioId(e.target.value)}
                      required
                    >
                      <option value="">Select portfolio...</option>
                      {(portfolios ?? []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.currency})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Broker Rate (IDR per 1 {portfolios?.find(p => String(p.id) === portfolioId)?.currency ?? 'USD'})</Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 16000"
                      value={brokerRate}
                      onChange={(e) => setBrokerRate(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {/* Note */}
              {(action === 'income' || action === 'expense' || action === 'transfer') && (
                <div className="space-y-1.5">
                  <Label>Note (optional)</Label>
                  <Input
                    placeholder="Add a note..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="ghost" className="flex-1" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? 'Saving...' : 'Confirm'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Transaction history */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Transactions</h2>

        {txLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : (txs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden space-y-2">
              {(txs ?? []).map((tx) => (
                <Card key={tx.id}>
                  <CardContent className="pt-3 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{txLabel(tx)}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(tx.transaction_time)}</p>
                        {tx.note && <p className="text-xs text-muted-foreground mt-0.5">{tx.note}</p>}
                      </div>
                      <p className={`text-sm font-semibold ${txColor(tx)}`}>
                        {txSign(tx)}{fmtIDR(tx.amount)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category / Destination</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(txs ?? []).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">{fmtDate(tx.transaction_time)}</TableCell>
                      <TableCell>
                        <Badge variant={['INCOME', 'TRANSFER_IN', 'PORTFOLIO_WITHDRAWAL'].includes(tx.type) ? 'default' : 'destructive'}>
                          {tx.type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{txLabel(tx)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.note ?? '—'}</TableCell>
                      <TableCell className={`text-right font-medium text-sm ${txColor(tx)}`}>
                        {txSign(tx)}{fmtIDR(tx.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
