#!/usr/bin/env python3
"""
Tests for ConversationManager - Stage 6
========================================
Unit tests for core functionality:
- Semantic VAD (_looks_complete)
- Text humanizer (_humanize_text)
- State transitions
"""

import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conversation_manager import ConversationManager, ConversationState


class TestLooksComplete:
    """Test the semantic VAD _looks_complete method."""
    
    @pytest.fixture
    def manager(self):
        """Create a minimal manager for testing."""
        # Create with None for ws since we're only testing helper methods
        manager = ConversationManager(
            twilio_ws=None,
            deepgram_key="test",
            groq_key="test",
            system_prompt="test",
        )
        return manager
    
    def test_empty_string(self, manager):
        assert manager._looks_complete("") == False
    
    def test_terminal_punctuation(self, manager):
        assert manager._looks_complete("Hello there.") == True
        assert manager._looks_complete("How are you?") == True
        assert manager._looks_complete("That's great!") == True
    
    def test_common_phrases(self, manager):
        assert manager._looks_complete("hello") == True
        assert manager._looks_complete("yes") == True
        assert manager._looks_complete("no") == True
        assert manager._looks_complete("okay") == True
        assert manager._looks_complete("thanks") == True
        assert manager._looks_complete("got it") == True
    
    def test_question_patterns(self, manager):
        assert manager._looks_complete("What time is it") == True
        assert manager._looks_complete("Can you help me") == True
        assert manager._looks_complete("How does this work") == True
    
    def test_incomplete_utterances(self, manager):
        assert manager._looks_complete("I was thinking about") == False
        assert manager._looks_complete("The thing is") == False
        assert manager._looks_complete("Well") == False


class TestHumanizeText:
    """Test the text humanizer for TTS."""
    
    @pytest.fixture
    def manager(self):
        manager = ConversationManager(
            twilio_ws=None,
            deepgram_key="test",
            groq_key="test",
            system_prompt="test",
            enable_humanizer=True,
        )
        return manager
    
    def test_robotic_phrases(self, manager):
        result = manager._humanize_text("I'd be happy to help you.")
        assert "I can" in result
        assert "I'd be happy to" not in result
    
    def test_abbreviations(self, manager):
        result = manager._humanize_text("Dr. Smith is available.")
        assert "Doctor" in result
        
        result = manager._humanize_text("The appt is at 2pm.")
        assert "appointment" in result
    
    def test_number_conversion(self, manager):
        result = manager._humanize_text("We have 5 openings.")
        assert "five" in result
        
        result = manager._humanize_text("Call back in 10 minutes.")
        assert "ten" in result
    
    def test_time_formatting(self, manager):
        result = manager._humanize_text("The meeting is at 2:30.")
        assert "two thirty" in result
        
        result = manager._humanize_text("We open at 9:00.")
        assert "nine o'clock" in result
    
    def test_empty_string(self, manager):
        assert manager._humanize_text("") == ""
        assert manager._humanize_text(None) is None


class TestStateTransitions:
    """Test state machine transitions."""
    
    def test_initial_state(self):
        manager = ConversationManager(
            twilio_ws=None,
            deepgram_key="test",
            groq_key="test",
            system_prompt="test",
        )
        # Before start(), ctx is None
        assert manager.ctx is None
    
    def test_state_values(self):
        """Verify all states are defined."""
        assert ConversationState.LISTENING.value == "listening"
        assert ConversationState.USER_SPEAKING.value == "user_speaking"
        assert ConversationState.THINKING.value == "thinking"
        assert ConversationState.SPEAKING.value == "speaking"
        assert ConversationState.INTERRUPTED.value == "interrupted"


class TestSessionMetrics:
    """Test session metrics collection."""
    
    def test_get_session_metrics_no_context(self):
        manager = ConversationManager(
            twilio_ws=None,
            deepgram_key="test",
            groq_key="test",
            system_prompt="test",
        )
        # No context yet
        assert manager.get_session_metrics() is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
