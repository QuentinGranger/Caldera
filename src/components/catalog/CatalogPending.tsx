'use client';

import {
  createContext,
  useContext,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from 'react';
import { CatalogGridSkeleton } from '@/components/loading/LoadingSkeletons';

type PendingContextValue = {
  pending: boolean;
  startTransition: TransitionStartFunction;
};

const PendingContext = createContext<PendingContextValue | null>(null);

export function CatalogPendingProvider({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  return (
    <PendingContext.Provider value={{ pending, startTransition }}>
      {children}
    </PendingContext.Provider>
  );
}

export function useCatalogPending() {
  const context = useContext(PendingContext);
  if (!context)
    throw new Error(
      'useCatalogPending doit être utilisé dans CatalogPendingProvider.',
    );
  return context;
}

export function CatalogPendingContent({ children }: { children: ReactNode }) {
  const { pending } = useCatalogPending();
  return pending ? <CatalogGridSkeleton /> : children;
}
