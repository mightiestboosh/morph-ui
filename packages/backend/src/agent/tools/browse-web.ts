import { getStagehand, releaseStagehand } from '../../browser/stagehand.js';

interface BrowseWebsiteInput {
  url: string;
  goal: string;
  extract_schema?: Record<string, any>;
  timeout_seconds?: number;
  agent_label?: string;
}

interface DispatchAgentsInput {
  agents: BrowseWebsiteInput[];
}

type ProgressCallback = (progress: Record<string, any>) => void;

export async function handleBrowseWebsite(
  input: BrowseWebsiteInput,
  onProgress?: ProgressCallback
): Promise<any> {
  const { url, goal, extract_schema, timeout_seconds = 60, agent_label = 'Browser Agent' } = input;
  let stagehand: Awaited<ReturnType<typeof getStagehand>> | null = null;

  const timeoutMs = timeout_seconds * 1000;

  try {
    onProgress?.({ status: 'initializing', message: 'Starting browser...' });

    stagehand = await getStagehand();

    onProgress?.({ status: 'navigating', message: `Navigating to ${url}` });

    // Navigate to the URL with a timeout
    await Promise.race([
      stagehand.page.goto(url, { waitUntil: 'domcontentloaded' }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Navigation timeout')), timeoutMs)
      ),
    ]);

    onProgress?.({ status: 'working', message: `Executing goal: ${goal}` });

    // Build a comprehensive instruction for the agent
    let instruction = goal;
    if (extract_schema) {
      instruction += `\n\nAfter completing the task, extract data matching this structure: ${JSON.stringify(extract_schema)}`;
    }

    // Use agent mode to accomplish the goal
    const agentResult = await Promise.race([
      stagehand.agent().execute(instruction),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Agent execution timeout')), timeoutMs)
      ),
    ]);

    onProgress?.({ status: 'extracting', message: 'Extracting page data...' });

    // Get page content for the response
    const pageTitle = await stagehand.page.title();
    const bodyText = await stagehand.page.evaluate(() => {
      const body = document.body;
      return body ? body.innerText.slice(0, 5000) : '';
    });

    return {
      success: true,
      agent_label,
      url,
      pageTitle,
      content: bodyText,
      agentActions: agentResult?.actions?.length ?? 0,
    };
  } catch (err: any) {
    console.error(`Browse error (${agent_label}):`, err);
    return {
      success: false,
      agent_label,
      url,
      error: err.message || 'Failed to browse website',
    };
  } finally {
    if (stagehand) {
      await releaseStagehand(stagehand).catch((e) =>
        console.error('Failed to release stagehand:', e)
      );
    }
  }
}

export async function handleDispatchAgents(
  input: DispatchAgentsInput,
  onProgress?: ProgressCallback
): Promise<any> {
  const { agents } = input;
  const limitedAgents = agents.slice(0, 10);

  onProgress?.({
    status: 'dispatching',
    message: `Launching ${limitedAgents.length} browser agent(s)...`,
  });

  const results = await Promise.allSettled(
    limitedAgents.map((agentConfig, index) => {
      const label = agentConfig.agent_label || `Agent ${index + 1}`;
      return handleBrowseWebsite(
        { ...agentConfig, agent_label: label },
        (progress) => {
          onProgress?.({
            agent_label: label,
            ...progress,
          });
        }
      );
    })
  );

  return results.map((result, index) => {
    const label = limitedAgents[index].agent_label || `Agent ${index + 1}`;
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      success: false,
      agent_label: label,
      url: limitedAgents[index].url,
      error: result.reason?.message || 'Agent failed',
    };
  });
}
