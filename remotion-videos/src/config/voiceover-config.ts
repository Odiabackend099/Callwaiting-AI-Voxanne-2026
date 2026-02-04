/**
 * Voiceover Configuration for Voxanne AI Demo Video
 *
 * Each scene has a script optimized for 140-150 WPM (healthcare-appropriate pacing)
 * Total duration: ~90 seconds across 13 scenes
 */

export interface SceneVoiceover {
  sceneId: string;
  sceneName: string;
  durationSeconds: number;
  script: string;
  voiceId: string;
  modelId: string;
  wpmTarget: number;
}

// Rachel voice ID (professional, warm, healthcare-appropriate)
// Note: Replace with actual voice ID from ElevenLabs dashboard
export const RACHEL_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

// Modern Turbo model (compatible with free tier)
export const DEFAULT_MODEL_ID = 'eleven_turbo_v2_5';

/**
 * Complete voiceover scripts for all 13 scenes
 */
export const SCENE_VOICEOVERS: SceneVoiceover[] = [
  {
    sceneId: 'scene-0a',
    sceneName: 'Homepage Scroll',
    durationSeconds: 10,
    script: "Your clinic missed 47 calls last week. That's $18,800 in lost revenue. What if AI answered every single one?",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 132,
  },
  {
    sceneId: 'scene-0b',
    sceneName: 'Sign In',
    durationSeconds: 10,
    script: "Meet Voxanne AI. The voice receptionist that never sleeps, never misses a call, and books appointments automatically.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 108,
  },
  {
    sceneId: 'scene-2',
    sceneName: 'Dashboard Overview',
    durationSeconds: 6,
    script: "This is your AI command center. On the left, you see today's call volume. The center panel shows your hottest leads with scores. And on the right, appointments booked automatically by your AI. All updating in real-time.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 180,
  },
  {
    sceneId: 'scene-3',
    sceneName: 'Configure Agent',
    durationSeconds: 8,
    script: "I'll click the system prompt field to configure how your AI greets callers. Watch as I type: 'You are a friendly receptionist for Valley Dermatology. Help callers schedule appointments.' The AI learns this instruction instantly. See the success indicator? Your agent is now configured and ready to answer calls.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 200,
  },
  {
    sceneId: 'scene-4',
    sceneName: 'Upload Knowledge',
    durationSeconds: 5,
    script: "Now I'll click the upload area to add knowledge. I'm selecting our services and pricing PDF. Watch the progress bar fill as it uploads... Perfect. The checkmark confirms the file is uploaded. Your AI now knows all your services and prices.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 210,
  },
  {
    sceneId: 'scene-5',
    sceneName: 'Connect Telephony',
    durationSeconds: 7,
    script: "Now for telephony setup. I'm completing the connection wizard with your provider details. The system generates a unique forwarding code—here it is: star 72, plus your AI number. Simply dial this code from your office phone, and all incoming calls route to your AI agent.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 180,
  },
  {
    sceneId: 'scene-6',
    sceneName: 'AI Forwarding',
    durationSeconds: 8,
    script: "Once you dial the forwarding code, every incoming call routes directly to your AI agent. You can see the code displayed here for easy reference. This one-time setup takes 30 seconds, and your AI starts answering calls immediately.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 150,
  },
  {
    sceneId: 'scene-7',
    sceneName: 'Browser Test',
    durationSeconds: 8,
    script: "Let me click Start Call to test this live. Watch the conversation. The patient says: 'I'd like to schedule a Botox consultation.' Our AI instantly responds: 'I'd love to help! We have openings Tuesday at 2 PM or Wednesday at 10 AM.' Patient chooses Tuesday. And just like that—appointment booked. No human intervention needed.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 210,
  },
  {
    sceneId: 'scene-8',
    sceneName: 'Live Phone Test',
    durationSeconds: 8,
    script: "Now for a real phone test. I'll enter my number and click 'Call Me.' Watch... the call comes in immediately. You can see the live timer counting up. And here's the real-time transcript showing everything the AI is saying. It's asking the patient about their scheduling needs... and watch... it books a follow-up appointment for Wednesday at 3 PM. All automated.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 230,
  },
  {
    sceneId: 'scene-9',
    sceneName: 'Call Logs',
    durationSeconds: 6,
    script: "Every call gets logged automatically. You can see the AI sentiment score here—whether the caller was satisfied or upset. Click 'View Transcript' to read the entire conversation. Call duration shows how long each interaction took. All this data helps you understand what's working.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 170,
  },
  {
    sceneId: 'scene-10',
    sceneName: 'Hot Leads',
    durationSeconds: 6,
    script: "The AI automatically scores every lead. Here's Sarah with a score of 85—marked HOT, meaning she's ready for immediate callback. Michael scores 78, also hot. Emily scores 72, so she's marked WARM—follow up in a few days. One click on any name calls them back instantly.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 180,
  },
  {
    sceneId: 'scene-11',
    sceneName: 'Appointments Booked',
    durationSeconds: 6,
    script: "Here's the results dashboard. Three appointments booked this week—entirely by AI. These are calls that came in after hours or when your team was busy. Without the AI, these would have been missed calls. Instead, they're confirmed appointments adding to your schedule automatically.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 180,
  },
  {
    sceneId: 'scene-12',
    sceneName: 'Call to Action',
    durationSeconds: 16,
    script: "Start your free 14-day trial. No credit card. No setup fees. Visit voxanne.ai to never miss a patient again.",
    voiceId: RACHEL_VOICE_ID,
    modelId: DEFAULT_MODEL_ID,
    wpmTarget: 83,
  },
];

/**
 * Calculate total character count across all scenes
 */
export function getTotalCharacterCount(): number {
  return SCENE_VOICEOVERS.reduce((total, scene) => total + scene.script.length, 0);
}

/**
 * Calculate total duration across all scenes
 */
export function getTotalDuration(): number {
  return SCENE_VOICEOVERS.reduce((total, scene) => total + scene.durationSeconds, 0);
}

/**
 * Get voiceover config for a specific scene
 */
export function getSceneVoiceover(sceneId: string): SceneVoiceover | undefined {
  return SCENE_VOICEOVERS.find((scene) => scene.sceneId === sceneId);
}

/**
 * Validate script length against duration
 * @param wpmTarget Target words per minute
 * @param script Script text
 * @param durationSeconds Expected duration
 * @returns true if script fits within duration at target WPM
 */
export function validateScriptTiming(
  wpmTarget: number,
  script: string,
  durationSeconds: number
): boolean {
  const wordCount = script.split(' ').length;
  const estimatedSeconds = (wordCount / wpmTarget) * 60;
  const variance = Math.abs(estimatedSeconds - durationSeconds);

  // Allow 20% variance
  return variance / durationSeconds <= 0.2;
}

/**
 * Get summary statistics
 */
export function getSummaryStats() {
  const totalChars = getTotalCharacterCount();
  const totalDuration = getTotalDuration();
  const totalWords = SCENE_VOICEOVERS.reduce(
    (total, scene) => total + scene.script.split(' ').length,
    0
  );
  const avgWPM = (totalWords / totalDuration) * 60;

  return {
    sceneCount: SCENE_VOICEOVERS.length,
    totalCharacters: totalChars,
    totalWords,
    totalDurationSeconds: totalDuration,
    averageWPM: Math.round(avgWPM),
    estimatedCostUSD: (totalChars * 0.00022).toFixed(2), // $0.00022 per character
  };
}
