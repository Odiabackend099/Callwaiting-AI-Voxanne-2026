// AudioWorklet processor for Vapi/Deepgram (16kHz PCM16)
// Prevents main-thread blocking and eliminates crackling

class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array();
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || !input.length) return true;

        const channelData = input[0]; // Mono

        // Convert Float32 to Int16 PCM immediately to save memory and bandwidth
        const pcm16 = this.float32ToInt16(channelData);

        // Send to main thread
        this.port.postMessage(pcm16.buffer, [pcm16.buffer]);

        return true;
    }

    float32ToInt16(float32Array) {
        const int16 = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16;
    }
}

registerProcessor('audio-processor', AudioProcessor);
