import { describe, expect, test } from 'vitest';

import { normalizeConfiguratorConfig, renderConfiguratorHtml } from '@openmaic/generation';

describe('configurator renderer', () => {
  test('normalizes model fields and renders a safe working shell', () => {
    const config = normalizeConfiguratorConfig(
      {
        type: 'configurator',
        title: 'AI Video Prompt Builder',
        description: 'Build a realistic video prompt.',
        fields: [
          {
            name: 'Real-world subject',
            label: 'Subject',
            type: 'text',
            placeholder: 'A singer at a kitchen table',
            default: '',
          },
          {
            name: 'camera',
            label: 'Camera movement',
            type: 'select',
            default: 'missing',
            options: [
              { value: 'locked', label: 'Locked camera' },
              { value: 'dolly', label: 'Slow dolly in' },
            ],
          },
          {
            name: 'continuity',
            label: 'Maintain continuity',
            type: 'toggle',
            default: true,
          },
        ],
        presets: [
          {
            name: 'Quiet close-up',
            values: { 'real-world-subject': 'A tired singer', camera: 'dolly' },
          },
        ],
        outputLabel: 'Complete prompt',
      },
      { title: 'Fallback title' },
    );

    expect(config.fields[0]).toMatchObject({
      name: 'real-world-subject',
      default: 'A singer at a kitchen table',
    });
    expect(config.fields[1]).toMatchObject({ name: 'camera', default: 'locked' });

    const html = renderConfiguratorHtml(config);
    expect(html).toContain('<form id="configurator-form">');
    expect(html).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)');
    expect(html).toContain('id="output-preview"');
    expect(html).toContain('id="copy-btn"');
    expect(html).toContain('id="reset-btn"');
    expect(html).toContain("window.addEventListener('message'");
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('<script src=');

    const executableScripts = Array.from(html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi))
      .filter((match) => !match[1].includes('application/json'))
      .map((match) => match[2]);
    expect(executableScripts).toHaveLength(1);
    expect(() => new Function(executableScripts[0])).not.toThrow();
  });

  test('escapes model text and derives missing requested fields', () => {
    const config = normalizeConfiguratorConfig(
      {
        type: 'configurator',
        title: '</script><script>alert(1)</script>',
        fields: [],
      },
      {
        title: 'Fallback title',
        fieldNames: ['Physical action', 'Negative constraints'],
      },
    );

    expect(config.fields.map((field) => field.name)).toEqual([
      'physical-action',
      'negative-constraints',
    ]);

    const html = renderConfiguratorHtml(config);
    expect(html).not.toContain('</script><script>alert(1)</script>');
    expect(html).toContain('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('\\u003c/script\\u003e');
  });

  test('does not duplicate valid model fields with semantically similar fallback names', () => {
    const config = normalizeConfiguratorConfig(
      {
        type: 'configurator',
        fields: [
          {
            name: 'camera',
            label: 'Camera movement',
            type: 'text',
            default: 'Slow dolly in',
          },
        ],
      },
      { title: 'Builder', fieldNames: ['camera movement'] },
    );

    expect(config.fields.map((field) => field.name)).toEqual(['camera']);
  });
});
