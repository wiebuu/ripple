import { useState } from 'react';
import { haptic } from '@/components/ui';

/** Longest the spinner may stay up, so a hung request can never leave it stuck. */
const MAX_SPIN_MS = 10_000;

/**
 * Pull-to-refresh state for a RefreshControl. The spinner shows only while a
 * pull the user started is in flight, never for background refetches (focus,
 * invalidation), which on iOS left it stuck and pushed the content down.
 */
export function usePullRefresh(refetch: () => unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    haptic.light();
    setRefreshing(true);
    try {
      await Promise.race([Promise.resolve(refetch()), new Promise((r) => setTimeout(r, MAX_SPIN_MS))]);
    } catch {
      // Query errors surface in the screen's own error state.
    } finally {
      setRefreshing(false);
    }
  };
  return { refreshing, onRefresh };
}
