'use client';
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()}>
      Imprimer le bon de préparation
    </button>
  );
}
