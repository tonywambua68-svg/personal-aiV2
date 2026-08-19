import { useEffect, useRef } from "react";
import { boot } from "./os/app";

/**
 * Thin mount point only — the entire OS is framework-free vanilla TS
 * under src/os (mirrors the Express/Socket.io production layout).
 */
export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) boot(ref.current);
  }, []);
  return <div ref={ref} style={{ minHeight: "100vh" }} />;
}
