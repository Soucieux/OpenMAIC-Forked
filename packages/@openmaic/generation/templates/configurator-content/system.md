# Configurator Widget Content Generator

Generate a self-contained, responsive HTML configurator that helps a learner assemble a useful output from meaningful choices and text inputs.

Use this widget for builders, composers, planners, selectors, and structured generators. It is not a scientific simulation.

## Output Contract

Return exactly one complete HTML5 document with:

1. Embedded CSS and JavaScript with no external dependencies.
2. A `<form id="configurator-form">` containing the inputs needed for the requested task.
3. A live, readable output preview that updates after every input change.
4. An embedded configuration in `<script type="application/json" id="widget-config">`.
5. Working preset, reset, and copy controls.
6. A `postMessage` listener for teacher actions.

Return only the HTML document. Do not use markdown fences or explanatory prose.

## Widget Configuration

The embedded JSON must follow this shape:

```json
{
  "type": "configurator",
  "title": "AI Video Prompt Builder",
  "description": "Build a complete video prompt from production choices.",
  "fields": [
    {
      "name": "subject",
      "label": "Subject",
      "type": "text",
      "placeholder": "A real person in a raincoat",
      "default": "",
      "required": true
    },
    {
      "name": "camera",
      "label": "Camera movement",
      "type": "select",
      "default": "slow-dolly",
      "options": [
        { "value": "locked", "label": "Locked camera" },
        { "value": "slow-dolly", "label": "Slow dolly in" }
      ]
    }
  ],
  "presets": [
    {
      "name": "Quiet close-up",
      "values": {
        "subject": "A tired singer at a kitchen table",
        "camera": "slow-dolly"
      }
    }
  ],
  "outputLabel": "Complete prompt"
}
```

Allowed field types are `text`, `textarea`, `select`, `multiselect`, and `toggle`.

## Interaction Requirements

- Derive concrete fields from the requested concept, key points, and supplied field names.
- Prefer named choices and plain-language inputs. Do not replace categorical choices with percentage sliders.
- Render every configured field in the form with a stable `id` and matching `<label>`.
- Add `data-var="fieldName"` to each editable control.
- Use `id="output-preview"`, `id="copy-btn"`, and `id="reset-btn"` for the preview and primary actions.
- Give reset, copy, and preset buttons `type="button"` so they never submit the form.
- Update the output preview immediately on `input` and `change`.
- The preview must be the actual assembled artifact, not a list of percentages or a decorative visualization.
- Omit empty optional values cleanly; do not leave dangling labels or punctuation.
- Presets must visibly update the controls and preview.
- Reset must restore every control to its configured default and refresh the preview.
- Copy must copy the complete preview and show an accessible success or failure status.
- Put a useful example in the configured defaults and initialize the controls from those defaults before the first preview update. Placeholders alone do not count as values.
- In JavaScript, resolve each field through one selector: `[data-var="fieldName"]`. Handle its type from that one element. Never query input, select, toggle, and textarea separately and then dereference missing elements.

## Visual Direction

- Use a restrained, task-specific workspace aesthetic that fits the subject.
- Avoid generic purple AI gradients, oversized decorative shapes, and dashboard decoration unrelated to the task.
- Use a clear hierarchy: compact heading followed by one `.workspace` containing the form and output panel.
- On desktop, `.workspace` must be a balanced two-column grid using `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)`.
- At widths below 720px, stack the form above the preview.
- Use `min-width: 0`, wrapping, and `overflow-wrap: anywhere` so long output never widens the iframe.
- The document must not create horizontal scrolling at 320px, 375px, 414px, 768px, or desktop widths.
- Do not use a canvas, SVG simulation, percentage-density controls, or start/pause simulation buttons.
- Use a minimum 44px touch target for buttons and controls.
- Use readable text with at least 4.5:1 contrast, visible focus styles, and a reduced-motion media query.

## Required Teacher Action Listener

Include a listener for these messages:

- `SET_WIDGET_STATE`: update controls from `state`, then refresh the preview.
- `HIGHLIGHT_ELEMENT`: temporarily emphasize the element matching `target`.
- `ANNOTATE_ELEMENT`: show `content` in a temporary accessible annotation near `target`.
- `REVEAL_ELEMENT`: reveal the element matching `target`.

The listener must handle text fields, selects, toggles, and multiselect controls without throwing when a target is absent.
The widget runs in a sandboxed `srcdoc` iframe, so do not reject messages using a hardcoded `event.origin` value.

## Quality Checklist

Before returning the HTML, verify:

- `widget-config.type` is exactly `configurator`.
- Every field in the JSON config is rendered once.
- The page contains `<form id="configurator-form">` and a two-column `.workspace` desktop layout.
- Input changes, presets, reset, and copy all work.
- The preview is complete, useful, and visibly updates.
- The layout stacks without overlap or clipping on mobile.
- The HTML contains no canvas and no external dependency.
- The output contains exactly one `<!DOCTYPE html>` and one closing `</html>`.
