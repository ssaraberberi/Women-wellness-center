/* Reads an endpoint when a screen comes into view, and again on
   pull-to-refresh. A screen left open while the desk changes something
   is read fresh the moment she comes back to it. */
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { get } from './api';

export function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const live = useRef(true);

  const load = useCallback(async (pull?: boolean) => {
    if (!path) return;
    if (pull) setRefreshing(true);
    try {
      const d = await get<T>(path);
      if (live.current) { setData(d); setError(null); }
    } catch (e: any) {
      if (live.current) setError(e.message || 'Something went wrong');
    } finally {
      if (live.current) { setLoading(false); setRefreshing(false); }
    }
  }, [path]);

  useFocusEffect(useCallback(() => {
    live.current = true;
    load();
    return () => { live.current = false; };
  }, [load]));

  return { data, setData, error, loading, refreshing, reload: () => load(true) };
}
