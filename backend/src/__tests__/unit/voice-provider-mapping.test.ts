import { toVapiProvider } from '../../config/voice-registry';

describe('toVapiProvider', () => {
  it('maps "elevenlabs" to "11labs" (Vapi expected string)', () => {
    expect(toVapiProvider('elevenlabs')).toBe('11labs');
  });

  it('passes through "vapi" unchanged', () => {
    expect(toVapiProvider('vapi')).toBe('vapi');
  });

  it('passes through "openai" unchanged', () => {
    expect(toVapiProvider('openai')).toBe('openai');
  });

  it('passes through "azure" unchanged', () => {
    expect(toVapiProvider('azure')).toBe('azure');
  });

  it('passes through "playht" unchanged', () => {
    expect(toVapiProvider('playht')).toBe('playht');
  });

  it('passes through "rime" unchanged', () => {
    expect(toVapiProvider('rime')).toBe('rime');
  });

  it('passes through "google" unchanged', () => {
    expect(toVapiProvider('google')).toBe('google');
  });

  it('passes through unknown providers unchanged', () => {
    expect(toVapiProvider('some-future-provider')).toBe('some-future-provider');
  });

  it('handles empty string gracefully', () => {
    expect(toVapiProvider('')).toBe('');
  });
});
