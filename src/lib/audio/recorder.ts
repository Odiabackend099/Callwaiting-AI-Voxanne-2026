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
    private onError?: (error: string) => void;

    constructor(websocket: WebSocket, onError?: (error: string) => void) {
        this.ws = websocket;
        this.onError = onError;
    }

    async start(): Promise<void> {
        try {
            // Request microphone access with error handling
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000
                }
            }).catch(error => {
                const errorMsg = error.name === 'NotAllowedError' 
                    ? 'Microphone permission denied. Please allow microphone access.'
                    : error.name === 'NotFoundError'
                    ? 'No microphone found. Please check your device.'
                    : `Microphone error: ${error.message}`;
                this.onError?.(errorMsg);
                throw new Error(errorMsg);
            });

            // Create AudioContext at 16kHz
            this.audioContext = new AudioContext({ sampleRate: 16000 });

            // Create source from microphone
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Create processor node (2048 samples = 128ms at 16kHz for lower latency)
            // ScriptProcessorNode is deprecated but still functional; AudioWorklet is preferred for new code
            this.processorNode = this.audioContext.createScriptProcessor(2048, 1, 1);

            // Connect processor to destination (required for onaudioprocess to fire)
            this.processorNode.connect(this.audioContext.destination);

            // Process audio frames
            this.processorNode.onaudioprocess = (event) => {
                if (!this.isRecording) return;
                if (this.ws.readyState !== WebSocket.OPEN) {
                    this.isRecording = false;
                    return;
                }

                const inputBuffer = event.inputBuffer;
                const float32Data = inputBuffer.getChannelData(0);

                // Convert Float32 [-1,1] to Int16 PCM
                const pcm16 = this.float32ToInt16(float32Data);

                // Send to server
                try {
                    this.ws.send(pcm16.buffer);
                    this.chunkCount++;
                } catch (error) {
                    console.error('[AudioRecorder] Failed to send audio chunk:', error);
                    this.isRecording = false;
                }
            };

            // Connect: mic -> processor -> destination
            this.sourceNode.connect(this.processorNode);

            this.isRecording = true;
            this.chunkCount = 0;
            console.log('[AudioRecorder] Recording started at 16kHz');

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Failed to start recording';
            this.onError?.(errorMsg);
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
