import Anthropic from '@anthropic-ai/sdk';
import { db, schema } from '../db/index.js';
import { eq, asc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { toolDefinitions } from './tools/index.js';
import { getSystemPrompt } from './system-prompt.js';
import { processRenderUI } from './tools/render-ui.js';
import { handleSearchWeb } from './tools/search-web.js';
import { handleBrowseWebsite, handleDispatchAgents } from './tools/browse-web.js';
import { handleGetLocation } from './tools/get-location.js';

const MAX_ITERATIONS = 15;

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
          max_tokens: 8192,
          system: getSystemPrompt(),
          tools: toolDefinitions,
          messages,
        });

        // Collect text deltas and stream them to the client
        let assistantText = '';
        const contentBlocks: Anthropic.ContentBlock[] = [];

        stream.on('text', (text) => {
          assistantText += text;
          this.onEvent('text', { text });
        });

        const response = await stream.finalMessage();
        contentBlocks.push(...response.content);

        // Extract full text from the response
        for (const block of response.content) {
          if (block.type === 'text') {
            // Text already collected via stream event
          }
        }

        fullContent = assistantText;

        // Check if we need to handle tool use
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ContentBlockParam & { type: 'tool_use'; id: string; name: string; input: any } =>
            block.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
          // No tool calls — we're done
          break;
        }

        // Process tool calls
        const toolResults: Anthropic.MessageParam = {
          role: 'user',
          content: [],
        };

        for (const toolBlock of toolUseBlocks) {
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

              case 'search_web': {
                result = await handleSearchWeb(input as any);
                break;
              }

              case 'browse_website': {
                this.onEvent('agent_status', {
                  agent_label: input.agent_label || 'Browser Agent',
                  status: 'starting',
                  url: input.url,
                });
                result = await handleBrowseWebsite(input as any, (progress) => {
                  this.onEvent('agent_status', {
                    agent_label: input.agent_label || 'Browser Agent',
                    ...progress,
                  });
                });
                this.onEvent('agent_status', {
                  agent_label: input.agent_label || 'Browser Agent',
                  status: 'completed',
                });
                break;
              }

              case 'dispatch_agents': {
                result = await handleDispatchAgents(input as any, (progress) => {
                  this.onEvent('agent_status', progress);
                });
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

          (toolResults.content as Anthropic.ToolResultBlockParam[]).push({
            type: 'tool_result',
            tool_use_id: id,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          });
        }

        // Add assistant response and tool results to messages for next iteration
        messages.push({ role: 'assistant', content: response.content as any });
        messages.push(toolResults);
      }

      return { content: fullContent, surfaces, toolCalls };
    } catch (err: any) {
      console.error('ChatAgent error:', err);
      this.onEvent('error', { message: err.message || 'Agent error' });
      return { content: fullContent || 'An error occurred while processing your request.', surfaces, toolCalls };
    }
  }
}
