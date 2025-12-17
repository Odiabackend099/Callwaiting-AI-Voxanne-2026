// ============================================================================
// AUDIO PLAYER - Production Implementation with Jitter Buffer
// Plays PCM16 audio with gapless scheduling and network jitter smoothing
// Based on 2025 industry standards (Twilio, Discord, Zoom patterns)
// ============================================================================

export class AudioPlayer {
    private ctx: AudioContext;
    private playQueue: Array<{ when: number }> = [];
    private isPlaying = false;
    private gainNode: GainNode | null = null;

    // Jitter buffer to smooth out network irregularities
    private jitterBuffer: ArrayBuffer[] = [];
    private readonly JITTER_BUFFER_SIZE = 6; // Increased to smooth Vapi's bursty delivery
    private bufferDraining = false;
    private drainTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private lastPlaybackTime = 0; // Track last scheduled playback to prevent overlaps

    // Source sample rate from Vapi (16kHz PCM16)
    private readonly SOURCE_SAMPLE_RATE = 16000;

    constructor() {
        // Force AudioContext to 16kHz to match source (prevents resampling glitches)
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

        // Create gain node to prevent clipping and reduce crackling
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0.75; // Reduced further to prevent distortion
        this.gainNode.connect(this.ctx.destination);

        console.log(`✅ Audio Player: output ${this.ctx.sampleRate}Hz, source ${this.SOURCE_SAMPLE_RATE}Hz`);
    }

    async playChunk(audioData: ArrayBuffer): Promise<void> {
        try {
            // Guard against odd-length buffers (PCM16 requires even byte count)
            if (audioData.byteLength % 2 !== 0) {
                audioData = audioData.slice(0, audioData.byteLength - 1);
            }

            // Skip empty chunks
            if (audioData.byteLength === 0) {
                return;
            }

            // Add to jitter buffer
            this.jitterBuffer.push(audioData);

            // Start draining if buffer is ready
            if (!this.bufferDraining) {
                if (this.jitterBuffer.length >= this.JITTER_BUFFER_SIZE) {
                    // Enough packets buffered, start draining immediately
                    this.bufferDraining = true;
                    this.drainJitterBuffer();
                } else {
                    // Not enough yet, schedule a delayed drain to prevent stalling
                    if (!this.drainTimeoutId) {
                        this.drainTimeoutId = setTimeout(() => {
                            this.drainTimeoutId = null;
                            if (this.jitterBuffer.length > 0 && !this.bufferDraining) {
                                this.bufferDraining = true;
                                this.drainJitterBuffer();
                            }
                        }, 100); // 100ms max wait
                    }
                }
            }

        } catch (error) {
            console.error('Audio buffering error:', error);
        }
    }

    private async drainJitterBuffer(): Promise<void> {
        // Process all buffered chunks
        while (this.jitterBuffer.length > 0) {
            const audioData = this.jitterBuffer.shift()!;
            await this.playBufferedChunk(audioData);
        }

        // Check for more incoming packets
        // Short delay to aggregate packets that are in-flight
        await new Promise(resolve => setTimeout(resolve, 20));

        if (this.jitterBuffer.length > 0) {
            // More packets arrived, keep draining
            await this.drainJitterBuffer();
        } else {
            // No more packets, stop draining
            this.bufferDraining = false;
        }
    }

    private async playBufferedChunk(audioData: ArrayBuffer): Promise<void> {
        try {
            // Convert PCM16 to Float32 with soft clipping to reduce crackling
            const pcm16 = new Int16Array(audioData);
            const float32Data = new Float32Array(pcm16.length);

            for (let i = 0; i < pcm16.length; i++) {
                // Normalize to [-1, 1] range
                let sample = pcm16[i] / 32768.0;
                // Apply soft clipping to reduce harsh peaks (tanh-like curve)
                if (sample > 0.8) sample = 0.8 + (sample - 0.8) * 0.25;
                if (sample < -0.8) sample = -0.8 + (sample + 0.8) * 0.25;
                float32Data[i] = sample;
            }

            // Create buffer at SOURCE sample rate (16kHz)
            const buffer = this.ctx.createBuffer(
                1,
                float32Data.length,
                this.SOURCE_SAMPLE_RATE
            );
            buffer.getChannelData(0).set(float32Data);

            // Create source node and connect through gain node
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.gainNode || this.ctx.destination);

            // CRITICAL: Gapless scheduling
            const now = this.ctx.currentTime;
            const lastEndTime = this.playQueue.at(-1)?.when || 0;

            // Start immediately if queue is empty or in the past
            const startTime = Math.max(now, lastEndTime);

            // Schedule playback
            source.start(startTime);

            // Track when this buffer ends
            const endTime = startTime + buffer.duration;
            this.playQueue.push({ when: endTime });

            // Cleanup old entries (older than 2 seconds)
            const cutoff = now - 2;
            this.playQueue = this.playQueue.filter(item => item.when > cutoff);

            this.isPlaying = true;

        } catch (error) {
            console.error('Audio playback error:', error);
        }
    }

    // Stop all playback
    stop(): void {
        if (this.drainTimeoutId) {
            clearTimeout(this.drainTimeoutId);
            this.drainTimeoutId = null;
        }
        this.jitterBuffer = [];
        this.playQueue = [];
        this.isPlaying = false;
        this.bufferDraining = false;
    }

    // Resume audio context (browser autoplay policy)
    async resume(): Promise<void> {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
            console.log('🔊 Audio context resumed');
        }
    }

    getState(): string {
        return this.ctx.state;
    }

    isCurrentlyPlaying(): boolean {
        return this.isPlaying && (this.playQueue.length > 0 || this.jitterBuffer.length > 0);
    }

    // Get buffer health metrics
    getBufferStats(): { jitterSize: number; queueSize: number; isDraining: boolean } {
        return {
            jitterSize: this.jitterBuffer.length,
            queueSize: this.playQueue.length,
            isDraining: this.bufferDraining,
        };
    }

    // Clean up
    async close(): Promise<void> {
        this.stop();
        if (this.ctx) {
            await this.ctx.close();
        }
    }
}
