const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
export function formatProductDate(value: string): string {
  return dateFormatter.format(new Date(value));
}
export function formatProductWeight(grams: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'unit',
    unit: grams >= 1000 ? 'kilogram' : 'gram',
    maximumFractionDigits: 3,
  }).format(grams >= 1000 ? grams / 1000 : grams);
}
