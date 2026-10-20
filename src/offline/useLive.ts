import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'

/** Subscribes a component to an IndexedDB query; re-renders when the underlying data changes. */
export function useLive<T>(query: () => Promise<T> | T, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial)
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: () => {} })
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value
}
