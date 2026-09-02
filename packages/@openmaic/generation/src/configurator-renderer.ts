import type { WidgetConfigBase } from '@openmaic/dsl';

const FIELD_TYPES = ['text', 'textarea', 'select', 'multiselect', 'toggle'] as const;

type ConfiguratorFieldType = (typeof FIELD_TYPES)[number];
type ConfiguratorValue = string | string[] | boolean;

interface ConfiguratorOption {
  value: string;
  label: string;
}

interface ConfiguratorField {
  name: string;
  label: string;
  type: ConfiguratorFieldType;
  placeholder?: string;
  default: ConfiguratorValue;
  required?: boolean;
  options?: ConfiguratorOption[];
}

interface ConfiguratorPreset {
  name: string;
  values: Record<string, ConfiguratorValue>;
}

export interface NormalizedConfiguratorConfig extends WidgetConfigBase {
  type: 'configurator';
  title: string;
  description: string;
  fields: ConfiguratorField[];
  presets: ConfiguratorPreset[];
  outputLabel: string;
}

interface ConfiguratorFallbacks {
  title: string;
  description?: string;
  fieldNames?: string[];
}

/**
 * Normalize unreliable model output into the small contract consumed by the
 * deterministic configurator renderer. Placeholder text becomes the initial
 * value when the model leaves a text default blank, so the first preview is
 * useful instead of empty.
 */
export function normalizeConfiguratorConfig(
  config: WidgetConfigBase | undefined,
  fallbacks: ConfiguratorFallbacks,
): NormalizedConfiguratorConfig {
  const source = asRecord(config);
  const fields = normalizeFields(source?.fields, fallbacks.fieldNames);
  const fieldNames = new Set(fields.map((field) => field.name));

  return {
    type: 'configurator',
    title: cleanText(source?.title) || fallbacks.title,
    description: cleanText(source?.description) || fallbacks.description || '',
    fields,
    presets: normalizePresets(source?.presets, fieldNames),
    outputLabel: cleanText(source?.outputLabel) || 'Generated output',
  };
}

/** Render a dependency-free, responsive configurator from normalized content. */
export function renderConfiguratorHtml(config: NormalizedConfiguratorConfig): string {
  const fields = config.fields.map(renderField).join('\n');
  const presets = config.presets.length
    ? `<div class="preset-row" aria-label="Presets">
          <span class="preset-label">Presets</span>
          ${config.presets
            .map(
              (preset, index) =>
                `<button class="preset-button" type="button" data-preset-index="${index}">${escapeHtml(preset.name)}</button>`,
            )
            .join('\n')}
        </div>`
    : '';
  const embeddedConfig = escapeJsonForScript(config);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --page: #f3f6fa;
      --surface: #ffffff;
      --surface-muted: #f7f9fc;
      --text: #172033;
      --muted: #5f6b7d;
      --border: #d9e0ea;
      --border-strong: #b8c3d1;
      --accent: #2457d6;
      --accent-dark: #173f9f;
      --focus: #84a9ff;
      --success: #176b45;
      --shadow: 0 16px 40px rgba(34, 55, 86, 0.10);
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; min-width: 0; min-height: 100%; }

    body {
      padding: clamp(16px, 3vw, 36px);
      background: var(--page);
      color: var(--text);
      font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    button, input, select, textarea { font: inherit; }

    .app-shell {
      width: min(1180px, 100%);
      margin: 0 auto;
      min-width: 0;
    }

    .page-header { margin-bottom: 20px; }

    .eyebrow {
      margin: 0 0 6px;
      color: var(--accent);
      font-size: 12px;
      font-weight: 750;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(24px, 3.4vw, 38px);
      line-height: 1.12;
      letter-spacing: -0.025em;
    }

    .description {
      max-width: 760px;
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 15px;
    }

    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 20px;
      align-items: start;
      min-width: 0;
    }

    .panel {
      min-width: 0;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }

    .panel-header {
      padding: 20px 22px 16px;
      border-bottom: 1px solid var(--border);
    }

    .panel-kicker {
      margin: 0 0 4px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .panel-title { margin: 0; font-size: 19px; line-height: 1.3; }
    #configurator-form { padding: 20px 22px 22px; }

    .field-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 16px;
      min-width: 0;
    }

    .field { min-width: 0; }
    .field-wide { grid-column: 1 / -1; }

    .field-label {
      display: block;
      margin: 0 0 7px;
      font-size: 13px;
      font-weight: 700;
    }

    .required { color: var(--accent-dark); }

    input[type="text"], select, textarea {
      display: block;
      width: 100%;
      min-width: 0;
      min-height: 44px;
      padding: 10px 12px;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      outline: none;
    }

    textarea { min-height: 96px; resize: vertical; }
    select[multiple] { min-height: 116px; }

    input:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
      border-color: var(--accent);
    }

    .toggle-control {
      display: flex;
      align-items: center;
      min-height: 44px;
      gap: 10px;
      color: var(--text);
      cursor: pointer;
    }

    .toggle-control input { width: 20px; height: 20px; margin: 0; accent-color: var(--accent); }

    .preset-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 18px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
    }

    .preset-label { margin-right: 2px; color: var(--muted); font-size: 13px; font-weight: 700; }

    button {
      min-height: 44px;
      padding: 9px 14px;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      background: var(--surface);
      color: var(--text);
      font-weight: 700;
      cursor: pointer;
    }

    button:hover { border-color: var(--accent); color: var(--accent-dark); }
    .preview-panel { position: sticky; top: 16px; }
    .preview-body { padding: 22px; }

    #output-preview {
      display: block;
      min-height: 220px;
      margin: 0;
      padding: 18px;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-muted);
      color: var(--text);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 14px;
      line-height: 1.65;
    }

    .action-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }

    #copy-btn {
      border-color: var(--accent);
      background: var(--accent);
      color: #ffffff;
    }

    #copy-btn:hover { border-color: var(--accent-dark); background: var(--accent-dark); color: #ffffff; }
    #copy-status { min-height: 24px; margin: 10px 0 0; color: var(--success); font-size: 13px; }
    .teacher-highlight { outline: 4px solid #f1b62c !important; outline-offset: 3px; }

    .teacher-annotation {
      margin-top: 8px;
      padding: 10px 12px;
      border-left: 3px solid var(--accent);
      border-radius: 6px;
      background: #eef3ff;
      color: var(--text);
      font-size: 13px;
    }

    [hidden] { display: none !important; }

    @media (max-width: 860px) {
      body { padding: 14px; }
      .workspace { grid-template-columns: minmax(0, 1fr); }
      .preview-panel { position: static; }
    }

    @media (max-width: 560px) {
      .field-grid { grid-template-columns: minmax(0, 1fr); }
      .field-wide { grid-column: auto; }
      .panel-header, #configurator-form, .preview-body { padding-left: 16px; padding-right: 16px; }
      .action-row button { flex: 1 1 130px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <main class="app-shell">
    <header class="page-header">
      <p class="eyebrow">Interactive builder</p>
      <h1>${escapeHtml(config.title)}</h1>
      ${config.description ? `<p class="description">${escapeHtml(config.description)}</p>` : ''}
    </header>

    <div class="workspace">
      <section class="panel" aria-labelledby="inputs-title">
        <div class="panel-header">
          <p class="panel-kicker">Step 1</p>
          <h2 class="panel-title" id="inputs-title">Choose the details</h2>
        </div>
        <form id="configurator-form">
          <div class="field-grid">
            ${fields}
          </div>
          ${presets}
        </form>
      </section>

      <section class="panel preview-panel" aria-labelledby="preview-title">
        <div class="panel-header">
          <p class="panel-kicker">Step 2</p>
          <h2 class="panel-title" id="preview-title">${escapeHtml(config.outputLabel)}</h2>
        </div>
        <div class="preview-body">
          <output id="output-preview" aria-live="polite"></output>
          <div class="action-row">
            <button id="copy-btn" type="button">Copy output</button>
            <button id="reset-btn" type="button">Reset</button>
          </div>
          <p id="copy-status" role="status" aria-live="polite"></p>
        </div>
      </section>
    </div>
  </main>

  <script type="application/json" id="widget-config">${embeddedConfig}</script>
  <script>
    (() => {
      const config = JSON.parse(document.getElementById('widget-config').textContent);
      const form = document.getElementById('configurator-form');
      const preview = document.getElementById('output-preview');
      const copyStatus = document.getElementById('copy-status');
      const controlFor = (name) => document.querySelector('[data-var="' + name + '"]');

      function readValue(field) {
        const control = controlFor(field.name);
        if (!control) return field.type === 'toggle' ? false : '';
        if (field.type === 'toggle') return control.checked;
        if (field.type === 'multiselect') {
          return Array.from(control.selectedOptions).map((option) => option.textContent.trim());
        }
        if (field.type === 'select') {
          return control.selectedOptions[0]?.textContent.trim() || control.value.trim();
        }
        return control.value.trim();
      }

      function writeValue(field, value) {
        const control = controlFor(field.name);
        if (!control) return;
        if (field.type === 'toggle') {
          control.checked = Boolean(value);
          return;
        }
        if (field.type === 'multiselect') {
          const selected = new Set(Array.isArray(value) ? value.map(String) : []);
          Array.from(control.options).forEach((option) => {
            option.selected = selected.has(option.value);
          });
          return;
        }
        control.value = typeof value === 'string' ? value : '';
      }

      function updatePreview() {
        const lines = config.fields.flatMap((field) => {
          const value = readValue(field);
          if (field.type === 'toggle') return value ? [field.label + ': Yes'] : [];
          if (Array.isArray(value)) return value.length ? [field.label + ': ' + value.join(', ')] : [];
          return value ? [field.label + ': ' + value] : [];
        });
        preview.textContent = lines.join('\\n');
      }

      function applyValues(values) {
        config.fields.forEach((field) => {
          if (Object.prototype.hasOwnProperty.call(values, field.name)) {
            writeValue(field, values[field.name]);
          }
        });
        updatePreview();
      }

      function reset() {
        const defaults = Object.fromEntries(config.fields.map((field) => [field.name, field.default]));
        applyValues(defaults);
        copyStatus.textContent = '';
      }

      async function copyOutput() {
        const text = preview.textContent || '';
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
          } else {
            const helper = document.createElement('textarea');
            helper.value = text;
            helper.setAttribute('readonly', '');
            helper.style.position = 'fixed';
            helper.style.opacity = '0';
            document.body.appendChild(helper);
            helper.select();
            if (!document.execCommand('copy')) throw new Error('Copy command failed');
            helper.remove();
          }
          copyStatus.textContent = 'Copied.';
        } catch {
          copyStatus.textContent = 'Copy failed. Select the output and copy it manually.';
        }
      }

      function safeQuery(selector) {
        if (typeof selector !== 'string' || !selector) return null;
        try { return document.querySelector(selector); } catch { return null; }
      }

      function temporarilyHighlight(element) {
        if (!element) return;
        element.classList.add('teacher-highlight');
        window.setTimeout(() => element.classList.remove('teacher-highlight'), 1800);
      }

      form.addEventListener('input', updatePreview);
      form.addEventListener('change', updatePreview);
      document.getElementById('reset-btn').addEventListener('click', reset);
      document.getElementById('copy-btn').addEventListener('click', copyOutput);
      document.querySelectorAll('[data-preset-index]').forEach((button) => {
        button.addEventListener('click', () => {
          const preset = config.presets[Number(button.dataset.presetIndex)];
          if (preset) applyValues(preset.values);
        });
      });

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (!message || typeof message !== 'object') return;
        const action = message.action || message.type;
        if (action === 'SET_WIDGET_STATE' && message.state && typeof message.state === 'object') {
          applyValues(message.state);
          return;
        }
        const target = safeQuery(message.target);
        if (action === 'HIGHLIGHT_ELEMENT') temporarilyHighlight(target);
        if (action === 'REVEAL_ELEMENT' && target) target.hidden = false;
        if (action === 'ANNOTATE_ELEMENT' && target && typeof message.content === 'string') {
          const prior = target.parentElement && target.parentElement.querySelector('.teacher-annotation');
          if (prior) prior.remove();
          const annotation = document.createElement('div');
          annotation.className = 'teacher-annotation';
          annotation.setAttribute('role', 'note');
          annotation.textContent = message.content;
          target.insertAdjacentElement('afterend', annotation);
          window.setTimeout(() => annotation.remove(), 5000);
        }
      });

      reset();
    })();
  </script>
</body>
</html>`;
}

function normalizeFields(value: unknown, fallbackNames: string[] = []): ConfiguratorField[] {
  const candidates = Array.isArray(value) ? value : [];
  const names = new Set<string>();
  const fields: ConfiguratorField[] = [];

  for (const candidate of candidates) {
    const source = asRecord(candidate);
    if (!source) continue;
    const name = normalizeName(source.name);
    const type = normalizeFieldType(source.type);
    if (!name || !type || names.has(name)) continue;

    let options = normalizeOptions(source.options);
    let normalizedType = type;
    if ((type === 'select' || type === 'multiselect') && options.length === 0) {
      normalizedType = 'text';
      options = [];
    }

    const placeholder = cleanText(source.placeholder);
    const defaultValue = normalizeDefault(source.default, normalizedType, options, placeholder);
    names.add(name);
    fields.push({
      name,
      label: cleanText(source.label) || labelFromName(name),
      type: normalizedType,
      ...(placeholder ? { placeholder } : {}),
      default: defaultValue,
      ...(source.required === true ? { required: true } : {}),
      ...(options.length ? { options } : {}),
    });
  }

  if (fields.length === 0) {
    for (const fallbackName of fallbackNames) {
      const name = normalizeName(fallbackName);
      if (!name || names.has(name)) continue;
      names.add(name);
      fields.push({ name, label: labelFromName(name), type: 'text', default: '' });
    }
  }

  return fields.length
    ? fields.slice(0, 16)
    : [{ name: 'details', label: 'Details', type: 'textarea', default: '' }];
}

function normalizePresets(value: unknown, fieldNames: Set<string>): ConfiguratorPreset[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((candidate): ConfiguratorPreset[] => {
      const source = asRecord(candidate);
      const values = asRecord(source?.values);
      const name = cleanText(source?.name);
      if (!source || !values || !name) return [];
      const accepted: Record<string, ConfiguratorValue> = {};
      for (const [key, item] of Object.entries(values)) {
        if (!fieldNames.has(key)) continue;
        if (typeof item === 'string' || typeof item === 'boolean') accepted[key] = item;
        if (Array.isArray(item) && item.every((entry) => typeof entry === 'string')) {
          accepted[key] = item;
        }
      }
      return [{ name, values: accepted }];
    })
    .slice(0, 8);
}

function normalizeOptions(value: unknown): ConfiguratorOption[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .flatMap((candidate): ConfiguratorOption[] => {
      const source = asRecord(candidate);
      const optionValue = cleanText(source?.value);
      if (!source || !optionValue || seen.has(optionValue)) return [];
      seen.add(optionValue);
      return [{ value: optionValue, label: cleanText(source.label) || optionValue }];
    })
    .slice(0, 20);
}

function normalizeDefault(
  value: unknown,
  type: ConfiguratorFieldType,
  options: ConfiguratorOption[],
  placeholder: string,
): ConfiguratorValue {
  if (type === 'toggle') return value === true;
  if (type === 'multiselect') {
    const allowed = new Set(options.map((option) => option.value));
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && allowed.has(item))
      : [];
  }
  if (type === 'select') {
    const text = cleanText(value);
    return options.some((option) => option.value === text) ? text : (options[0]?.value ?? '');
  }
  return cleanText(value) || placeholder;
}

function normalizeFieldType(value: unknown): ConfiguratorFieldType | undefined {
  return FIELD_TYPES.find((type) => type === value);
}

function normalizeName(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function labelFromName(name: string): string {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 1000) : '';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function renderField(field: ConfiguratorField): string {
  const label = escapeHtml(field.label);
  const required = field.required ? ' required' : '';
  const requiredLabel = field.required ? ' <span class="required" aria-hidden="true">*</span>' : '';
  const wide = field.type === 'textarea' || field.type === 'multiselect' ? ' field-wide' : '';
  const attributes = `id="${field.name}" data-var="${field.name}"${required}`;

  if (field.type === 'toggle') {
    return `<div class="field${wide}">
      <span class="field-label">${label}${requiredLabel}</span>
      <label class="toggle-control" for="${field.name}">
        <input type="checkbox" ${attributes}${field.default ? ' checked' : ''}>
        <span>${label}</span>
      </label>
    </div>`;
  }

  if (field.type === 'select' || field.type === 'multiselect') {
    const selected = new Set(Array.isArray(field.default) ? field.default : [field.default]);
    const options = (field.options ?? [])
      .map(
        (option) =>
          `<option value="${escapeHtml(option.value)}"${selected.has(option.value) ? ' selected' : ''}>${escapeHtml(option.label)}</option>`,
      )
      .join('\n');
    return `<div class="field${wide}">
      <label class="field-label" for="${field.name}">${label}${requiredLabel}</label>
      <select ${attributes}${field.type === 'multiselect' ? ' multiple' : ''}>${options}</select>
    </div>`;
  }

  const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : '';
  const value = typeof field.default === 'string' ? field.default : '';
  const control =
    field.type === 'textarea'
      ? `<textarea ${attributes}${placeholder}>${escapeHtml(value)}</textarea>`
      : `<input type="text" ${attributes}${placeholder} value="${escapeHtml(value)}">`;
  return `<div class="field${wide}">
    <label class="field-label" for="${field.name}">${label}${requiredLabel}</label>
    ${control}
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeJsonForScript(config: NormalizedConfiguratorConfig): string {
  return JSON.stringify(config)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}
