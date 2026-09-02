import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { LOCAL_TTS } from '@/lib/audio/local-tts-constants';
import { TEST } from './local-tts-fixtures';

vi.mock('@/lib/server/usage-storage', () => ({
  recordGenerationUsage: vi.fn().mockResolvedValue(undefined),
}));
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn<typeof fetch>() }));

vi.mock('@/lib/server/audio-provider-fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/audio-provider-fetch')>()),
  audioProviderFetch: (input: string | URL, init?: RequestInit) => fetchMock(input, init),
}));
const wav = new Uint8Array(46);
wav.set([82, 73, 70, 70], 0);
wav.set([87, 65, 86, 69], 8);

/**
 * Build a client request with deliberately conflicting provider hints.
 * @param provider Speech provider selected by the client.
 * @returns A request to the real TTS API handler.
 */
function request(provider: string = LOCAL_TTS.id): NextRequest {
  return new NextRequest(TEST.url, {
    method: LOCAL_TTS.method,
    headers: { [LOCAL_TTS.contentType]: LOCAL_TTS.json },
    body: JSON.stringify({
      text: TEST.text,
      audioId: TEST.audioId,
      ttsProviderId: provider,
      ttsVoice: provider === LOCAL_TTS.id ? LOCAL_TTS.voice : TEST.cloudVoice,
      ttsModelId: TEST.wrongModel,
      ttsBaseUrl: TEST.remote,
      ttsApiKey: TEST.key,
    }),
  });
}

describe(TEST.suite, () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubEnv(LOCAL_TTS.onlyEnv, LOCAL_TTS.onlyValue);
    vi.stubEnv(TEST.baseEnv, LOCAL_TTS.baseUrl);
    vi.stubEnv(TEST.modelsEnv, LOCAL_TTS.model);
    vi.stubEnv(TEST.disabledEnv, TEST.disabledValue);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it(TEST.managed, async () => {
    fetchMock.mockResolvedValue(new Response(wav));
    const { POST } = await import('@/app/api/generate/tts/route');
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(LOCAL_TTS.baseUrl + LOCAL_TTS.endpoint);
    expect(options?.headers).toEqual({ [LOCAL_TTS.contentType]: LOCAL_TTS.json });
    expect(JSON.parse(String(options?.body)).model).toBe(LOCAL_TTS.model);
  });

  it(TEST.disabled, async () => {
    const { POST } = await import('@/app/api/generate/tts/route');
    expect((await POST(request(TEST.cloud))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it(TEST.customDisabled, async () => {
    const { POST } = await import('@/app/api/generate/tts/route');
    expect((await POST(request(TEST.customProvider))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it(TEST.unavailable, async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    const { POST } = await import('@/app/api/generate/tts/route');
    expect((await POST(request())).status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
