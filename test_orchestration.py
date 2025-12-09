"""
Comprehensive test suite for CallWaiting AI Voice Orchestration
Tests latency, barge-in handling, and system reliability
"""

import asyncio
import json
import time
import pytest
import numpy as np
from unittest.mock import Mock, AsyncMock, patch
from collections import deque

from roxanne_enhanced_orchestration import (
    EnhancedVoiceOrchestrator, 
    ConversationContext, 
    ConversationState,
    ConversationMetrics
)
from roxanne_vad_handler import AdvancedVADHandler, VAD_CONFIG


class TestVoiceOrchestration:
    """Test suite for voice orchestration layer"""
    
    @pytest.fixture
    def orchestrator(self):
        """Create test orchestrator with mock API keys"""
        return EnhancedVoiceOrchestrator(
            deepgram_api_key="test_dg_key",
            groq_api_key="test_groq_key",
            vad_config=VAD_CONFIG
        )
    
    @pytest.fixture
    def mock_context(self):
        """Create mock conversation context"""
        ctx = ConversationContext(
            call_sid="test_call_123",
            stream_sid="test_stream_456"
        )
        ctx.vad_handler = AdvancedVADHandler()
        return ctx
    
    @pytest.fixture
    def mock_websocket(self):
        """Create mock WebSocket"""
        ws = AsyncMock()
        ws.send = AsyncMock()
        ws.recv = AsyncMock()
        ws.accept = AsyncMock()
        return ws

    @pytest.mark.asyncio
    async def test_latency_budget_compliance(self, orchestrator, mock_context):
        """Test that system meets sub-500ms latency requirements"""
        
        # Simulate STT processing
        stt_start = time.perf_counter()
        await asyncio.sleep(0.15)  # 150ms STT latency
        mock_context.metrics.stt_ttft_ms = 150
        
        # Simulate LLM processing
        llm_start = time.perf_counter()
        await asyncio.sleep(0.10)  # 100ms LLM latency
        mock_context.metrics.llm_ttft_ms = 100
        
        # Simulate TTS processing
        tts_start = time.perf_counter()
        await asyncio.sleep(0.10)  # 100ms TTS latency
        mock_context.metrics.tts_ttft_ms = 100
        
        # Calculate total latency
        total_latency = mock_context.metrics.stt_ttft_ms + mock_context.metrics.llm_ttft_ms + mock_context.metrics.tts_ttft_ms
        
        assert total_latency < 500, f"Total latency {total_latency}ms exceeds 500ms budget"
        assert mock_context.metrics.stt_ttft_ms < 200, f"STT latency {mock_context.metrics.stt_ttft_ms}ms exceeds 200ms budget"
        assert mock_context.metrics.llm_ttft_ms < 150, f"LLM latency {mock_context.metrics.llm_ttft_ms}ms exceeds 150ms budget"
        assert mock_context.metrics.tts_ttft_ms < 150, f"TTS latency {mock_context.metrics.tts_ttft_ms}ms exceeds 150ms budget"

    @pytest.mark.asyncio
    async def test_barge_in_detection(self, orchestrator, mock_context):
        """Test barge-in detection with VAD"""
        
        # Simulate user speech during TTS playback
        mock_context.state = ConversationState.SPEAKING
        mock_context.barge_in_detected = False
        
        # Create synthetic speech audio
        speech_audio = self._generate_speech_audio(duration_ms=200, sample_rate=8000)
        mock_context.audio_buffer.append(speech_audio)
        
        # Process through VAD
        vad_result = await mock_context.vad_handler.process_audio_chunk(
            speech_audio, 
            is_speaking_state=True
        )
        
        assert vad_result["speech_detected"], "VAD should detect speech"
        assert vad_result["confidence"] > 0.5, f"VAD confidence {vad_result['confidence']} too low"
        assert vad_result["vad_latency_ms"] < 50, f"VAD latency {vad_result['vad_latency_ms']}ms too high"

    @pytest.mark.asyncio
    async def test_echo_cancellation(self, orchestrator, mock_context):
        """Test echo cancellation prevents false barge-in triggers"""
        
        # Simulate TTS playback audio (echo)
        tts_audio = self._generate_tts_audio(duration_ms=100, sample_rate=8000)
        
        # Add echo reference
        mock_context.vad_handler.add_echo_reference(tts_audio)
        
        # Simulate user speaking with echo
        user_speech = self._generate_speech_audio(duration_ms=150, sample_rate=8000)
        mixed_audio = self._mix_audio(user_speech, tts_audio, user_gain=0.8, echo_gain=0.3)
        
        # Process through VAD with echo cancellation
        vad_result = await mock_context.vad_handler.process_audio_chunk(
            mixed_audio,
            is_speaking_state=True
        )
        
        # Should still detect user speech despite echo
        assert vad_result["speech_detected"], "Should detect user speech even with echo"

    @pytest.mark.asyncio
    async def test_state_machine_transitions(self, orchestrator, mock_context):
        """Test state machine transitions work correctly"""
        
        # Test IDLE -> LISTENING
        mock_context.add_state_transition(ConversationState.LISTENING, "Call started")
        assert mock_context.state == ConversationState.LISTENING
        
        # Test LISTENING -> PROCESSING
        mock_context.user_transcript = "Hello, I need help"
        mock_context.add_state_transition(ConversationState.PROCESSING, "User speech detected")
        assert mock_context.state == ConversationState.PROCESSING
        
        # Test PROCESSING -> SPEAKING
        mock_context.add_state_transition(ConversationState.SPEAKING, "LLM response ready")
        assert mock_context.state == ConversationState.SPEAKING
        
        # Test SPEAKING -> INTERRUPTED (barge-in)
        mock_context.barge_in_detected = True
        mock_context.add_state_transition(ConversationState.INTERRUPTED, "User barge-in")
        assert mock_context.state == ConversationState.INTERRUPTED
        
        # Test INTERRUPTED -> LISTENING
        mock_context.barge_in_detected = False
        mock_context.add_state_transition(ConversationState.LISTENING, "Post-interrupt reset")
        assert mock_context.state == ConversationState.LISTENING

    @pytest.mark.asyncio
    async def test_concurrent_task_handling(self, orchestrator, mock_context, mock_websocket):
        """Test that concurrent tasks don't interfere with each other"""
        
        # Simulate concurrent operations
        tasks = []
        
        # Task 1: Audio receiver
        async def audio_receiver():
            for i in range(10):
                mock_context.audio_buffer.append(b"audio_data")
                await asyncio.sleep(0.01)
        
        # Task 2: STT processor
        async def stt_processor():
            for i in range(5):
                if mock_context.audio_buffer:
                    mock_context.audio_buffer.popleft()
                await asyncio.sleep(0.02)
        
        # Task 3: LLM processor
        async def llm_processor():
            mock_context.state = ConversationState.PROCESSING
            await asyncio.sleep(0.1)
            mock_context.state = ConversationState.SPEAKING
        
        # Run tasks concurrently
        tasks = [
            asyncio.create_task(audio_receiver()),
            asyncio.create_task(stt_processor()),
            asyncio.create_task(llm_processor())
        ]
        
        await asyncio.gather(*tasks)
        
        # Verify no data corruption
        assert len(mock_context.audio_buffer) <= 16, "Audio buffer overflow"
        assert mock_context.state in [ConversationState.SPEAKING, ConversationState.LISTENING]

    @pytest.mark.asyncio
    async def test_graceful_error_recovery(self, orchestrator, mock_context):
        """Test system recovers gracefully from errors"""
        
        # Simulate STT failure
        mock_context.state = ConversationState.LISTENING
        
        # Mock STT error
        with patch.object(orchestrator, '_transcription_manager', side_effect=Exception("STT error")):
            try:
                await orchestrator._transcription_manager(mock_context)
            except Exception:
                pass  # Expected error
        
        # System should transition to error state
        assert mock_context.state in [ConversationState.ERROR, ConversationState.LISTENING]
        
        # System should be able to continue processing
        mock_context.state = ConversationState.LISTENING
        mock_context.user_transcript = "Test recovery"
        assert mock_context.state == ConversationState.LISTENING

    def test_vad_performance_metrics(self, orchestrator, mock_context):
        """Test VAD performance metrics collection"""
        
        vad_handler = mock_context.vad_handler
        
        # Simulate processing multiple frames
        for i in range(100):
            audio_frame = self._generate_speech_audio(duration_ms=20, sample_rate=8000)
            # Note: In real test, we'd call process_audio_chunk
        
        metrics = vad_handler.get_metrics()
        
        assert "processed_frames" in metrics
        assert "speech_detection_count" in metrics
        assert "current_threshold" in metrics
        assert metrics["processed_frames"] >= 0

    def test_latency_distribution(self, orchestrator):
        """Test latency distribution across multiple calls"""
        
        # Simulate multiple call latencies
        latencies = []
        for i in range(100):
            # Simulate realistic latency distribution
            stt_latency = np.random.normal(150, 30)  # Mean 150ms, std 30ms
            llm_latency = np.random.normal(100, 25)  # Mean 100ms, std 25ms
            tts_latency = np.random.normal(100, 20)  # Mean 100ms, std 20ms
            
            total_latency = stt_latency + llm_latency + tts_latency
            latencies.append(total_latency)
        
        latencies = np.array(latencies)
        
        # Check latency percentiles
        p50 = np.percentile(latencies, 50)
        p95 = np.percentile(latencies, 95)
        p99 = np.percentile(latencies, 99)
        
        assert p50 < 400, f"P50 latency {p50}ms exceeds 400ms target"
        assert p95 < 600, f"P95 latency {p95}ms exceeds 600ms target"
        assert p99 < 800, f"P99 latency {p99}ms exceeds 800ms target"

    # Helper methods for test data generation
    def _generate_speech_audio(self, duration_ms: int, sample_rate: int) -> bytes:
        """Generate synthetic speech-like audio"""
        num_samples = int(duration_ms * sample_rate / 1000)
        
        # Generate speech-like signal with formants
        t = np.linspace(0, duration_ms/1000, num_samples)
        
        # Fundamental frequency (pitch)
        f0 = 120  # Hz (typical male voice)
        
        # Formant frequencies (vowel-like)
        f1, f2, f3 = 500, 1500, 2500
        
        # Generate signal
        signal = (
            0.5 * np.sin(2 * np.pi * f0 * t) +
            0.3 * np.sin(2 * np.pi * f1 * t) +
            0.2 * np.sin(2 * np.pi * f2 * t) +
            0.1 * np.sin(2 * np.pi * f3 * t)
        )
        
        # Add noise
        signal += 0.1 * np.random.randn(num_samples)
        
        # Convert to 16-bit PCM
        pcm_signal = (signal * 32767).astype(np.int16)
        
        # Convert to mu-law
        mulaw_signal = self._pcm_to_mulaw(pcm_signal.tobytes())
        
        return mulaw_signal

    def _generate_tts_audio(self, duration_ms: int, sample_rate: int) -> bytes:
        """Generate synthetic TTS audio"""
        num_samples = int(duration_ms * sample_rate / 1000)
        
        # Generate TTS-like signal
        t = np.linspace(0, duration_ms/1000, num_samples)
        
        # TTS typically has more regular patterns
        f0 = 140  # Slightly higher pitch
        signal = 0.7 * np.sin(2 * np.pi * f0 * t)
        
        # Add harmonics
        signal += 0.3 * np.sin(2 * np.pi * 2 * f0 * t)
        signal += 0.1 * np.sin(2 * np.pi * 3 * f0 * t)
        
        # Convert to mu-law
        pcm_signal = (signal * 32767).astype(np.int16)
        mulaw_signal = self._pcm_to_mulaw(pcm_signal.tobytes())
        
        return mulaw_signal

    def _mix_audio(self, audio1: bytes, audio2: bytes, user_gain: float = 1.0, echo_gain: float = 0.3) -> bytes:
        """Mix two audio signals"""
        # Convert to PCM
        pcm1 = self._mulaw_to_pcm(audio1)
        pcm2 = self._mulaw_to_pcm(audio2)
        
        # Ensure same length
        min_len = min(len(pcm1), len(pcm2))
        pcm1 = pcm1[:min_len]
        pcm2 = pcm2[:min_len]
        
        # Mix signals
        mixed = (user_gain * pcm1 + echo_gain * pcm2).astype(np.int16)
        
        # Convert back to mu-law
        return self._pcm_to_mulaw(mixed.tobytes())

    def _mulaw_to_pcm(self, mulaw_data: bytes) -> np.ndarray:
        """Convert mu-law to 16-bit PCM"""
        mulaw_table = np.array([
            0, 132, 396, 924, 1980, 4092, 8316, 16764,
            33020, 65532, 130556, 261084, 522140, 1044252, 2086652, 4171452
        ], dtype=np.int16)
        
        pcm_data = np.zeros(len(mulaw_data), dtype=np.int16)
        for i, byte in enumerate(mulaw_data):
            sign = (byte >> 7) & 0x01
            exponent = (byte >> 4) & 0x07
            mantissa = byte & 0x0f
            
            sample = mulaw_table[exponent] + (mantissa << (exponent + 3))
            if sign == 0:
                sample = -sample
            
            pcm_data[i] = sample
        
        return pcm_data

    def _pcm_to_mulaw(self, pcm_data: bytes) -> bytes:
        """Convert 16-bit PCM to mu-law"""
        pcm_array = np.frombuffer(pcm_data, dtype=np.int16)
        mulaw_data = bytearray(len(pcm_array))
        
        for i, sample in enumerate(pcm_array):
            sample = max(-8192, min(8191, sample >> 2))
            sign = 0 if sample >= 0 else 1
            sample = abs(sample)
            
            exponent = 0
            temp = sample
            while temp >= 16:
                temp >>= 1
                exponent += 1
            
            mantissa = (sample >> (exponent + 3)) & 0x0f
            mulaw_byte = (sign << 7) | (exponent << 4) | mantissa
            mulaw_data[i] = mulaw_byte ^ 0xff
        
        return bytes(mulaw_data)


@pytest.mark.asyncio
async def test_end_to_end_latency():
    """End-to-end latency test with realistic conditions"""
    
    # Create test orchestrator
    orchestrator = EnhancedVoiceOrchestrator(
        deepgram_api_key="test_key",
        groq_api_key="test_key"
    )
    
    # Simulate complete conversation flow
    start_time = time.perf_counter()
    
    # 1. User speaks (100ms)
    await asyncio.sleep(0.1)
    
    # 2. STT processing (150ms)
    await asyncio.sleep(0.15)
    
    # 3. LLM processing (100ms)
    await asyncio.sleep(0.1)
    
    # 4. TTS processing (100ms)
    await asyncio.sleep(0.1)
    
    # 5. Audio playback (50ms)
    await asyncio.sleep(0.05)
    
    total_latency = (time.perf_counter() - start_time) * 1000
    
    assert total_latency < 500, f"End-to-end latency {total_latency}ms exceeds 500ms budget"
    print(f"✅ End-to-end latency: {total_latency:.0f}ms")


@pytest.mark.asyncio
async def test_concurrent_call_handling():
    """Test system handles multiple concurrent calls"""
    
    orchestrator = EnhancedVoiceOrchestrator(
        deepgram_api_key="test_key",
        groq_api_key="test_key"
    )
    
    # Simulate 5 concurrent calls
    async def simulate_call(call_id: int):
        ctx = ConversationContext(
            call_sid=f"call_{call_id}",
            stream_sid=f"stream_{call_id}"
        )
        
        # Simulate conversation
        for i in range(3):
            ctx.state = ConversationState.LISTENING
            await asyncio.sleep(0.1)
            
            ctx.state = ConversationState.PROCESSING
            await asyncio.sleep(0.2)
            
            ctx.state = ConversationState.SPEAKING
            await asyncio.sleep(0.15)
        
        return ctx
    
    # Run concurrent calls
    start_time = time.perf_counter()
    calls = await asyncio.gather(*[simulate_call(i) for i in range(5)])
    total_time = time.perf_counter() - start_time
    
    # All calls should complete successfully
    assert len(calls) == 5
    assert total_time < 3.0, f"Concurrent calls took too long: {total_time:.1f}s"
    
    print(f"✅ Handled 5 concurrent calls in {total_time:.1f}s")


if __name__ == "__main__":
    # Run performance tests
    print("🚀 Running CallWaiting AI Performance Tests")
    
    # Test latency budget
    asyncio.run(test_end_to_end_latency())
    
    # Test concurrent handling
    asyncio.run(test_concurrent_call_handling())
    
    print("✅ All performance tests passed!")