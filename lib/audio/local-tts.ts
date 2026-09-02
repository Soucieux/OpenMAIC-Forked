import type { TTSModelConfig } from './types';
import type { TTSGenerationResult } from './tts-providers';
import { audioProviderFetch } from '@/lib/server/audio-provider-fetch';
import { LOCAL_TTS } from './local-tts-constants';

/**
 * Generate WAV audio through the shared-model service running on this Mac.
 * @param config Project voice and operator-owned local endpoint settings.
 * @param text Text to speak.
 * @param signal Existing request timeout and cancellation signal.
 * @returns Generated WAV bytes; errors never trigger another provider.
 */
export async function generateLocalTTS(
  config: TTSModelConfig,
  text: string,
  signal: AbortSignal,
): Promise<TTSGenerationResult> {
  const endpoint = config.baseUrl || LOCAL_TTS.baseUrl;
  const url = new URL(endpoint);
  if (
    url.protocol !== LOCAL_TTS.http ||
    !LOCAL_TTS.loopback.some((host) => host === url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(LOCAL_TTS.badEndpoint);
  }
  // The loopback check above is what makes local networks safe to allow here.
  const response = await audioProviderFetch(
    endpoint.replace(/\/$/, LOCAL_TTS.empty) + LOCAL_TTS.endpoint,
    {
      method: LOCAL_TTS.method,
      headers: { [LOCAL_TTS.contentType]: LOCAL_TTS.json },
      body: JSON.stringify({
        model: config.modelId || LOCAL_TTS.model,
        input: text,
        voice: config.voice || LOCAL_TTS.voice,
        speed: 1,
        lang_code: LOCAL_TTS.language,
        response_format: LOCAL_TTS.wav,
        stream: false,
      }),
      signal,
      redirect: LOCAL_TTS.redirect,
    },
    {
      allowLocalNetworks: true,
      rejectRedirects: true,
    },
  );
  if (!response.ok) throw new Error(LOCAL_TTS.unavailable);
  const audio = new Uint8Array(await response.arrayBuffer());
  if (
    audio.length < 44 ||
    audio[0] !== 82 ||
    audio[1] !== 73 ||
    audio[2] !== 70 ||
    audio[3] !== 70 ||
    audio[8] !== 87 ||
    audio[9] !== 65 ||
    audio[10] !== 86 ||
    audio[11] !== 69
  ) {
    throw new Error(LOCAL_TTS.invalidAudio);
  }
  return { audio, format: LOCAL_TTS.wav };
}
