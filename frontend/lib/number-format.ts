/** Format a string as the user types: inserts `.` every 3 digits, `,` for decimal */
export function formatNumberInput(input: string): string {
  // Strip everything except digits and the first comma
  const digits = input.replace(/[^\d,]/g, '')
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

/** Format on blur: enforces 2 decimal places */
export function formatNumberBlur(input: string): string {
  const num = parseNumberInput(input)
  if (!input || isNaN(num)) return input
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/** Parse formatted string back to number for API submission */
export function parseNumberInput(formatted: string): number {
  if (!formatted) return 0
  return parseFloat(formatted.replace(/\./g, '').replace(',', '.')) || 0
}
