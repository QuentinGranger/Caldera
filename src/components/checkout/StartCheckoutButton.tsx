'use client';
import { Button } from '@/components/ui/Button/Button';
import { startCheckoutAction } from '@/lib/checkout/actions';
import { useCheckoutAction } from './useCheckoutAction';
export function StartCheckoutButton({
  disabled = false,
  restart = false,
}: {
  disabled?: boolean;
  restart?: boolean;
}) {
  const { execute, pending, result } = useCheckoutAction();
  return (
    <div>
      <Button
        disabled={disabled || pending}
        onClick={() => execute(startCheckoutAction)}
      >
        {pending
          ? 'Préparation…'
          : restart
            ? 'Démarrer une nouvelle session'
            : 'Passer à la commande'}
      </Button>
      <p role="status">{result?.message}</p>
    </div>
  );
}
