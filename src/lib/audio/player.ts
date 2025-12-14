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
    private readonly JITTER_BUFFER_SIZE = 2; // Reduced from 3 to lower latency
    private bufferDraining = false;

    // Source sample rate from Vapi (16kHz PCM16)
    private readonly SOURCE_SAMPLE_RATE = 16000;

    constructor() {
        // Let browser choose optimal output sample rate
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Create gain node to prevent clipping and reduce crackling
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0.85; // Slight reduction to prevent clipping
        this.gainNode.connect(this.ctx.destination);
        
        console.log(`✅ Audio Player: output ${this.ctx.sampleRate}Hz, source ${this.SOURCE_SAMPLE_RATE}Hz`);
    }

    async playChunk(audioData: ArrayBuffer): Promise<void> {
        try {
            // Guard against odd-length buffers
            if (audioData.byteLength % 2 !== 0) {
                console.warn('Odd-length PCM frame, dropping last byte');
                audioData = audioData.slice(0, audioData.byteLength - 1);
            }

            // Skip empty chunks
            if (audioData.byteLength === 0) {
                return;
            }

            // Add to jitter buffer
            this.jitterBuffer.push(audioData);

            // Start draining buffer once we have enough packets
            if (this.jitterBuffer.length >= this.JITTER_BUFFER_SIZE && !this.bufferDraining) {
                this.bufferDraining = true;
                this.drainJitterBuffer();
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

        this.bufferDraining = false;
    }

    private async playBufferedChunk(audioData: ArrayBuffer): Promise<void> {
        try {
            // Convert PCM16 to Float32 with soft clipping to reduce crackling
            const pcm16 = new Int16Array(audioData);
            const float32Data = new Float32Array(pcm16.length);

            for (let i = 0; i < pcm16.length; i++) {
                // Normalize to [-1, 1] range
                let sample = pcm16[i] / 32768.0;
                // Apply soft clipping to reduce harsh peaks
                if (sample > 0.95) sample = 0.95 + (sample - 0.95) * 0.1;
                if (sample < -0.95) sample = -0.95 + (sample + 0.95) * 0.1;
                float32Data[i] = sample;
            }

            // Create buffer at SOURCE sample rate (16kHz)
            // Browser handles resampling to output rate automatically
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
            // Calculate when this buffer should start to avoid gaps/overlaps
            const now = this.ctx.currentTime;
            const lastEndTime = this.playQueue.at(-1)?.when || 0;

            // Start immediately if queue is empty or in the past,
            // otherwise chain to previous buffer
            const startTime = Math.max(now, lastEndTime);

            // Schedule playback
            source.start(startTime);

            // Track when this buffer ends
            const endTime = startTime + buffer.duration;
            this.playQueue.push({ when: endTime });

            // Cleanup old entries (older than 1 second)
            const cutoff = now - 1;
            this.playQueue = this.playQueue.filter(item => item.when > cutoff);

            this.isPlaying = true;

        } catch (error) {
            console.error('Audio playback error:', error);
        }
    }

    // Stop all playback
    stop(): void {
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
