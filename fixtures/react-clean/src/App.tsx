import { useState, useEffect, useCallback } from "react";

export function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = `Count: ${count}`;
  }, [count]);

  const increment = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  return <button onClick={increment}>{count}</button>;
}
