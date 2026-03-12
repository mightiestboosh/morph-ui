import Anthropic from '@anthropic-ai/sdk';
import { db, schema } from '../db/index.js';
import { eq, asc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { getAllTools, userTools } from './tools/index.js';
import { getSystemPrompt } from './system-prompt.js';
import { processRenderUI } from './tools/render-ui.js';
import { handleGetLocation } from './tools/get-location.js';

const MAX_ITERATIONS = 25;

interface ChatAgentOptions {
  conversationId: string;
  model: string;
  onEvent: (event: string, data: any) => void;
}

interface ChatAgentResult {
  content: string;
  surfaces: any[];
  toolCalls: any[];
}

export class ChatAgent {
  private client: Anthropic;
  private conversationId: string;
  private model: string;
  private onEvent: (event: string, data: any) => void;

  constructor({ conversationId, model, onEvent }: ChatAgentOptions) {
    this.client = new Anthropic();
    this.conversationId = conversationId;
    this.model = model;
    this.onEvent = onEvent;
  }

  async run(userMessage: string): Promise<ChatAgentResult> {
    const surfaces: any[] = [];
    const toolCalls: any[] = [];
    let fullContent = '';

    try {
      // Load conversation history from DB
      const history = await db.query.messages.findMany({
        where: eq(schema.messages.conversationId, this.conversationId),
        orderBy: [asc(schema.messages.createdAt)],
      });

      // Build messages array for Claude API
      const messages: Anthropic.MessageParam[] = history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Add the current user message
      messages.push({ role: 'user', content: userMessage });

      let iteration = 0;

      while (iteration < MAX_ITERATIONS) {
        iteration++;

        const stream = this.client.messages.stream({
          model: this.model,
          max_tokens: 16384,
          system: getSystemPrompt(),
          tools: getAllTools(this.model),
          messages,
        });

        // Collect text deltas and stream them to the client
        let assistantText = '';

        stream.on('text', (text) => {
          assistantText += text;
          this.onEvent('text', { text });
        });

        const response = await stream.finalMessage();

        fullContent = assistantText;

        // Check stop reason
        if (response.stop_reason === 'end_turn') {
          // Done — no more tool calls
          break;
        }

        if (response.stop_reason === 'pause_turn') {
          // Server-side tool hit iteration limit — re-send to continue
          messages.push({ role: 'assistant', content: response.content as any });
          continue;
        }

        // Find user-defined tool_use blocks (render_ui, get_location)
        const userToolUseBlocks = response.content.filter(
          (block) => block.type === 'tool_use'
        ) as Anthropic.ToolUseBlock[];

        if (userToolUseBlocks.length === 0) {
          // No user tools — might be only server tools or done
          break;
        }

        // Process user-defined tool calls
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolBlock of userToolUseBlocks) {
          const { id, name, input } = toolBlock;

          toolCalls.push({ id, name, input });

          let result: any;

          try {
            switch (name) {
              case 'render_ui': {
                const surface = processRenderUI(input as any);
                surfaces.push(surface);
                this.onEvent('ui_surface', surface);
                result = { success: true, surfaceId: surface.surfaceId };
                break;
              }

              case 'get_location': {
                result = await handleGetLocation();
                break;
              }

              default: {
                result = { error: `Unknown tool: ${name}` };
              }
            }
          } catch (err: any) {
            console.error(`Tool ${name} error:`, err);
            result = { error: err.message || 'Tool execution failed' };
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: id,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          });
        }

        // Add assistant response and tool results to messages for next iteration
        messages.push({ role: 'assistant', content: response.content as any });
        messages.push({ role: 'user', content: toolResults });
      }

      return { content: fullContent, surfaces, toolCalls };
    } catch (err: any) {
      console.error('ChatAgent error:', err);
      this.onEvent('error', { message: err.message || 'Agent error' });
      return { content: fullContent || 'An error occurred while processing your request.', surfaces, toolCalls };
    }
  }
}
