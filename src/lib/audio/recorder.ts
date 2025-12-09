// ============================================================================
// AUDIO RECORDER - Production Implementation
// Captures microphone audio at 16kHz for Deepgram Flux STT
// Based on Vapi/Deepgram production patterns
// ============================================================================

export class AudioRecorder {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private processorNode: ScriptProcessorNode | null = null;
    private ws: WebSocket;
    private isRecording = false;
    private chunkCount = 0;

    constructor(websocket: WebSocket) {
        this.ws = websocket;
    }

    async start(): Promise<void> {
        console.log('🎤 Starting audio capture...');

        try {
            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000  // Request 16kHz for Flux
                }
            });

            // Create AudioContext at 16kHz (CRITICAL for Flux)
            this.audioContext = new AudioContext({ sampleRate: 16000 });

            console.log(`✅ Audio Context: ${this.audioContext.sampleRate}Hz`);

            // Create source from microphone
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Create processor node (4096 samples = 256ms at 16kHz)
            this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

            // CRITICAL: Connect processor to destination (required for onaudioprocess to fire)
            this.processorNode.connect(this.audioContext.destination);

            // Process audio frames
            this.processorNode.onaudioprocess = (event) => {
                if (!this.isRecording) return;
                if (this.ws.readyState !== WebSocket.OPEN) return;

                const inputBuffer = event.inputBuffer;
                const float32Data = inputBuffer.getChannelData(0);

                // Convert Float32 [-1,1] to Int16 PCM
                const pcm16 = this.float32ToInt16(float32Data);

                // Send to server
                this.ws.send(pcm16.buffer);
                this.chunkCount++;
            };

            // Connect: mic -> processor -> destination
            this.sourceNode.connect(this.processorNode);

            this.isRecording = true;
            this.chunkCount = 0;
            console.log('✅ Recording started (16kHz PCM16)');

        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            throw error;
        }
    }

    // Convert Float32 samples to Int16 PCM
    private float32ToInt16(float32Array: Float32Array): Int16Array {
        const int16 = new Int16Array(float32Array.length);

        for (let i = 0; i < float32Array.length; i++) {
            // Clamp to [-1, 1]
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            // Convert to Int16 range
            int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }

        return int16;
    }

    stop(): void {
        console.log(`🎤 Stopping recording (${this.chunkCount} chunks sent)...`);

        this.isRecording = false;

        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        if (this.processorNode) {
            this.processorNode.disconnect();
            this.processorNode = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        console.log('✅ Recording stopped');
    }

    isActive(): boolean {
        return this.isRecording;
    }
}
