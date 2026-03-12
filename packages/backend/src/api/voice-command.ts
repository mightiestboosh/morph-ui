import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

interface UIControl {
  id: string;
  type: string;
  value?: unknown;
  min?: number;
  max?: number;
  options?: string[];
  label?: string;
}

interface VoiceCommandRequest {
  transcript: string;
  controls: UIControl[];
}

interface Mutation {
  id: string;
  value: unknown;
}

const client = new Anthropic();

router.post('/', async (req: Request, res: Response) => {
  const { transcript, controls } = req.body as VoiceCommandRequest;

  if (!transcript || !controls || controls.length === 0) {
    res.json({ understood: false, mutations: [], fallbackText: transcript });
    return;
  }

  try {
    const controlsDescription = controls
      .map((c) => {
        let desc = `- id: "${c.id}", type: ${c.type}`;
        if (c.label) desc += `, label: "${c.label}"`;
        if (c.value !== undefined) desc += `, current value: ${JSON.stringify(c.value)}`;
        if (c.min !== undefined) desc += `, min: ${c.min}`;
        if (c.max !== undefined) desc += `, max: ${c.max}`;
        if (c.options) desc += `, options: ${JSON.stringify(c.options)}`;
        return desc;
      })
      .join('\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You interpret voice commands and map them to UI control changes.
Given a voice transcript and a list of active UI controls, determine which controls should be updated.
Respond with ONLY a JSON object (no markdown, no explanation):
{
  "understood": true/false,
  "mutations": [{"id": "control_id", "value": new_value}],
  "message": "optional brief acknowledgment"
}
If the voice command doesn't relate to any of the controls, set understood to false and mutations to [].
For sliders, set the numeric value. For selects, set the option value string. For checkboxes, set true/false. For calendars, set an ISO date string. For text inputs, set the string value.
Be flexible with interpretation — "around $100" means 100, "maybe 4 people" means 4, "next Friday" means the upcoming Friday's date.`,
      messages: [
        {
          role: 'user',
          content: `Voice transcript: "${transcript}"

Active UI controls:
${controlsDescription}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      res.json({ understood: false, mutations: [], fallbackText: transcript });
      return;
    }

    const parsed = JSON.parse(textBlock.text);
    res.json({
      understood: parsed.understood ?? false,
      mutations: (parsed.mutations ?? []) as Mutation[],
      message: parsed.message,
    });
  } catch (err: any) {
    console.error('Voice command interpretation error:', err);
    res.json({ understood: false, mutations: [], fallbackText: transcript });
  }
});

export default router;
