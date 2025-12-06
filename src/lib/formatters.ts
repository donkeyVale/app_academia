export function formatPyg(value: number | null | undefined): string {
  const n = typeof value === 'number' ? value : Number(value || 0);
  return new Intl.NumberFormat('es-PY', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}
