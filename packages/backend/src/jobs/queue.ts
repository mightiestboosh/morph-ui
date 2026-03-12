import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

interface CreateJobParams {
  conversationId: string;
  agentLabel: string;
  type: string;
}

interface UpdateJobParams {
  status?: JobStatus;
  progress?: number;
  progressMessage?: string;
  result?: any;
  error?: string;
}

export async function createJob(params: CreateJobParams) {
  const now = new Date().toISOString();
  const id = uuid();

  await db.insert(schema.jobs).values({
    id,
    conversationId: params.conversationId,
    agentLabel: params.agentLabel,
    type: params.type,
    status: 'pending',
    progress: 0,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export async function updateJob(jobId: string, params: UpdateJobParams) {
  const now = new Date().toISOString();
  const updates: Record<string, any> = { updatedAt: now };

  if (params.status !== undefined) updates.status = params.status;
  if (params.progress !== undefined) updates.progress = params.progress;
  if (params.progressMessage !== undefined) updates.progressMessage = params.progressMessage;
  if (params.result !== undefined) updates.result = JSON.stringify(params.result);
  if (params.error !== undefined) updates.error = params.error;

  await db
    .update(schema.jobs)
    .set(updates)
    .where(eq(schema.jobs.id, jobId));
}

export async function getJob(jobId: string) {
  return db.query.jobs.findFirst({
    where: eq(schema.jobs.id, jobId),
  });
}

export async function getJobsByConversation(conversationId: string) {
  return db.query.jobs.findMany({
    where: eq(schema.jobs.conversationId, conversationId),
  });
}

export async function getPendingJobs() {
  return db.query.jobs.findMany({
    where: eq(schema.jobs.status, 'pending'),
  });
}
