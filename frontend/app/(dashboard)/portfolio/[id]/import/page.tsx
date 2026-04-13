'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSetCash, useAddHoldingDirect } from '@/hooks/use-holdings'
import { useStockSearch } from '@/hooks/use-networth'
import { usePortfolio } from '@/hooks/use-portfolios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, Plus, X } from 'lucide-react'
import Link from 'next/link'

interface HoldingRow {
  id: number
  symbol: string
  shares: string
  avgCost: string
  searchQuery: string
  error: string
}

let nextId = 0

function emptyRow(): HoldingRow {
  return { id: nextId++, symbol: '', shares: '', avgCost: '', searchQuery: '', error: '' }
}

export default function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: portfolio } = usePortfolio(id)

  const [cashAmount, setCashAmount] = useState('')
  const [rows, setRows] = useState<HoldingRow[]>([emptyRow()])
  const [saving, setSaving] = useState(false)

  const setCash = useSetCash(id)
  const addHolding = useAddHoldingDirect(id)

  // Stock search state per row — use a single search query for the focused row
  const [focusedRowId, setFocusedRowId] = useState<number | null>(null)
  const focusedRow = rows.find((r) => r.id === focusedRowId)
  const { data: searchResults } = useStockSearch(focusedRow?.searchQuery || '')

  function updateRow(rowId: number, patch: Partial<HoldingRow>) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }

  function removeRow(rowId: number) {
    setRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()])
  }

  async function handleSave() {
    setSaving(true)

    if (cashAmount && parseFloat(cashAmount) >= 0) {
      await setCash.mutateAsync({ amount: parseFloat(cashAmount) }).catch(() => { })
    }

    const filledRows = rows.filter((r) => r.symbol && r.shares && r.avgCost)
    await Promise.all(
      filledRows.map((r) =>
        addHolding
          .mutateAsync({
            symbol: r.symbol,
            shares: parseFloat(r.shares),
            avg_cost: parseFloat(r.avgCost),
          })
          .catch((err: unknown) => {
            const e = err as { response?: { data?: { error?: string } } }
            updateRow(r.id, { error: e.response?.data?.error || 'Failed to add holding' })
          })
      )
    )

    setSaving(false)
    router.push(`/portfolio/${id}`)
  }

  const portfolioLabel = portfolio
    ? `${portfolio.name} (${portfolio.currency})`
    : 'Portfolio'

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/portfolio/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Import Holdings</h1>
          <p className="text-sm text-muted-foreground">{portfolioLabel}</p>
        </div>
      </div>

      {/* Cash Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cash Balance</CardTitle>
          <CardDescription>Set the current cash in this portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label>Amount ({portfolio?.currency ?? 'USD'})</Label>
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Holdings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Holdings</CardTitle>
          <CardDescription>Add your existing positions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="space-y-1">
              {/* Mobile: stacked layout */}
              <div className="md:hidden rounded-lg border p-3 space-y-2 relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                >
                  <X className="h-3 w-3" />
                </Button>
                <div className="relative pr-8">
                  <Input
                    placeholder="Symbol (e.g. AAPL)"
                    value={row.symbol || row.searchQuery}
                    onChange={(e) => updateRow(row.id, { searchQuery: e.target.value, symbol: '' })}
                    onFocus={() => setFocusedRowId(row.id)}
                    onBlur={() => setTimeout(() => setFocusedRowId(null), 150)}
                  />
                  {focusedRowId === row.id && row.searchQuery && searchResults?.result && searchResults.result.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 border rounded-md bg-background shadow-md max-h-40 overflow-y-auto">
                      {searchResults.result.slice(0, 6).map((r) => (
                        <button
                          key={r.symbol}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { updateRow(row.id, { symbol: r.symbol, searchQuery: '' }); setFocusedRowId(null) }}
                        >
                          <span className="font-medium">{r.displaySymbol}</span>
                          <span className="text-muted-foreground text-xs truncate ml-2">{r.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {row.symbol && <p className="text-xs text-primary mt-1">Selected: {row.symbol}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" step="any" min="0" placeholder="Shares" value={row.shares}
                    onChange={(e) => updateRow(row.id, { shares: e.target.value })} />
                  <Input type="number" step="any" min="0" placeholder="Avg cost" value={row.avgCost}
                    onChange={(e) => updateRow(row.id, { avgCost: e.target.value })} />
                </div>
              </div>

              {/* Desktop: 4-column grid */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start">
                <div className="relative">
                  <Input
                    placeholder="Symbol (e.g. AAPL)"
                    value={row.symbol || row.searchQuery}
                    onChange={(e) => updateRow(row.id, { searchQuery: e.target.value, symbol: '' })}
                    onFocus={() => setFocusedRowId(row.id)}
                    onBlur={() => setTimeout(() => setFocusedRowId(null), 150)}
                  />
                  {focusedRowId === row.id && row.searchQuery && searchResults?.result && searchResults.result.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 border rounded-md bg-background shadow-md max-h-40 overflow-y-auto">
                      {searchResults.result.slice(0, 6).map((r) => (
                        <button
                          key={r.symbol}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { updateRow(row.id, { symbol: r.symbol, searchQuery: '' }); setFocusedRowId(null) }}
                        >
                          <span className="font-medium">{r.displaySymbol}</span>
                          <span className="text-muted-foreground text-xs truncate ml-2">{r.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {row.symbol && <p className="text-xs text-primary mt-1">Selected: {row.symbol}</p>}
                </div>
                <Input type="number" step="any" min="0" placeholder="Shares" value={row.shares}
                  onChange={(e) => updateRow(row.id, { shares: e.target.value })} />
                <Input type="number" step="any" min="0" placeholder="Avg cost" value={row.avgCost}
                  onChange={(e) => updateRow(row.id, { avgCost: e.target.value })} />
                <Button type="button" variant="ghost" size="icon" className="shrink-0"
                  onClick={() => removeRow(row.id)} disabled={rows.length === 1}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {row.error && <p className="text-xs text-destructive">{row.error}</p>}
            </div>
          ))}

          <Button type="button" variant="ghost" size="sm" onClick={addRow} className="gap-1">
            <Plus className="h-4 w-4" />
            Add row
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/portfolio/${id}`)}
        >
          Skip
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save & View'}
        </Button>
      </div>
    </div>
  )
}
