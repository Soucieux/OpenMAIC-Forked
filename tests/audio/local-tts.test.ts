import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateTTS } from '@/lib/audio/tts-providers';
import { DEFAULT_TTS_MODELS, DEFAULT_TTS_VOICES, TTS_PROVIDERS } from '@/lib/audio/constants';
import { LOCAL_TTS } from '@/lib/audio/local-tts-constants';
import { TEST } from './local-tts-fixtures';

const { fetchMock, fetchPolicy } = vi.hoisted(() => ({
  fetchMock: vi.fn<typeof fetch>(),
  fetchPolicy: vi.fn(),
}));

vi.mock('@/lib/server/audio-provider-fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/audio-provider-fetch')>()),
  audioProviderFetch: (input: string | URL, init?: RequestInit, policy?: unknown) => {
    fetchPolicy(policy);
    return fetchMock(input, init);
  },
}));
const wav = new Uint8Array(46);
wav.set([82, 73, 70, 70], 0);
wav.set([87, 65, 86, 69], 8);

describe(TEST.suite, () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchPolicy.mockReset();
  });

  it(TEST.contract, async () => {
    fetchMock.mockResolvedValue(new Response(wav, { headers: { [TEST.contentType]: TEST.wav } }));
    const result = await generateTTS(
      { providerId: LOCAL_TTS.id, voice: LOCAL_TTS.voice },
      TEST.text,
    );
    expect(result).toEqual({ audio: wav, format: LOCAL_TTS.wav });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(LOCAL_TTS.baseUrl + LOCAL_TTS.endpoint);
    expect(options?.headers).toEqual({ [LOCAL_TTS.contentType]: LOCAL_TTS.json });
    expect(options?.redirect).toBe(LOCAL_TTS.redirect);
    expect(fetchPolicy).toHaveBeenCalledWith({ allowLocalNetworks: true, rejectRedirects: true });
    expect(JSON.parse(String(options?.body))).toEqual({
      model: LOCAL_TTS.model,
      input: TEST.text,
      voice: LOCAL_TTS.voice,
      speed: 1,
      lang_code: LOCAL_TTS.language,
      response_format: LOCAL_TTS.wav,
      stream: false,
    });
  });

  it(TEST.remoteRejected, async () => {
    await expect(
      generateTTS(
        { providerId: LOCAL_TTS.id, voice: LOCAL_TTS.voice, baseUrl: TEST.remote },
        TEST.text,
      ),
    ).rejects.toThrow(LOCAL_TTS.badEndpoint);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it(TEST.unavailable, async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    await expect(
      generateTTS({ providerId: LOCAL_TTS.id, voice: LOCAL_TTS.voice }, TEST.text),
    ).rejects.toThrow(LOCAL_TTS.unavailable);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it(TEST.invalid, async () => {
    fetchMock.mockResolvedValue(new Response(TEST.text));
    await expect(
      generateTTS({ providerId: LOCAL_TTS.id, voice: LOCAL_TTS.voice }, TEST.text),
    ).rejects.toThrow(LOCAL_TTS.invalidAudio);
  });

  it(TEST.fixedSpeed, async () => {
    fetchMock.mockResolvedValue(new Response(wav));
    await generateTTS({ providerId: LOCAL_TTS.id, voice: LOCAL_TTS.voice, speed: 1.5 }, TEST.text);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).speed).toBe(1);
  });

  it(TEST.registry, () => {
    expect(TTS_PROVIDERS[LOCAL_TTS.id].requiresApiKey).toBe(false);
    expect(DEFAULT_TTS_MODELS[LOCAL_TTS.id]).toBe(LOCAL_TTS.model);
    expect(DEFAULT_TTS_VOICES[LOCAL_TTS.id]).toBe(LOCAL_TTS.voice);
  });
});
