import { runDiscoveryAgent } from "./lib/agent";
import { ensureScheduledCoverage, nextDueQuery, recoverStaleQueries } from "./lib/discovery-queries";
import { auditEventImages, backfillMissingEventImages, clearPageUrlsStoredAsImages } from "./lib/event-images";
import { consolidateDuplicateEvents, promoteSpecificEventSources } from "./lib/events";
import { ensureCanonicalTaxonomy, type CategorySlug } from "./lib/taxonomy";
import { repairGenericEventSources } from "./lib/source-repair";
import { verifyNextEvent } from "./lib/verification";

const interval = Math.max(15, Number(process.env.AGENT_INTERVAL_MINUTES ?? 15)) * 60_000;
const queriesPerRun = Math.max(1, Number(process.env.AGENT_QUERIES_PER_RUN ?? 8));
const imagesPerRun = Math.max(1, Number(process.env.AGENT_IMAGES_PER_RUN ?? 16));
let running = false;

async function runNonBlockingStep(label: string, action: () => Promise<unknown>) {
  try {
    console.log(await action());
  } catch (error) {
    console.error(new Date().toISOString(), `${label} failed; continuing discovery`, error);
  }
}

async function run() {
  if (running) {
    console.log(new Date().toISOString(), "discovery is still running; skipping overlapping cycle");
    return;
  }
  running = true;
  try {
    console.log(new Date().toISOString(), "starting discovery");
    await ensureCanonicalTaxonomy();
    await ensureScheduledCoverage();
    await recoverStaleQueries();
    console.log(await consolidateDuplicateEvents());
    console.log(await promoteSpecificEventSources());
    console.log(await repairGenericEventSources(4));
    console.log(await clearPageUrlsStoredAsImages());
    await runNonBlockingStep("event verification", verifyNextEvent);
    let handled = false;
    for (let index = 0; index < queriesPerRun; index += 1) {
      const query = await nextDueQuery();
      if (!query) break;
      handled = true;
      const result = await runDiscoveryAgent(query.displayQuery, query.id, query.kind, query.categorySlug as CategorySlug | null);
      console.log(result);
      if (result.skipped) break;
    }
    if (!handled) console.log("no discovery query is due");
    console.log(await backfillMissingEventImages(imagesPerRun));
    console.log(await auditEventImages(Math.max(1, Math.floor(imagesPerRun / 4))));
  } catch (error) {
    console.error(new Date().toISOString(), error);
  } finally {
    running = false;
  }
}

await run();
setInterval(run, interval);
