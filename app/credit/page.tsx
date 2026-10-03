import { AppShell } from "@/components/layout/app-shell";
import { CreditClient } from "@/components/credit/credit-client";

export const dynamic = "force-dynamic";

export default function CreditScorePage() {
  return (
    <AppShell activeView="credit">
      <CreditClient />
    </AppShell>
  );
}
