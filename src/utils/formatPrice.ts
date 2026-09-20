const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
});
export function formatPrice(value: number | string): string {
  return euroFormatter.format(Number(value));
}
