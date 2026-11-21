import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Orbit, Focus } from "lucide-react";

const Appearance = createContext({ immersive: true, toggle: () => {} });
export const useAppearance = () => useContext(Appearance);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [immersive, setImmersive] = useState(() => {
    try {
      return localStorage.getItem("ks:appearance:v1") !== "focus";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.appearance = immersive
      ? "immersive"
      : "focus";
    try {
      localStorage.setItem(
        "ks:appearance:v1",
        immersive ? "immersive" : "focus",
      );
    } catch {
      /* Private browsing may disable storage. */
    }
  }, [immersive]);
  return (
    <Appearance.Provider
      value={{ immersive, toggle: () => setImmersive((v) => !v) }}
    >
      <div className="cockpit-atmosphere" aria-hidden="true">
        <div className="atmosphere-grid" />
        <i />
        <i />
      </div>
      {children}
    </Appearance.Provider>
  );
}

export function AppearanceToggle() {
  const { immersive, toggle } = useContext(Appearance);
  return (
    <button
      className="appearance-toggle"
      onClick={toggle}
      aria-pressed={immersive}
      aria-label="Immersive visuals"
      title={immersive ? "Switch to focus mode" : "Enable immersive visuals"}
    >
      {immersive ? <Orbit size={17} /> : <Focus size={17} />}
      <span>{immersive ? "Immersive" : "Focus mode"}</span>
    </button>
  );
}
