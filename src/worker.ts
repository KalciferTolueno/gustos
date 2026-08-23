import { runDiscoveryAgent } from "./lib/agent";

const interval = Math.max(15, Number(process.env.AGENT_INTERVAL_MINUTES ?? 360)) * 60_000;

async function run() {
  try {
    console.log(new Date().toISOString(), "starting discovery");
    console.log(await runDiscoveryAgent());
  } catch (error) {
    console.error(new Date().toISOString(), error);
  }
}

await run();
setInterval(run, interval);
