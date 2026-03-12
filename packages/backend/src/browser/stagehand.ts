import { Stagehand } from '@browserbasehq/stagehand';

let activeInstances = 0;
const MAX_INSTANCES = 10;

export async function getStagehand(): Promise<Stagehand> {
  if (activeInstances >= MAX_INSTANCES) {
    throw new Error(`Maximum concurrent browser instances (${MAX_INSTANCES}) reached`);
  }

  const stagehand = new Stagehand({
    env: 'LOCAL',
    modelName: 'claude-sonnet-4-20250514',
    modelClientOptions: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    localBrowserLaunchOptions: {
      headless: true,
    },
  });

  await stagehand.init();
  activeInstances++;

  return stagehand;
}

export async function releaseStagehand(instance: Stagehand): Promise<void> {
  try {
    await instance.close();
  } catch (err) {
    console.error('Error closing stagehand instance:', err);
  } finally {
    activeInstances = Math.max(0, activeInstances - 1);
  }
}
