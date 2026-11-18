import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { OrderCountProvider } from "@/components/OrderCountProvider";
import { Sidebar } from "@/components/Sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <OrderCountProvider>
        <div className="min-h-screen md:flex">
          <Sidebar />
          <main className="min-w-0 flex-1 p-6">{children}</main>
        </div>
      </OrderCountProvider>
    </AuthGuard>
  );
}
