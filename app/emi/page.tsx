import { AppShell } from "@/components/layout/app-shell";
import { BorrowingClient } from "@/components/emi/borrowing-client";

export const dynamic = "force-dynamic";

export default function EmiSimulatorPage() {
  return (
    <AppShell activeView="emi">
      <BorrowingClient />
    </AppShell>
  );
}
