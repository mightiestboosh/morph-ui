import type Anthropic from '@anthropic-ai/sdk';

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'render_ui',
    description:
      'Render a dynamic UI surface in the chat. Accepts a component tree with any combination of layout, input, display, and special components.',
    input_schema: {
      type: 'object' as const,
      properties: {
        surfaceId: {
          type: 'string',
          description: 'Unique ID for this UI surface. Reuse to update an existing surface.',
        },
        layout: {
          type: 'object',
          description: 'Root component of the UI tree. Must have a "type" field.',
        },
      },
      required: ['surfaceId', 'layout'],
    },
  },
  {
    name: 'search_web',
    description: 'Search the web to find relevant websites for a task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        num_results: {
          type: 'number',
          description: 'Number of results to return (default 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'browse_website',
    description:
      'Dispatch a browser sub-agent to visit a website, interact with it, and extract structured data. Multiple calls run in parallel.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to visit' },
        goal: { type: 'string', description: 'What to accomplish on this site' },
        extract_schema: {
          type: 'object',
          description: 'JSON schema describing the data structure to extract',
        },
        timeout_seconds: {
          type: 'number',
          description: 'Timeout in seconds (default 60)',
        },
        agent_label: {
          type: 'string',
          description: 'Display name for this agent shown to user',
        },
      },
      required: ['url', 'goal'],
    },
  },
  {
    name: 'dispatch_agents',
    description:
      'Launch multiple browser sub-agents in parallel (max 10). Each visits a different site.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              agent_label: { type: 'string' },
              url: { type: 'string' },
              goal: { type: 'string' },
              extract_schema: { type: 'object' },
            },
            required: ['url', 'goal'],
          },
          description: 'Array of agent configurations',
        },
      },
      required: ['agents'],
    },
  },
  {
    name: 'get_location',
    description: "Get the user's approximate location from their IP address.",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];
