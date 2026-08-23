import { runDiscoveryAgent } from "./lib/agent";
import { ensureMusicCoverage, nextDueQuery, recoverStaleQueries } from "./lib/discovery-queries";
import { verifyNextEvent } from "./lib/verification";

const interval = Math.max(15, Number(process.env.AGENT_INTERVAL_MINUTES ?? 60)) * 60_000;

async function run() {
  try {
    console.log(new Date().toISOString(), "starting discovery");
    await ensureMusicCoverage();
    await recoverStaleQueries();
    console.log(await verifyNextEvent());
    let handled = false;
    for (let index = 0; index < 4; index += 1) {
      const query = await nextDueQuery();
      if (!query) break;
      handled = true;
      const result = await runDiscoveryAgent(query.displayQuery, query.id, query.kind);
      console.log(result);
      if (result.skipped) break;
    }
    if (!handled) console.log(await runDiscoveryAgent());
  } catch (error) {
    console.error(new Date().toISOString(), error);
  }
}

await run();
setInterval(run, interval);
