import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { EnterpriseHubView } from "@/components/enterprise/enterprise-hub-view";

export const dynamic = "force-dynamic";

export default function EnterpriseHubPage() {
  return (
    <AppShell activeView="enterprise">
      <Suspense fallback={<div className="flex-1 w-full h-full flex items-center justify-center p-8 text-xs text-muted-foreground">Loading Enterprise Hub...</div>}>
        <EnterpriseHubView />
      </Suspense>
    </AppShell>
  );
}
