import { PurchaseAssurance } from '@/components/shipping/PurchaseAssurance';

export function CartAssurance({
  preorder = false,
  tone = 'day',
  onNavigate,
}: {
  preorder?: boolean;
  tone?: 'day' | 'night';
  onNavigate?: () => void;
}) {
  return (
    <PurchaseAssurance
      preorder={preorder}
      tone={tone}
      onNavigate={onNavigate}
    />
  );
}
