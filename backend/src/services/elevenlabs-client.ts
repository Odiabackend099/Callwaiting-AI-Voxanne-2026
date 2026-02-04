import axios, { AxiosInstance, AxiosError } from 'axios';
import { createLogger } from './logger';
import CircuitBreaker from 'opossum';

const logger = createLogger('ElevenLabsClient');

// ========== INTERFACES ==========

export interface TTSParams {
  text: string;
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
}

export interface QuotaInfo {
  character_count: number;
  character_limit: number;
  can_use_delayed_payment_methods?: boolean;
}

export interface GeneratedAudio {
  audioBuffer: Buffer;
  durationSeconds?: number;
  characterCount: number;
}

// ========== CLIENT ==========

export class ElevenLabsClient {
  private client: AxiosInstance;
  private apiKey: string;
  private circuitBreaker: CircuitBreaker<any, any>;

  constructor(apiKey: string) {
    this.apiKey = apiKey;

    this.client = axios.create({
      baseURL: 'https://api.elevenlabs.io/v1',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    // Circuit breaker pattern (same as VapiClient)
    const generateSpeechFn = this.generateSpeechInternal.bind(this);
    this.circuitBreaker = new CircuitBreaker(generateSpeechFn, {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 60000, // 1 minute
      name: 'ElevenLabsAPI',
    });

    // Fallback when circuit is open
    this.circuitBreaker.fallback(() => {
      throw new Error('ElevenLabs service is currently unavailable. Please try again later.');
    });

    // Event listeners for monitoring
    this.circuitBreaker.on('open', () => {
      logger.error('Circuit breaker opened - ElevenLabs API is failing');
    });

    this.circuitBreaker.on('halfOpen', () => {
      logger.warn('Circuit breaker half-open - testing ElevenLabs API');
    });

    this.circuitBreaker.on('close', () => {
      logger.info('Circuit breaker closed - ElevenLabs API is healthy');
    });
  }

  /**
   * Generate speech from text (protected by circuit breaker)
   */
  async generateSpeech(params: TTSParams): Promise<GeneratedAudio> {
    try {
      return await this.circuitBreaker.fire(params);
    } catch (error) {
      logger.error('Failed to generate speech', {
        error: error instanceof Error ? error.message : String(error),
        text_length: params.text.length,
        voice_id: params.voiceId,
      });
      throw error;
    }
  }

  /**
   * Internal method called by circuit breaker
   */
  private async generateSpeechInternal(params: TTSParams): Promise<GeneratedAudio> {
    const {
      text,
      voiceId,
      modelId = 'eleven_turbo_v2_5', // Updated to use free tier compatible model
      stability = 0.75,
      similarityBoost = 0.75,
    } = params;

    logger.info('Generating speech', {
      text_length: text.length,
      voice_id: voiceId,
      model_id: modelId,
    });

    try {
      const response = await this.client.post(
        `/text-to-speech/${voiceId}`,
        {
          text,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
          },
        },
        {
          responseType: 'arraybuffer',
          maxContentLength: 50 * 1024 * 1024, // 50MB max
        }
      );

      const audioBuffer = Buffer.from(response.data);

      // Validate audio buffer size
      if (audioBuffer.length < 1024) {
        throw new Error(`Audio buffer too small: ${audioBuffer.length} bytes`);
      }

      if (audioBuffer.length > 50 * 1024 * 1024) {
        throw new Error(`Audio buffer too large: ${audioBuffer.length} bytes`);
      }

      logger.info('Speech generated successfully', {
        audio_size_bytes: audioBuffer.length,
        audio_size_kb: Math.round(audioBuffer.length / 1024),
      });

      return {
        audioBuffer,
        characterCount: text.length,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Log detailed error information
        logger.error('ElevenLabs API error', {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
          message: axiosError.message,
        });

        // Handle specific error cases
        if (axiosError.response?.status === 401) {
          throw new Error('Invalid ElevenLabs API key');
        }

        if (axiosError.response?.status === 429) {
          throw new Error('ElevenLabs rate limit exceeded. Please try again later.');
        }

        if (axiosError.response?.status === 500 || axiosError.response?.status === 503) {
          throw new Error('ElevenLabs service error. Please try again later.');
        }
      }

      throw error;
    }
  }

  /**
   * Get list of available voices
   */
  async getVoicesList(): Promise<Voice[]> {
    try {
      const response = await this.client.get('/voices');
      return response.data.voices;
    } catch (error) {
      logger.error('Failed to get voices list', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get current quota information
   */
  async getQuota(): Promise<QuotaInfo> {
    try {
      const response = await this.client.get('/user');
      return {
        character_count: response.data.subscription?.character_count || 0,
        character_limit: response.data.subscription?.character_limit || 10000,
        can_use_delayed_payment_methods: response.data.subscription?.can_use_delayed_payment_methods,
      };
    } catch (error) {
      logger.error('Failed to get quota information', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Retry wrapper with exponential backoff
   */
  async generateSpeechWithRetry(
    params: TTSParams,
    maxRetries: number = 3
  ): Promise<GeneratedAudio> {
    const retryDelays = [1000, 2000, 4000]; // 1s, 2s, 4s

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.generateSpeech(params);
      } catch (error) {
        const isRetryable =
          error instanceof Error &&
          (error.message.includes('rate limit') ||
            error.message.includes('service error') ||
            error.message.includes('timeout'));

        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }

        const delay = retryDelays[attempt];
        logger.warn(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, {
          error: error instanceof Error ? error.message : String(error),
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retries exceeded');
  }
}

/**
 * Factory function to create ElevenLabs client
 */
export function createElevenLabsClient(apiKey: string): ElevenLabsClient {
  return new ElevenLabsClient(apiKey);
}
