// ============================================================================
// AUDIO PLAYER - Production Implementation
// Plays TTS audio at 24kHz with continuous buffering
// Based on Vapi/Deepgram production patterns
// ============================================================================

export class AudioPlayer {
    private audioContext: AudioContext | null = null;
    private gainNode: GainNode | null = null;

    // Continuous playback queue
    private audioQueue: AudioBuffer[] = [];
    private isPlaying = false;
    private currentSource: AudioBufferSourceNode | null = null;
    private nextStartTime = 0;

    constructor() {
        // Context created on first play (browser autoplay policy)
    }

    // Ensure AudioContext exists and is running
    private async ensureContext(): Promise<AudioContext> {
        if (!this.audioContext) {
            // Create at 24kHz to match TTS output
            this.audioContext = new AudioContext({ sampleRate: 24000 });
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            console.log(`✅ Audio Player: ${this.audioContext.sampleRate}Hz`);
        }

        // Resume if suspended (autoplay policy)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        return this.audioContext;
    }

    // Play WAV-containerized audio chunk
    async playChunk(wavData: ArrayBuffer): Promise<void> {
        try {
            const ctx = await this.ensureContext();

            // Decode WAV data to AudioBuffer
            const audioBuffer = await ctx.decodeAudioData(wavData.slice(0));

            // Add to queue
            this.audioQueue.push(audioBuffer);

            // Start playback if not already playing
            if (!this.isPlaying) {
                this.scheduleNext();
            }

        } catch (error) {
            console.warn('Audio decode error:', error);
        }
    }

    // Schedule next buffer for seamless playback
    private scheduleNext(): void {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            this.nextStartTime = 0;
            return;
        }

        if (!this.audioContext || !this.gainNode) return;

        this.isPlaying = true;
        const audioBuffer = this.audioQueue.shift()!;

        // Create buffer source
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.gainNode);

        // Calculate when to start this chunk
        const now = this.audioContext.currentTime;
        const startTime = Math.max(now, this.nextStartTime);

        // Schedule playback
        source.start(startTime);
        this.nextStartTime = startTime + audioBuffer.duration;
        this.currentSource = source;

        // Schedule next chunk when this ends
        source.onended = () => {
            this.currentSource = null;
            this.scheduleNext();
        };
    }

    // Stop all playback
    stop(): void {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch (e) {
                // Already stopped
            }
            this.currentSource = null;
        }

        this.audioQueue = [];
        this.isPlaying = false;
        this.nextStartTime = 0;
    }

    // Check if currently playing
    getIsPlaying(): boolean {
        return this.isPlaying;
    }

    // Clean up
    async close(): Promise<void> {
        this.stop();

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
    }
}
