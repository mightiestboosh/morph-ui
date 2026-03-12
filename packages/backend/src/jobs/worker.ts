import { getJob, updateJob, getPendingJobs } from './queue.js';
import { handleBrowseWebsite } from '../agent/tools/browse-web.js';

export async function processJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) {
    console.error(`Job ${jobId} not found`);
    return;
  }

  if (job.status !== 'pending') {
    console.warn(`Job ${jobId} is not pending (status: ${job.status})`);
    return;
  }

  await updateJob(jobId, {
    status: 'running',
    progress: 0,
    progressMessage: 'Starting...',
  });

  try {
    switch (job.type) {
      case 'browse_website': {
        const input = job.result ? JSON.parse(job.result) : {};

        const result = await handleBrowseWebsite(
          {
            url: input.url,
            goal: input.goal,
            extract_schema: input.extract_schema,
            timeout_seconds: input.timeout_seconds,
            agent_label: job.agentLabel,
          },
          (progress) => {
            // Fire-and-forget progress updates
            updateJob(jobId, {
              progress: progressToPercent(progress.status),
              progressMessage: progress.message || progress.status,
            }).catch(() => {});
          }
        );

        await updateJob(jobId, {
          status: 'completed',
          progress: 100,
          progressMessage: 'Done',
          result,
        });
        break;
      }

      default: {
        await updateJob(jobId, {
          status: 'failed',
          error: `Unknown job type: ${job.type}`,
        });
      }
    }
  } catch (err: any) {
    console.error(`Job ${jobId} failed:`, err);
    await updateJob(jobId, {
      status: 'failed',
      error: err.message || 'Job execution failed',
    });
  }
}

function progressToPercent(status: string): number {
  switch (status) {
    case 'initializing':
      return 10;
    case 'navigating':
      return 30;
    case 'working':
      return 50;
    case 'extracting':
      return 80;
    case 'completed':
      return 100;
    default:
      return 50;
  }
}

export async function processPendingJobs(): Promise<void> {
  const pending = await getPendingJobs();

  for (const job of pending) {
    await processJob(job.id);
  }
}
