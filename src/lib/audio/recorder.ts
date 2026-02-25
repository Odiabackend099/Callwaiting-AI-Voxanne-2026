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
    private analyserNode: AnalyserNode | null = null;
    private volumePollHandle: number | null = null;
    private ws: WebSocket;
    private isRecording = false;
    private chunkCount = 0;
    private onError?: (error: string) => void;
    private onVolumeChange?: (volume: number) => void;

    constructor(websocket: WebSocket, onError?: (error: string) => void, onVolumeChange?: (volume: number) => void) {
        this.ws = websocket;
        this.onError = onError;
        this.onVolumeChange = onVolumeChange;
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

            // Parallel AnalyserNode tap for VAD volume measurement (read-only, does not affect send path)
            if (this.onVolumeChange) {
                this.analyserNode = this.audioContext.createAnalyser();
                this.analyserNode.fftSize = 512;
                this.analyserNode.smoothingTimeConstant = 0.8;
                this.sourceNode.connect(this.analyserNode);

                const frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
                const pollVolume = () => {
                    if (!this.isRecording || !this.analyserNode) {
                        this.volumePollHandle = null;
                        return;
                    }
                    this.analyserNode.getByteFrequencyData(frequencyData);
                    const sum = frequencyData.reduce((a, b) => a + b, 0);
                    const avg = sum / frequencyData.length / 255; // normalize to 0.0–1.0
                    this.onVolumeChange!(avg);
                    this.volumePollHandle = requestAnimationFrame(pollVolume);
                };
                this.volumePollHandle = requestAnimationFrame(pollVolume);
            }

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

        // Cancel volume polling RAF loop
        if (this.volumePollHandle !== null) {
            cancelAnimationFrame(this.volumePollHandle);
            this.volumePollHandle = null;
        }

        if (this.analyserNode) {
            this.analyserNode.disconnect();
            this.analyserNode = null;
        }

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
