import { AppShell } from "@/components/layout/app-shell";
import { EnterpriseHubView } from "@/components/enterprise/enterprise-hub-view";

export const dynamic = "force-dynamic";

export default function EnterpriseHubPage() {
  return (
    <AppShell activeView="enterprise">
      <EnterpriseHubView />
    </AppShell>
  );
}
