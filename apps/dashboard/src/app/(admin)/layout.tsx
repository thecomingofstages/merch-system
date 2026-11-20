import type { ReactNode } from "react";
import { OrderCountProvider } from "@/components/OrderCountProvider";
import { Sidebar } from "@/components/Sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <OrderCountProvider>
      <div className="min-h-screen md:flex">
        <Sidebar />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </OrderCountProvider>
  );
}
