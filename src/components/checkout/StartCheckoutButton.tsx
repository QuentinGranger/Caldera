'use client';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import { startCheckoutAction } from '@/lib/checkout/actions';
import { useCheckoutAction } from './useCheckoutAction';
export function StartCheckoutButton({
  disabled = false,
  restart = false,
  variant = 'primary',
}: {
  disabled?: boolean;
  restart?: boolean;
  variant?: 'primary' | 'gold';
}) {
  const { execute, pending, result } = useCheckoutAction();
  return (
    <div>
      <Button
        variant={variant}
        disabled={disabled || pending}
        onClick={() => execute(startCheckoutAction)}
      >
        {pending
          ? 'Préparation…'
          : restart
            ? 'Démarrer une nouvelle session'
            : 'Passer à la commande'}
        {!restart && <ArrowRight size={18} aria-hidden="true" />}
      </Button>
      <p role="status">{result?.message}</p>
    </div>
  );
}
