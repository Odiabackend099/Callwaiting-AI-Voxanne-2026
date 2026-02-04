#!/bin/bash

# Simple voiceover generation script using curl and ElevenLabs API
# This bypasses the TypeScript dependencies

API_KEY="sk_d82a6528a55b45e25112c107fcbecf0bcafd70f9c325a09e"
VOICE_ID="21m00Tcm4TlvDq8ikWAM"  # Rachel voice
MODEL_ID="eleven_turbo_v2_5"
OUTPUT_DIR="public/audio/voiceovers"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎙️  Generating voiceovers for all scenes...${NC}\n"

# Scene 0A
echo -e "${YELLOW}[1/13] Generating scene-0a...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your clinic missed 47 calls last week. That'\''s $18,800 in lost revenue. What if AI answered every single one?",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-0a.mp3"
echo -e "${GREEN}✅ scene-0a.mp3 created${NC}\n"

# Scene 0B
echo -e "${YELLOW}[2/13] Generating scene-0b...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Meet Voxanne AI. The voice receptionist that never sleeps, never misses a call, and books appointments automatically.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-0b.mp3"
echo -e "${GREEN}✅ scene-0b.mp3 created${NC}\n"

# Scene 2
echo -e "${YELLOW}[3/13] Generating scene-2...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is your AI command center. On the left, you see today'\''s call volume. The center panel shows your hottest leads with scores. And on the right, appointments booked automatically by your AI. All updating in real-time.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-2.mp3"
echo -e "${GREEN}✅ scene-2.mp3 created${NC}\n"

# Scene 3
echo -e "${YELLOW}[4/13] Generating scene-3...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I'\''ll click the system prompt field to configure how your AI greets callers. Watch as I type: '\''You are a friendly receptionist for Valley Dermatology. Help callers schedule appointments.'\'' The AI learns this instruction instantly. See the success indicator? Your agent is now configured and ready to answer calls.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-3.mp3"
echo -e "${GREEN}✅ scene-3.mp3 created${NC}\n"

# Scene 4
echo -e "${YELLOW}[5/13] Generating scene-4...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Now I'\''ll click the upload area to add knowledge. I'\''m selecting our services and pricing PDF. Watch the progress bar fill as it uploads... Perfect. The checkmark confirms the file is uploaded. Your AI now knows all your services and prices.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-4.mp3"
echo -e "${GREEN}✅ scene-4.mp3 created${NC}\n"

# Scene 5
echo -e "${YELLOW}[6/13] Generating scene-5...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Now for telephony setup. I'\''m completing the connection wizard with your provider details. The system generates a unique forwarding code—here it is: star 72, plus your AI number. Simply dial this code from your office phone, and all incoming calls route to your AI agent.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-5.mp3"
echo -e "${GREEN}✅ scene-5.mp3 created${NC}\n"

# Scene 6
echo -e "${YELLOW}[7/13] Generating scene-6...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Once you dial the forwarding code, every incoming call routes directly to your AI agent. You can see the code displayed here for easy reference. This one-time setup takes 30 seconds, and your AI starts answering calls immediately.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-6.mp3"
echo -e "${GREEN}✅ scene-6.mp3 created${NC}\n"

# Scene 7
echo -e "${YELLOW}[8/13] Generating scene-7...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Let me click Start Call to test this live. Watch the conversation. The patient says: '\''I'\''d like to schedule a Botox consultation.'\'' Our AI instantly responds: '\''I'\''d love to help! We have openings Tuesday at 2 PM or Wednesday at 10 AM.'\'' Patient chooses Tuesday. And just like that—appointment booked. No human intervention needed.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-7.mp3"
echo -e "${GREEN}✅ scene-7.mp3 created${NC}\n"

# Scene 8
echo -e "${YELLOW}[9/13] Generating scene-8...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Now for a real phone test. I'\''ll enter my number and click '\''Call Me.'\'' Watch... the call comes in immediately. You can see the live timer counting up. And here'\''s the real-time transcript showing everything the AI is saying. It'\''s asking the patient about their scheduling needs... and watch... it books a follow-up appointment for Wednesday at 3 PM. All automated.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-8.mp3"
echo -e "${GREEN}✅ scene-8.mp3 created${NC}\n"

# Scene 9
echo -e "${YELLOW}[10/13] Generating scene-9...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Every call gets logged automatically. You can see the AI sentiment score here—whether the caller was satisfied or upset. Click '\''View Transcript'\'' to read the entire conversation. Call duration shows how long each interaction took. All this data helps you understand what'\''s working.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-9.mp3"
echo -e "${GREEN}✅ scene-9.mp3 created${NC}\n"

# Scene 10
echo -e "${YELLOW}[11/13] Generating scene-10...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The AI automatically scores every lead. Here'\''s Sarah with a score of 85—marked HOT, meaning she'\''s ready for immediate callback. Michael scores 78, also hot. Emily scores 72, so she'\''s marked WARM—follow up in a few days. One click on any name calls them back instantly.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-10.mp3"
echo -e "${GREEN}✅ scene-10.mp3 created${NC}\n"

# Scene 11
echo -e "${YELLOW}[12/13] Generating scene-11...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Here'\''s the results dashboard. Three appointments booked this week—entirely by AI. These are calls that came in after hours or when your team was busy. Without the AI, these would have been missed calls. Instead, they'\''re confirmed appointments adding to your schedule automatically.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-11.mp3"
echo -e "${GREEN}✅ scene-11.mp3 created${NC}\n"

# Scene 12
echo -e "${YELLOW}[13/13] Generating scene-12...${NC}"
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}" \
  -H "xi-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Start your free 14-day trial. No credit card. No setup fees. Visit voxanne.ai to never miss a patient again.",
    "model_id": "'"${MODEL_ID}"'",
    "voice_settings": {
      "stability": 0.75,
      "similarity_boost": 0.75
    }
  }' \
  --output "${OUTPUT_DIR}/scene-12.mp3"
echo -e "${GREEN}✅ scene-12.mp3 created${NC}\n"

echo -e "${GREEN}🎉 All 13 voiceovers generated successfully!${NC}"
echo -e "\nVerify files:"
ls -lh "${OUTPUT_DIR}/"
