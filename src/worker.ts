import { runDiscoveryAgent } from "./lib/agent";
import { ensureScheduledCoverage, nextDueQuery, recoverStaleQueries } from "./lib/discovery-queries";
import { backfillMissingEventImages } from "./lib/event-images";
import { ensureCanonicalTaxonomy, type CategorySlug } from "./lib/taxonomy";
import { verifyNextEvent } from "./lib/verification";

const interval = Math.max(15, Number(process.env.AGENT_INTERVAL_MINUTES ?? 60)) * 60_000;

async function run() {
  try {
    console.log(new Date().toISOString(), "starting discovery");
    await ensureCanonicalTaxonomy();
    await ensureScheduledCoverage();
    await recoverStaleQueries();
    console.log(await backfillMissingEventImages());
    console.log(await verifyNextEvent());
    let handled = false;
    for (let index = 0; index < 4; index += 1) {
      const query = await nextDueQuery();
      if (!query) break;
      handled = true;
      const result = await runDiscoveryAgent(query.displayQuery, query.id, query.kind, query.categorySlug as CategorySlug | null);
      console.log(result);
      if (result.skipped) break;
    }
    if (!handled) console.log("no discovery query is due");
  } catch (error) {
    console.error(new Date().toISOString(), error);
  }
}

await run();
setInterval(run, interval);
