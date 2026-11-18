"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { handleUnauthorized } from "@/components/AuthGuard";
import { countOrders } from "@/lib/api";

interface OrderCountContextValue {
  count: number;
  refresh: () => Promise<void>;
}

const OrderCountContext = createContext<OrderCountContextValue>({
  count: 0,
  refresh: async () => {},
});

export function useOrderCount(): OrderCountContextValue {
  return useContext(OrderCountContext);
}

// TODO(count semantics): status=ORDERED counts online orders that are not REJECTED (apps/server/src/app/helpers/adminOrder.helper.ts).
export function OrderCountProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);

  const refresh = useCallback(async () => {
    setReloadNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    countOrders({ status: "ORDERED" })
      .then((res) => {
        if (!active) return;
        setCount(res.count);
      })
      .catch((err) => {
        if (!active) return;
        if (handleUnauthorized(err, (path) => router.replace(path))) {
          return;
        }
        // If the count request fails, show no badge and no error toast.
        setCount(0);
      });
    return () => {
      active = false;
    };
  }, [reloadNonce, router]);

  useEffect(() => {
    function handleFocus() {
      setReloadNonce((n) => n + 1);
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        setReloadNonce((n) => n + 1);
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <OrderCountContext.Provider value={{ count, refresh }}>
      {children}
    </OrderCountContext.Provider>
  );
}
