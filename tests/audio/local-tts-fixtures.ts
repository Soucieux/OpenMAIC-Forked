export const TEST = {
  text: 'Hello from the shared local voice.',
  remote: 'https://example.com/v1',
  contentType: 'content-type',
  wav: 'audio/wav',
  suite: 'Shared local speech',
  contract: 'uses the local provider, pinned model and WAV contract without an API key',
  remoteRejected: 'rejects a remote endpoint before sending text',
  unavailable: 'fails without contacting another provider when local speech is unavailable',
  invalid: 'rejects a non-audio response even when HTTP succeeds',
  fixedSpeed:
    'uses normal speed for the Base model even when another provider left a speed preference',
  registry: 'provides a distinct local voice and model without reusing cloud IDs',
} as const;
