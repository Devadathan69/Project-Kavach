import { KavachWorkspace } from "@/components/kavach-workspace";
import { env } from "@/lib/env";

export default function HomePage() {
  return <KavachWorkspace demoMode={env.demoMode} modelName={env.openAiModel} />;
}
