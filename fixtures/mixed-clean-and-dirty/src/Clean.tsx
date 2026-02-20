import { useState, useCallback } from "react";

export function Clean() {
  const [value, setValue] = useState("");
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  return <input value={value} onChange={handleChange} />;
}
