import { useId, useDeferredValue, useTransition } from "react";

// These hooks were added in React 18 — using them with React 17 installed
export function App() {
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const deferred = useDeferredValue("hello");

  return (
    <div id={id}>
      <span>{String(isPending)}</span>
      <span>{deferred}</span>
      <button onClick={() => startTransition(() => {})}>Go</button>
    </div>
  );
}
