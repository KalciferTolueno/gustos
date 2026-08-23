import { listEvents } from "@/lib/events";
import { Dashboard } from "@/components/Dashboard";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [data, session] = await Promise.all([listEvents(), auth()]);
  return <Dashboard {...data} userName={session?.user?.name} />;
}
