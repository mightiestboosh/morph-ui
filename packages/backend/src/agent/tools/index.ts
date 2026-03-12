import type Anthropic from '@anthropic-ai/sdk';

// User-defined tools (we handle execution)
export const userTools: Anthropic.Tool[] = [
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
    name: 'get_location',
    description: "Get the user's approximate location from their IP address.",
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// Server-side tools (Anthropic handles execution)
// Use 20250305/20250910 versions for broad model compatibility
// Use 20260209 versions for Sonnet 4.6+ / Opus 4.6 (adds dynamic filtering)
export function getServerTools(model: string) {
  const isNew = model.includes('sonnet-4-6') || model.includes('opus-4-6') ||
    model.includes('sonnet-4-5') || model.includes('opus-4-5') ||
    model === 'claude-sonnet-4-6' || model === 'claude-opus-4-6';

  if (isNew) {
    return [
      { type: 'web_search_20260209' as const, name: 'web_search' as const },
      { type: 'web_fetch_20260209' as const, name: 'web_fetch' as const },
    ];
  }

  return [
    { type: 'web_search_20250305' as const, name: 'web_search' as const },
    { type: 'web_fetch_20250910' as const, name: 'web_fetch' as const },
  ];
}

// Combined tools array for the API call
export function getAllTools(model: string) {
  return [...userTools, ...getServerTools(model)];
}
