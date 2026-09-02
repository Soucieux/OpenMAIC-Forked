import { describe, expect, test } from 'vitest';

import { generateSceneContent } from '@openmaic/generation';
import type { AICallFn, GeneratedInteractiveContent, SceneOutline } from '@openmaic/generation';

const LANGUAGE_DIRECTIVE = 'Deliver the configurator in English.';

describe('configurator widget content routing', () => {
  test('routes configurators to a form-and-preview prompt without simulation UI', async () => {
    const captured: Array<{ system: string; user: string }> = [];
    const aiCall: AICallFn = async (system, user) => {
      captured.push({ system, user });
      return `<!DOCTYPE html>
<html>
  <body>
    <form><label for="subject">Subject</label><input id="subject" data-var="subject"></form>
    <output id="output-preview">A person walks through a real city street.</output>
    <button id="copy-btn">Copy</button>
    <button id="reset-btn">Reset</button>
    <script type="application/json" id="widget-config">
      {
        "type": "configurator",
        "title": "AI Video Prompt Builder",
        "description": "Build a complete video prompt.",
        "fields": [
          { "name": "subject", "label": "Subject", "type": "text", "default": "A person" }
        ],
        "outputLabel": "Complete prompt"
      }
    </script>
  </body>
</html>`;
    };

    const content = (await generateSceneContent(createConfiguratorOutline(), aiCall, {
      languageDirective: LANGUAGE_DIRECTIVE,
    })) as GeneratedInteractiveContent | null;

    expect(content?.widgetType).toBe('configurator');
    expect(content?.widgetConfig?.type).toBe('configurator');
    expect(content?.html).toContain('id="output-preview"');
    expect(content?.html).toContain('<form id="configurator-form">');
    expect(content?.html).not.toContain('<canvas');

    expect(captured).toHaveLength(1);
    expect(captured[0].system).toContain('# Configurator Widget Content Generator');
    expect(captured[0].system).toContain('Do not use a canvas');
    expect(captured[0].system).toContain('live, readable output preview');
    expect(captured[0].system).toContain('<form id="configurator-form">');
    expect(captured[0].system).toContain('one selector: `[data-var="fieldName"]`');
    expect(captured[0].system).toContain('do not reject messages using a hardcoded `event.origin`');
    expect(captured[0].user).toContain('real-world subject');
    expect(captured[0].user).toContain('negative constraints');
    expect(captured[0].user).toContain(LANGUAGE_DIRECTIVE);
    expect(captured[0].user).not.toContain('{{');
  });
});

function createConfiguratorOutline(): SceneOutline {
  return {
    id: 'scene-prompt-builder',
    type: 'interactive',
    title: 'AI Video Prompt Builder',
    description: 'Assemble a realistic video prompt from production choices.',
    keyPoints: ['Use real objects', 'Describe physical action', 'Maintain continuity'],
    order: 1,
    widgetType: 'configurator',
    widgetOutline: {
      concept: 'realistic AI video prompt',
      keyVariables: [
        'real-world subject',
        'objects',
        'physical action',
        'location',
        'camera',
        'lighting',
        'continuity',
        'negative constraints',
      ],
    },
  };
}
