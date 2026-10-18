import { useRef, useState } from "react";
import { createSystemAppLaunch, type SystemLaunch } from "./systemAppLaunch";

export function useSystemAppLaunch() {
  const [state, setState] = useState<SystemLaunch | null>(null);
  const owner = useRef<ReturnType<typeof createSystemAppLaunch> | null>(null);
  if (!owner.current) owner.current = createSystemAppLaunch(setState);
  return { state, owner: owner.current };
}
