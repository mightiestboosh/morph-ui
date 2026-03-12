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

function log(label: string, msg: string) {
  console.log(`[browse:${label}] ${msg}`);
}

async function captureScreenshot(page: any): Promise<string | null> {
  try {
    const buffer = await Promise.race([
      page.screenshot({ type: 'jpeg', quality: 40, fullPage: false }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (buffer) {
      return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
    }
  } catch {
    // Screenshot failed, non-fatal
  }
  return null;
}

async function extractPageData(page: any, timeoutMs: number = 8000): Promise<{ title: string; content: string }> {
  try {
    const title = await Promise.race([
      page.title(),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), 3000)),
    ]);

    // Use innerText — simpler and more reliable than TreeWalker in Playwright
    const content = await Promise.race([
      page.evaluate('document.body ? document.body.innerText.slice(0, 6000) : ""'),
      new Promise<string>((resolve) => setTimeout(() => resolve('[Page content extraction timed out]'), timeoutMs)),
    ]);

    return { title, content: content || '[Empty page]' };
  } catch (err: any) {
    log('extract', `Failed: ${err.message}`);
    return { title: '', content: '[Failed to extract page content]' };
  }
}

export async function handleBrowseWebsite(
  input: BrowseWebsiteInput,
  onProgress?: ProgressCallback
): Promise<any> {
  const { url, goal, extract_schema, timeout_seconds = 45, agent_label = 'Browser Agent' } = input;
  let stagehand: Awaited<ReturnType<typeof getStagehand>> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  // Overall hard timeout — nothing should run longer than this
  const HARD_TIMEOUT_MS = (timeout_seconds + 15) * 1000;
  const navTimeoutMs = 15000;
  const agentTimeoutMs = Math.max(10000, (timeout_seconds - 10) * 1000);

  const hardDeadline = Date.now() + HARD_TIMEOUT_MS;

  function isExpired() {
    return Date.now() > hardDeadline;
  }

  try {
    // --- Step 1: Launch browser ---
    log(agent_label, `Starting — url=${url}, timeout=${timeout_seconds}s`);
    onProgress?.({ status: 'initializing', message: 'Starting browser...', log: 'Launching browser instance', url });

    const initStart = Date.now();
    stagehand = await Promise.race([
      getStagehand(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Browser launch timed out (20s)')), 20000)
      ),
    ]);
    log(agent_label, `Browser launched in ${Date.now() - initStart}ms`);

    if (isExpired()) throw new Error('Hard timeout reached after browser launch');

    const hostname = new URL(url).hostname;

    // --- Step 2: Navigate ---
    log(agent_label, `Navigating to ${url}`);
    onProgress?.({ status: 'navigating', message: `Loading ${hostname}...`, log: `Navigating to ${url}`, url });

    const navStart = Date.now();
    try {
      await Promise.race([
        stagehand.page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeoutMs, referer: 'https://www.google.com/' }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Navigation timed out')), navTimeoutMs + 2000)
        ),
      ]);
      log(agent_label, `Navigated in ${Date.now() - navStart}ms`);
    } catch (err: any) {
      log(agent_label, `Navigation issue: ${err.message}`);
      if (!err.message?.includes('timeout') && !err.message?.includes('Timeout')) {
        throw err;
      }
      onProgress?.({ status: 'navigating', message: `Page slow to load, continuing...`, log: 'Page load timed out, continuing anyway', url });
    }

    if (isExpired()) throw new Error('Hard timeout reached after navigation');

    // --- Step 3: Screenshot + block detection ---
    const navScreenshot = await captureScreenshot(stagehand.page);
    onProgress?.({
      status: 'navigating',
      message: `Loaded ${hostname}`,
      log: `Page loaded: ${hostname}`,
      screenshot: navScreenshot,
      url,
    });

    // Quick block detection — use string eval to avoid __name compilation issues
    const blockCheck = await Promise.race([
      stagehand.page.evaluate(`(() => {
        var t = (document.title || '').toLowerCase();
        var b = (document.body ? document.body.innerText.slice(0, 2000) : '').toLowerCase();
        var h = document.documentElement.innerHTML.slice(0, 5000).toLowerCase();
        var blocked =
          t.includes('hcaptcha') || t.includes('captcha') || t.includes('blocked') ||
          t.includes('access denied') || t.includes('just a moment') ||
          b.includes('been blocked') || b.includes('are a robot') ||
          b.includes('captcha') || b.includes('verify you are human') ||
          b.includes('access denied') || b.includes('unusual traffic') ||
          b.includes('security check') ||
          h.includes('hcaptcha.com') || h.includes('recaptcha') ||
          h.includes('cf-challenge') || h.includes('challenge-platform');
        return { blocked: blocked, title: document.title, snippet: b.slice(0, 200) };
      })()`),
      new Promise<{ blocked: boolean; title: string; snippet: string }>((resolve) =>
        setTimeout(() => resolve({ blocked: false, title: '', snippet: '' }), 3000)
      ),
    ]) as { blocked: boolean; title: string; snippet: string };

    if (blockCheck.blocked) {
      log(agent_label, `BLOCKED by ${hostname}: ${blockCheck.title}`);
      onProgress?.({
        status: 'failed',
        message: `Blocked by ${hostname}`,
        log: `Blocked: ${blockCheck.title || 'CAPTCHA/bot detection'}`,
        screenshot: navScreenshot,
        url,
      });
      return {
        success: false,
        agent_label,
        url,
        blocked: true,
        error: `Site blocked access (CAPTCHA/bot detection). Page title: "${blockCheck.title}". Try an alternative site or use search_web for cached results.`,
      };
    }

    if (isExpired()) throw new Error('Hard timeout reached after block check');

    // --- Step 4: Run Stagehand agent ---
    let instruction = goal;
    if (extract_schema) {
      instruction += `\n\nExtract data matching this JSON structure and include it in your response: ${JSON.stringify(extract_schema)}`;
    }
    instruction += `\n\nIMPORTANT: Work quickly. If the page requires login or a captcha, stop immediately and report what you can see. Do not spend more than 30 seconds on any single step.`;

    log(agent_label, `Starting agent execution (timeout=${Math.round(agentTimeoutMs / 1000)}s)`);
    onProgress?.({ status: 'working', message: `Browsing ${hostname}...`, log: `Starting task: ${goal.slice(0, 120)}`, url });

    // Heartbeat with periodic screenshots
    const startTime = Date.now();
    heartbeat = setInterval(async () => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      let screenshot: string | null = null;
      // Screenshot every 10s
      if (elapsed % 10 < 5 && stagehand) {
        try {
          screenshot = await captureScreenshot(stagehand.page);
        } catch { /* page may be closed */ }
      }
      onProgress?.({
        status: 'working',
        message: `Working on ${hostname}... (${elapsed}s)`,
        ...(screenshot ? { screenshot } : {}),
        url,
      });
    }, 5000);

    let agentResult: any = null;
    try {
      agentResult = await Promise.race([
        stagehand.agent({
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          options: { apiKey: process.env.ANTHROPIC_API_KEY },
        }).execute(instruction),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Agent timed out after ${Math.round(agentTimeoutMs / 1000)}s`)), agentTimeoutMs)
        ),
      ]);
      log(agent_label, `Agent completed in ${Date.now() - startTime}ms, actions=${agentResult?.actions?.length ?? 0}`);
    } catch (err: any) {
      log(agent_label, `Agent error/timeout: ${err.message}`);
      onProgress?.({ status: 'extracting', message: `Agent stopped, extracting available data...`, log: `Agent stopped: ${err.message}`, url });
    }

    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }

    // Log agent actions
    if (agentResult?.actions?.length) {
      for (const action of agentResult.actions) {
        const actionText = typeof action === 'string' ? action : action.description || action.type || JSON.stringify(action);
        onProgress?.({ status: 'working', log: actionText, url });
      }
    }

    // --- Step 5: Extract page content ---
    log(agent_label, 'Extracting page data...');
    onProgress?.({ status: 'extracting', message: 'Reading page content...', log: 'Extracting page data', url });

    const finalScreenshot = await captureScreenshot(stagehand.page);
    if (finalScreenshot) {
      onProgress?.({ status: 'extracting', message: 'Reading page content...', screenshot: finalScreenshot, url });
    }

    const { title: pageTitle, content: bodyText } = await extractPageData(stagehand.page);
    log(agent_label, `Done — ${bodyText.length} chars from "${pageTitle}"`);
    onProgress?.({ status: 'completed', log: `Done — extracted ${bodyText.length} chars from "${pageTitle}"`, url });

    return {
      success: true,
      agent_label,
      url,
      pageTitle,
      content: bodyText,
      agentActions: agentResult?.actions?.length ?? 0,
    };
  } catch (err: any) {
    log(agent_label, `ERROR: ${err.message}`);
    onProgress?.({ status: 'failed', message: err.message, log: `Error: ${err.message}`, url });
    return {
      success: false,
      agent_label,
      url,
      error: err.message || 'Failed to browse website',
    };
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (stagehand) {
      log(agent_label, 'Releasing browser...');
      await releaseStagehand(stagehand).catch((e) =>
        console.error(`[browse:${agent_label}] Failed to release stagehand:`, e)
      );
      log(agent_label, 'Browser released');
    }
  }
}

export async function handleDispatchAgents(
  input: DispatchAgentsInput,
  onProgress?: ProgressCallback
): Promise<any> {
  const { agents } = input;
  const limitedAgents = agents.slice(0, 10);

  log('dispatch', `Launching ${limitedAgents.length} agents`);
  onProgress?.({
    status: 'dispatching',
    message: `Launching ${limitedAgents.length} browser agent(s)...`,
  });

  // Stagger launches slightly to avoid overwhelming the system
  const promises = limitedAgents.map((agentConfig, index) => {
    const label = agentConfig.agent_label || `Agent ${index + 1}`;
    // Stagger by 500ms per agent to avoid all hitting getStagehand() at once
    return new Promise<any>((resolve) => {
      setTimeout(async () => {
        try {
          const result = await handleBrowseWebsite(
            { ...agentConfig, agent_label: label },
            (progress) => {
              onProgress?.({
                agent_label: label,
                ...progress,
              });
            }
          );
          resolve(result);
        } catch (err: any) {
          resolve({
            success: false,
            agent_label: label,
            url: agentConfig.url,
            error: err.message || 'Agent failed',
          });
        }
      }, index * 500);
    });
  });

  const results = await Promise.all(promises);
  log('dispatch', `All ${limitedAgents.length} agents completed`);
  return results;
}
