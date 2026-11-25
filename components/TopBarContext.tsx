'use client';
import { createContext, useContext, useEffect, useState } from 'react';

// Detail pages put a back pill in the top bar ("‹ Friday Night Clear-out")
// by rendering <TopBarBack/>. Top-level pages leave it empty.
export type Back = { href: string; label: string };

const Ctx = createContext<{ back: Back | null; setBack: (b: Back | null) => void }>({ back: null, setBack: () => {} });

export function TopBarProvider({ children }: { children: React.ReactNode }) {
  const [back, setBack] = useState<Back | null>(null);
  return <Ctx.Provider value={{ back, setBack }}>{children}</Ctx.Provider>;
}

export function useTopBarBack(): Back | null {
  return useContext(Ctx).back;
}

export function TopBarBack({ href, label }: Back) {
  const { setBack } = useContext(Ctx);
  useEffect(() => {
    setBack({ href, label });
    return () => setBack(null);
  }, [href, label, setBack]);
  return null;
}
