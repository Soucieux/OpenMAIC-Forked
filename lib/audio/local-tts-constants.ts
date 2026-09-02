/** Public, portable metadata for the shared local speech provider. */
export const LOCAL_TTS = {
  id: 'mlx-tts',
  onlyEnv: 'TTS_LOCAL_ONLY',
  onlyValue: '1',
  onlyMessage:
    'Only shared local speech is enabled in this process. Cloud and custom speech providers are disabled.',
  name: 'Shared local TTS (MLX)',
  model: 'mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16',
  modelName: 'Qwen3 TTS 1.7B Base (BF16)',
  voice: 'local-default',
  voiceName: 'Project local voice',
  voiceDescription:
    'Uses this project’s reference recording, or a variable default voice when no reference is configured.',
  baseUrl: 'http://127.0.0.1:8012/v1',
  endpoint: '/audio/speech',
  language: 'auto',
  wav: 'wav',
  method: 'POST',
  http: 'http:',
  loopback: ['127.0.0.1', 'localhost', '[::1]'],
  contentType: 'Content-Type',
  json: 'application/json',
  empty: '',
  redirect: 'error',
  badEndpoint: 'Shared local TTS requires a loopback HTTP endpoint without credentials.',
  unavailable:
    'Shared local TTS is unavailable. Mount the model store and start pnpm tts:serve. No cloud fallback was used.',
  invalidAudio: 'Shared local TTS did not return a WAV recording.',
} as const;
