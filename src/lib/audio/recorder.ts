// ============================================================================
// AUDIO RECORDER - Production Implementation
// Captures microphone audio at 16kHz for Deepgram Flux STT
// Based on Vapi/Deepgram production patterns
// ============================================================================

export class AudioRecorder {
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private workletNode: AudioWorkletNode | null = null;
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
            // Request microphone access
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

            // Load AudioWorklet
            try {
                await this.audioContext.audioWorklet.addModule('/worklets/audio-processor.js');
            } catch (e) {
                console.error('[AudioRecorder] Failed to load audio worklet:', e);
                throw new Error('Failed to load audio processor. Please refresh and try again.');
            }

            // Create source
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Create AudioWorkletNode
            this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

            // Handle messages from worklet (PCM16 chunks)
            this.workletNode.port.onmessage = (event) => {
                if (!this.isRecording) return;
                if (this.ws.readyState !== WebSocket.OPEN) {
                    this.isRecording = false;
                    return;
                }

                try {
                    // Send PCM16 buffer directly to server
                    this.ws.send(event.data);
                    this.chunkCount++;
                } catch (error) {
                    console.error('[AudioRecorder] Failed to send audio chunk:', error);
                    this.isRecording = false;
                }
            };

            // Connect graph
            this.sourceNode.connect(this.workletNode);
            this.workletNode.connect(this.audioContext.destination);

            this.isRecording = true;
            this.chunkCount = 0;
            console.log('[AudioRecorder] Recording started at 16kHz (AudioWorklet)');

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Failed to start recording';
            this.onError?.(errorMsg);
            throw error;
        }
    }

    stop(): void {
        console.log(`🎤 Stopping recording (${this.chunkCount} chunks sent)...`);

        this.isRecording = false;

        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
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
