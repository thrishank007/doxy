import { useState, useReducer, useRef } from "react";

export function App() {
  // useState accepts 0 or 1 args — calling with 2 is wrong
  const [count, setCount] = useState(0, "extra");

  // useReducer needs at least 2 args (reducer, initialArg) — calling with 0 is wrong
  const [state, dispatch] = useReducer();

  // useRef accepts 0 or 1 args — calling with 3 is wrong
  const ref = useRef(null, "extra", "another");

  return (
    <div>
      <span>{count}</span>
      <span>{JSON.stringify(state)}</span>
      <span ref={ref}>{String(dispatch)}</span>
    </div>
  );
}
