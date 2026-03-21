import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { probeBackendStatus, type BackendStatus } from '@/services/api';

type BackendStatusState = {
  status: BackendStatus;
  lastCheckedAt: string | null;
  isRefreshing: boolean;
};

const INITIAL_STATE: BackendStatusState = {
  status: 'offline',
  lastCheckedAt: null,
  isRefreshing: false,
};

export function useBackendStatus() {
  const [state, setState] = useState<BackendStatusState>(INITIAL_STATE);
  const mountedRef = useRef(true);
  const refreshInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    setState((current) => ({ ...current, isRefreshing: true }));

    try {
      const snapshot = await probeBackendStatus();
      if (!mountedRef.current) return;

      setState({
        status: snapshot.status,
        lastCheckedAt: snapshot.checkedAt,
        isRefreshing: false,
      });
    } catch {
      if (!mountedRef.current) return;

      setState((current) => ({
        ...current,
        status: 'error',
        lastCheckedAt: new Date().toISOString(),
        isRefreshing: false,
      }));
    } finally {
      refreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void refresh();
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, [refresh]);

  return {
    status: state.status,
    lastCheckedAt: state.lastCheckedAt,
    isRefreshing: state.isRefreshing,
    refresh,
  };
}
