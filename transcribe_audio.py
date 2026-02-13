
import whisper
import json
import sys

def transcribe():
    print("Loading model...", file=sys.stderr)
    model = whisper.load_model("base")
    
    audio_path = "voxanne-demo-backup/public/audio.mp3"
    print(f"Transcribing {audio_path}...", file=sys.stderr)
    
    result = model.transcribe(audio_path)
    
    # Transform to our desired format
    timeline = []
    
    # Add intro scene placeholder
    timeline.append({
        "start_time": 0.0,
        "end_time": result["segments"][0]["start"] if result["segments"] else 0,
        "type": "scene_change",
        "scene_id": "intro_avatar",
        "description": "Intro Scene",
        "vad_active": True
    })

    for segment in result["segments"]:
        timeline.append({
            "start_time": segment["start"],
            "end_time": segment["end"],
            "type": "transcript_event",
            "speaker_id": "unknown", # We'll need to manually assign speakers or infer
            "speaker_name": "Speaker",
            "text": segment["text"].strip()
        })
        
    output = {
        "meta": {
            "version": "1.0",
            "project": "Voxanne Demo - Auto Transcribed",
            "assets": {
                "audio_master": "/audio.mp3"
            }
        },
        "timeline": timeline
    }
    
    print(json.dumps(output, indent=4))

if __name__ == "__main__":
    transcribe()
