import { listEvents } from "@/lib/events";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await listEvents();
  return <Dashboard {...data} />;
}
