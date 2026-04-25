/** Format a string as the user types: inserts `.` every 3 digits, `,` for decimal.
 *  Accepts a trailing `.` as the decimal separator when no `,` is present yet,
 *  so mobile en-locale keypads (which show `.` instead of `,`) work correctly. */
export function formatNumberInput(input: string): string {
  // If there is no comma yet and input ends with `.`, the user typed `.` as the decimal separator.
  // Convert only that trailing dot; all other dots are thousands separators added by this formatter.
  let normalized = input
  if (!input.includes(',') && input.endsWith('.')) {
    normalized = input.slice(0, -1) + ','
  }
  // Strip everything except digits and the first comma
  const digits = normalized.replace(/[^\d,]/g, '')
  const commaIdx = digits.indexOf(',')
  let intPart: string
  let decPart: string | undefined
  if (commaIdx !== -1) {
    intPart = digits.slice(0, commaIdx)
    decPart = digits.slice(commaIdx + 1).replace(/,/g, '')
  } else {
    intPart = digits
  }
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt
}

/** Format on blur: enforces decimal places (default 2). Pass maxDecimals=8 for share quantities. */
export function formatNumberBlur(input: string, maxDecimals = 2): string {
  const num = parseNumberInput(input)
  if (!input || isNaN(num)) return input
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: Math.min(2, maxDecimals),
    maximumFractionDigits: maxDecimals,
  }).format(num)
}

/** Parse formatted string back to number for API submission */
export function parseNumberInput(formatted: string): number {
  if (!formatted) return 0
  return parseFloat(formatted.replace(/\./g, '').replace(',', '.')) || 0
}

/**
 * Format a numeric value as xxx.xxx,xx (dot thousands, comma decimal).
 * Always emits exactly `decimals` fraction digits (default 2).
 * No currency symbol — pure number string.
 * Safe to call in any context: server components, chart callbacks, dialogs.
 */
export function formatAmount(value: string | number, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (!isFinite(num)) return '0,00'
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

/**
 * Compact version for chart Y-axis tick labels.
 * Produces abbreviated numbers (e.g. "1,2 jt" in id-ID locale).
 * Falls back to id-ID compact notation — no currency symbol.
 */
export function formatAmountCompact(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (!isFinite(num)) return '0'
  return new Intl.NumberFormat('id-ID', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num)
}
