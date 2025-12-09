"""
Roxanne AI - Advanced Voice Activity Detection & Echo Cancellation
Implements Silero VAD with real-time echo cancellation for robust barge-in detection
"""

import asyncio
import numpy as np
import torch
import torchaudio
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass
import logging
from collections import deque
import time


@dataclass
class VADConfig:
    """Configuration for VAD and echo cancellation parameters"""
    sample_rate: int = 8000
    frame_duration_ms: int = 20
    vad_threshold: float = 0.5
    speech_pad_ms: int = 30
    min_speech_duration_ms: int = 100
    min_silence_duration_ms: int = 200
    echo_cancel_enabled: bool = True
    echo_cancel_taps: int = 512
    echo_cancel_mu: float = 0.001
    echo_cancel_delta: float = 0.01
    context_window_frames: int = 50  # 1 second of context
    confidence_smoothing: float = 0.8
    aggressive_mode: bool = False  # Lower thresholds for noisy environments


class EchoCanceller:
    """
    Adaptive echo cancellation using NLMS (Normalized Least Mean Squares) algorithm
    Handles Twilio audio feedback and prevents false barge-in triggers
    """
    
    def __init__(self, config: VADConfig):
        self.config = config
        self.taps = config.echo_cancel_taps
        self.mu = config.echo_cancel_mu
        self.delta = config.echo_cancel_delta
        
        # Adaptive filter weights
        self.weights = np.zeros(self.taps)
        self.reference_buffer = deque(maxlen=self.taps)
        
        # Double-talk detection
        self.dt_threshold = 0.5
        self.dt_hangover = 10  # frames
        self.dt_counter = 0
        
        self.logger = logging.getLogger(__name__)
        
    def _mulaw_to_pcm(self, audio_bytes: bytes) -> np.ndarray:
        """Convert mu-law encoded audio to 16-bit PCM"""
        audio_array = np.frombuffer(audio_bytes, dtype=np.uint8)
        
        # Mu-law decoding table
        mu = 255
        pcm = np.sign(audio_array - 128) * (mu ** (np.abs(audio_array - 128) / 128) - 1) / mu
        pcm = (pcm * 32768).astype(np.int16)
        
        return pcm
    
    def _pcm_to_mulaw(self, pcm_audio: np.ndarray) -> bytes:
        """Convert 16-bit PCM to mu-law encoded audio"""
        # Mu-law encoding
        mu = 255
        pcm_normalized = pcm_audio.astype(np.float32) / 32768.0
        
        # Apply mu-law compression
        encoded = np.sign(pcm_normalized) * np.log(1 + mu * np.abs(pcm_normalized)) / np.log(1 + mu)
        mulaw = ((encoded * 128) + 128).astype(np.uint8)
        
        return mulaw.tobytes()
    
    def process(self, audio_chunk: bytes, reference_audio: Optional[bytes] = None) -> bytes:
        """
        Process audio chunk with echo cancellation
        
        Args:
            audio_chunk: Incoming audio from user (mu-law)
            reference_audio: Reference audio (TTS output) for echo cancellation
            
        Returns:
            Cleaned audio chunk (mu-law)
        """
        if not self.config.echo_cancel_enabled or reference_audio is None:
            return audio_chunk
        
        try:
            # Convert to PCM
            input_pcm = self._mulaw_to_pcm(audio_chunk)
            ref_pcm = self._mulaw_to_pcm(reference_audio)
            
            # Ensure same length
            min_len = min(len(input_pcm), len(ref_pcm))
            input_pcm = input_pcm[:min_len]
            ref_pcm = ref_pcm[:min_len]
            
            # Update reference buffer
            for sample in ref_pcm:
                self.reference_buffer.append(sample)
            
            if len(self.reference_buffer) < self.taps:
                return audio_chunk  # Not enough data
            
            # Create reference vector
            ref_vector = np.array(list(self.reference_buffer))
            
            # Estimate echo
            echo_estimate = np.dot(ref_vector, self.weights)
            
            # Calculate error (desired - echo estimate)
            error = input_pcm - echo_estimate
            
            # Double-talk detection
            input_power = np.mean(input_pcm ** 2)
            ref_power = np.mean(ref_vector ** 2)
            
            if input_power > self.dt_threshold * ref_power:
                # Double-talk detected - freeze adaptation
                self.dt_counter = self.dt_hangover
            else:
                self.dt_counter = max(0, self.dt_counter - 1)
            
            # NLMS adaptation (only if no double-talk)
            if self.dt_counter == 0 and ref_power > 0:
                # Normalized step size
                norm_factor = ref_vector @ ref_vector + self.delta
                step_size = self.mu / norm_factor
                
                # Update weights
                self.weights += step_size * error * ref_vector
            
            # Apply echo cancellation
            cleaned_audio = error
            
            # Convert back to mu-law
            cleaned_mulaw = self._pcm_to_mulaw(cleaned_audio.astype(np.int16))
            
            return cleaned_mulaw
            
        except Exception as e:
            self.logger.error(f"Echo cancellation error: {e}")
            return audio_chunk


class AdvancedVADHandler:
    """
    Advanced Voice Activity Detection using Silero VAD model
    Provides robust speech detection with context awareness and confidence scoring
    """
    
    def __init__(self, config: Optional[VADConfig] = None, model_path: Optional[str] = None, preloaded_model=None):
        self.config = config or VADConfig()
        self.model_path = model_path
        
        # Frame size calculation
        self.frame_size = int(self.config.sample_rate * self.config.frame_duration_ms / 1000)
        
        # Silero VAD model
        self.model = preloaded_model
        self.utils = None
        
        # State tracking
        self.speech_state = "silence"  # silence, speech, possible_speech
        self.speech_start_time = 0
        self.silence_start_time = 0
        self.speech_frames = 0
        self.silence_frames = 0
        
        # Confidence smoothing
        self.confidence_history = deque(maxlen=10)
        self.smoothed_confidence = 0.0
        
        # Context window for better decisions
        self.context_window = deque(maxlen=self.config.context_window_frames)
        
        # Performance metrics
        self.processing_times = deque(maxlen=100)
        self.speech_detections = 0
        self.false_positives = 0
        
        self.logger = logging.getLogger(__name__)
        
        # Initialize model if not provided
        if not self.model:
            self._initialize_vad()
    
    def _initialize_vad(self):
        """Initialize Silero VAD model"""
        try:
            if self.model_path:
                self.model = torch.load(self.model_path)
            else:
                # Load Silero VAD model
                self.model, self.utils = torch.hub.load(
                    repo_or_dir='snakers4/silero-vad',
                    model='silero_vad',
                    force_reload=False,
                    onnx=False
                )
            
            self.model.eval()
            self.logger.info("Silero VAD model loaded successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to load Silero VAD model: {e}")
            # Fallback to energy-based VAD
            self._initialize_fallback_vad()
    
    def _initialize_fallback_vad(self):
        """Initialize fallback energy-based VAD"""
        self.logger.warning("Using fallback energy-based VAD")
        self.energy_threshold = 0.02
        self.energy_smoothing = 0.9
        self.background_energy = 0.01
    
    def _mulaw_to_pcm(self, audio_bytes: bytes) -> torch.Tensor:
        """Convert mu-law audio to PCM tensor for VAD processing"""
        # Convert bytes to numpy array
        audio_array = np.frombuffer(audio_bytes, dtype=np.uint8)
        
        # Mu-law decoding
        mu = 255
        pcm = np.sign(audio_array - 128) * (mu ** (np.abs(audio_array - 128) / 128) - 1) / mu
        pcm = (pcm * 32768).astype(np.float32) / 32768.0  # Normalize to [-1, 1]
        
        # Convert to torch tensor
        tensor = torch.from_numpy(pcm).float()
        
        # Ensure correct shape for Silero VAD
        if tensor.dim() == 1:
            tensor = tensor.unsqueeze(0)  # Add batch dimension
            
        return tensor
    
    def _get_speech_probability(self, audio_tensor: torch.Tensor) -> float:
        """Get speech probability from VAD model"""
        try:
            if self.model is not None:
                # Use Silero VAD
                with torch.no_grad():
                    speech_prob = self.model(audio_tensor, self.config.sample_rate).item()
                return speech_prob
            else:
                # Fallback energy-based VAD
                energy = torch.mean(audio_tensor ** 2).item()
                
                # Update background energy estimate
                if energy < self.background_energy * 2:
                    self.background_energy = (
                        self.energy_smoothing * self.background_energy + 
                        (1 - self.energy_smoothing) * energy
                    )
                
                # Simple threshold-based detection
                speech_prob = 1.0 if energy > self.energy_threshold else 0.0
                return speech_prob
                
        except Exception as e:
            self.logger.error(f"VAD processing error: {e}")
            return 0.0
    
    def _contextualize_speech_probability(self, speech_prob: float) -> float:
        """Apply context-aware adjustments to speech probability"""
        # Add to context window
        self.context_window.append(speech_prob)
        
        # Calculate context statistics
        if len(self.context_window) > 10:
            recent_avg = np.mean(list(self.context_window)[-10:])
            overall_avg = np.mean(self.context_window)
            
            # Boost confidence if recent speech activity is high
            if recent_avg > 0.3 and speech_prob > 0.4:
                speech_prob = min(1.0, speech_prob * 1.2)
            
            # Reduce confidence if overall average is very low (likely noise)
            if overall_avg < 0.1 and speech_prob < 0.6:
                speech_prob = max(0.0, speech_prob * 0.7)
        
        # Apply confidence smoothing
        self.confidence_history.append(speech_prob)
        self.smoothed_confidence = (
            self.config.confidence_smoothing * self.smoothed_confidence +
            (1 - self.config.confidence_smoothing) * speech_prob
        )
        
        return self.smoothed_confidence
    
    def _update_speech_state(self, speech_prob: float) -> Dict[str, any]:
        """Update speech state machine and return detection results"""
        current_time = time.time()
        
        # Apply thresholds based on current state
        if self.config.aggressive_mode:
            speech_threshold = 0.3
            silence_threshold = 0.2
        else:
            speech_threshold = self.config.vad_threshold
            silence_threshold = self.config.vad_threshold * 0.7
        
        # State machine transitions
        if self.speech_state == "silence":
            if speech_prob > speech_threshold:
                self.speech_state = "possible_speech"
                self.speech_start_time = current_time
                self.speech_frames = 1
            else:
                self.silence_frames += 1
                
        elif self.speech_state == "possible_speech":
            if speech_prob > speech_threshold:
                self.speech_frames += 1
                # Confirm speech after minimum duration
                if (current_time - self.speech_start_time) * 1000 >= self.config.min_speech_duration_ms:
                    self.speech_state = "speech"
                    self.speech_detections += 1
            else:
                # Back to silence
                self.speech_state = "silence"
                self.silence_frames += 1
                
        elif self.speech_state == "speech":
            if speech_prob < silence_threshold:
                self.speech_state = "possible_silence"
                self.silence_start_time = current_time
                self.silence_frames = 1
            else:
                self.speech_frames += 1
        
        # Handle possible silence state
        if self.speech_state == "possible_silence":
            if speech_prob < silence_threshold:
                self.silence_frames += 1
                # Confirm silence after minimum duration
                if (current_time - self.silence_start_time) * 1000 >= self.config.min_silence_duration_ms:
                    self.speech_state = "silence"
            else:
                # Back to speech
                self.speech_state = "speech"
                self.speech_frames += 1
        
        # Return detection results
        is_speech = self.speech_state in ["speech", "possible_speech"]
        
        return {
            "speech_detected": is_speech,
            "confidence": speech_prob,
            "state": self.speech_state,
            "speech_duration_ms": self.speech_frames * self.config.frame_duration_ms,
            "silence_duration_ms": self.silence_frames * self.config.frame_duration_ms
        }
    
    async def process_audio_chunk(self, audio_chunk: bytes, 
                                is_speaking_state: bool = True,
                                reference_audio: Optional[bytes] = None) -> Dict[str, any]:
        """
        Process audio chunk for voice activity detection
        
        Args:
            audio_chunk: Raw audio data (mu-law encoded)
            is_speaking_state: Whether system is currently speaking (for echo cancellation)
            reference_audio: Reference audio for echo cancellation (optional)
            
        Returns:
            Dictionary with detection results and metadata
        """
        start_time = time.time()
        
        try:
            # Apply echo cancellation if enabled and system is speaking
            if is_speaking_state and reference_audio is not None:
                # This would be integrated with the echo canceller
                # For now, we'll process the original audio
                pass
            
            # Convert audio format
            audio_tensor = self._mulaw_to_pcm(audio_chunk)
            
            # Get raw speech probability
            speech_prob = self._get_speech_probability(audio_tensor)
            
            # Apply contextual adjustments
            contextualized_prob = self._contextualize_speech_probability(speech_prob)
            
            # Update state machine
            detection_result = self._update_speech_state(contextualized_prob)
            
            # Add performance metrics
            processing_time = (time.time() - start_time) * 1000
            self.processing_times.append(processing_time)
            
            detection_result.update({
                "processing_time_ms": processing_time,
                "raw_probability": speech_prob,
                "contextualized_probability": contextualized_prob,
                "frame_size": len(audio_chunk),
                "sample_rate": self.config.sample_rate
            })
            
            return detection_result
            
        except Exception as e:
            self.logger.error(f"Audio processing error: {e}")
            return {
                "speech_detected": False,
                "confidence": 0.0,
                "state": "error",
                "error": str(e),
                "processing_time_ms": (time.time() - start_time) * 1000
            }
    
    def get_metrics(self) -> Dict[str, any]:
        """Get VAD performance metrics"""
        if self.processing_times:
            avg_processing_time = np.mean(self.processing_times)
            max_processing_time = np.max(self.processing_times)
        else:
            avg_processing_time = 0
            max_processing_time = 0
        
        return {
            "avg_processing_time_ms": avg_processing_time,
            "max_processing_time_ms": max_processing_time,
            "speech_detections": self.speech_detections,
            "false_positives": self.false_positives,
            "current_state": self.speech_state,
            "smoothed_confidence": self.smoothed_confidence,
            "context_window_size": len(self.context_window)
        }
    
    def reset(self):
        """Reset VAD state for new conversation"""
        self.speech_state = "silence"
        self.speech_start_time = 0
        self.silence_start_time = 0
        self.speech_frames = 0
        self.silence_frames = 0
        self.confidence_history.clear()
        self.context_window.clear()
        self.smoothed_confidence = 0.0
        self.processing_times.clear()
        self.speech_detections = 0
        self.false_positives = 0
        
        if hasattr(self, 'reference_buffer'):
            self.reference_buffer.clear()
        if hasattr(self, 'weights'):
            self.weights = np.zeros(self.taps)


# Integration helper for the orchestration layer
class VADIntegration:
    """Helper class to integrate VAD with the conversation orchestration"""
    
    def __init__(self, vad_handler: AdvancedVADHandler, echo_canceller: Optional[EchoCanceller] = None):
        self.vad_handler = vad_handler
        self.echo_canceller = echo_canceller or EchoCanceller(vad_handler.config)
        self.logger = logging.getLogger(__name__)
        
        # Barge-in detection state
        self.consecutive_speech_frames = 0
        self.barge_in_threshold = 3  # frames
        self.barge_in_confidence_threshold = 0.6
        
        # Reference audio buffer for echo cancellation
        self.reference_buffer = deque(maxlen=10)  # 200ms of reference audio
    
    def add_reference_audio(self, audio_chunk: bytes):
        """Add TTS output audio to reference buffer for echo cancellation"""
        self.reference_buffer.append(audio_chunk)
    
    async def detect_barge_in(self, audio_chunk: bytes, is_speaking_state: bool) -> Dict[str, any]:
        """
        Detect user barge-in during system speech
        
        Returns:
            Dictionary with barge-in detection results
        """
        # Get reference audio if available
        reference_audio = None
        if is_speaking_state and self.reference_buffer:
            reference_audio = self.reference_buffer[-1]
        
        # Process with VAD
        vad_result = await self.vad_handler.process_audio_chunk(
            audio_chunk, 
            is_speaking_state=is_speaking_state,
            reference_audio=reference_audio
        )
        
        # Barge-in detection logic
        barge_in_detected = False
        
        if vad_result["speech_detected"] and vad_result["confidence"] > self.barge_in_confidence_threshold:
            self.consecutive_speech_frames += 1
            
            if self.consecutive_speech_frames >= self.barge_in_threshold:
                barge_in_detected = True
                self.logger.info(f"🛑 Barge-in detected! Confidence: {vad_result['confidence']:.2f}")
        else:
            self.consecutive_speech_frames = max(0, self.consecutive_speech_frames - 1)
        
        return {
            "barge_in_detected": barge_in_detected,
            "vad_result": vad_result,
            "consecutive_speech_frames": self.consecutive_speech_frames,
            "reference_audio_available": reference_audio is not None
        }
    
    def reset(self):
        """Reset VAD integration state"""
        self.consecutive_speech_frames = 0
        self.reference_buffer.clear()
        self.vad_handler.reset()
        if self.echo_canceller:
            self.echo_canceller.weights = np.zeros(self.echo_canceller.taps)
            self.echo_canceller.reference_buffer.clear()