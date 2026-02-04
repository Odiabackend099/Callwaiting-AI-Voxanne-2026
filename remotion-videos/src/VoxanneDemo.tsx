import React from 'react';
import { Series, Audio, staticFile } from 'remotion';
import { Scene0A_HomepageScroll } from './scenes/Scene0A_HomepageScroll';
import { Scene0B_SignIn } from './scenes/Scene0B_SignIn';
import { Scene2_DashboardOverview } from './scenes/Scene2_DashboardOverview';
import { Scene3_ConfigureAgent } from './scenes/Scene3_ConfigureAgent';
import { Scene4_UploadKnowledge } from './scenes/Scene4_UploadKnowledge';
import { Scene5_ConnectTelephony } from './scenes/Scene5_ConnectTelephony';
import { Scene6_AIForwarding } from './scenes/Scene6_AIForwarding';
import { Scene7_BrowserTest } from './scenes/Scene7_BrowserTest';
import { Scene8_LivePhoneTest } from './scenes/Scene8_LivePhoneTest';
import { Scene9_CallLogs } from './scenes/Scene9_CallLogs';
import { Scene10_HotLeads } from './scenes/Scene10_HotLeads';
import { Scene11_AppointmentsBooked } from './scenes/Scene11_AppointmentsBooked';
import { Scene12_CTA } from './scenes/Scene12_CTA';

export const VoxanneDemo: React.FC = () => {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#F0F9FF' }}>
      <Series>
        {/* Scene 0A: Homepage & Scroll (0-10s = 300 frames at 30fps) */}
        <Series.Sequence durationInFrames={300}>
          <Scene0A_HomepageScroll />
        </Series.Sequence>

        {/* Scene 0B: Sign In & Auth (10-20s = 300 frames) */}
        <Series.Sequence durationInFrames={300}>
          <Scene0B_SignIn />
        </Series.Sequence>

        {/* Scene 2: Dashboard Overview (20-26s = 180 frames) */}
        {/* Note: Skipping Scene 1 (Problem Hook) to maintain better pacing */}
        <Series.Sequence durationInFrames={180}>
          <Scene2_DashboardOverview />
        </Series.Sequence>

        {/* Scene 3: Configure Agent (26-34s = 240 frames) */}
        <Series.Sequence durationInFrames={240}>
          <Scene3_ConfigureAgent />
        </Series.Sequence>

        {/* Scene 4: Upload Knowledge (34-39s = 150 frames) */}
        <Series.Sequence durationInFrames={150}>
          <Scene4_UploadKnowledge />
        </Series.Sequence>

        {/* Scene 5: Connect Telephony (39-46s = 210 frames) */}
        <Series.Sequence durationInFrames={210}>
          <Scene5_ConnectTelephony />
        </Series.Sequence>

        {/* Scene 6: AI Forwarding (46-54s = 240 frames) */}
        <Series.Sequence durationInFrames={240}>
          <Scene6_AIForwarding />
        </Series.Sequence>

        {/* Scene 7: Browser Test (54-62s = 240 frames) */}
        <Series.Sequence durationInFrames={240}>
          <Scene7_BrowserTest />
        </Series.Sequence>

        {/* Scene 8: Live Phone Test (62-70s = 240 frames) */}
        <Series.Sequence durationInFrames={240}>
          <Scene8_LivePhoneTest />
        </Series.Sequence>

        {/* Scene 9: Call Logs (70-76s = 180 frames) */}
        <Series.Sequence durationInFrames={180}>
          <Scene9_CallLogs />
        </Series.Sequence>

        {/* Scene 10: Hot Leads (76-82s = 180 frames) */}
        <Series.Sequence durationInFrames={180}>
          <Scene10_HotLeads />
        </Series.Sequence>

        {/* Scene 11: Appointments Booked (82-88s = 180 frames) */}
        <Series.Sequence durationInFrames={180}>
          <Scene11_AppointmentsBooked />
        </Series.Sequence>

        {/* Scene 12: Results & CTA (88-104s = 480 frames) */}
        {/* Note: The middle 300 frames are reserved for real phone call audio */}
        {/* which the user will add separately via video editing (iMovie/Final Cut Pro) */}
        <Series.Sequence durationInFrames={480}>
          <Scene12_CTA />
        </Series.Sequence>
      </Series>

      {/* Voiceover Audio Tracks - Professional ElevenLabs TTS */}
      {/* Volume: 0.5 = 50% = -6dB (voiceover priority) */}

      {/* Scene 0A: Homepage Scroll (0-10s, 10 sec = 300 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-0a.mp3')}
        volume={0.5}
        startFrom={0}
        durationInFrames={300}
      />

      {/* Scene 0B: Sign In (10-20s, 10 sec = 300 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-0b.mp3')}
        volume={0.5}
        startFrom={300}
        durationInFrames={300}
      />

      {/* Scene 2: Dashboard Overview (20-26s, 6 sec = 180 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-2.mp3')}
        volume={0.5}
        startFrom={600}
        durationInFrames={180}
      />

      {/* Scene 3: Configure Agent (26-34s, 8 sec = 240 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-3.mp3')}
        volume={0.5}
        startFrom={780}
        durationInFrames={240}
      />

      {/* Scene 4: Upload Knowledge (34-39s, 5 sec = 150 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-4.mp3')}
        volume={0.5}
        startFrom={1020}
        durationInFrames={150}
      />

      {/* Scene 5: Connect Telephony (39-46s, 7 sec = 210 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-5.mp3')}
        volume={0.5}
        startFrom={1170}
        durationInFrames={210}
      />

      {/* Scene 6: AI Forwarding (46-54s, 8 sec = 240 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-6.mp3')}
        volume={0.5}
        startFrom={1380}
        durationInFrames={240}
      />

      {/* Scene 7: Browser Test (54-62s, 8 sec = 240 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-7.mp3')}
        volume={0.5}
        startFrom={1620}
        durationInFrames={240}
      />

      {/* Scene 8: Live Phone Test (62-70s, 8 sec = 240 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-8.mp3')}
        volume={0.5}
        startFrom={1860}
        durationInFrames={240}
      />

      {/* Scene 9: Call Logs (70-76s, 6 sec = 180 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-9.mp3')}
        volume={0.5}
        startFrom={2100}
        durationInFrames={180}
      />

      {/* Scene 10: Hot Leads (76-82s, 6 sec = 180 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-10.mp3')}
        volume={0.5}
        startFrom={2280}
        durationInFrames={180}
      />

      {/* Scene 11: Appointments Booked (82-88s, 6 sec = 180 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-11.mp3')}
        volume={0.5}
        startFrom={2460}
        durationInFrames={180}
      />

      {/* Scene 12: Call to Action (88-104s, 16 sec = 480 frames @ 30fps) */}
      <Audio
        src={staticFile('audio/voiceovers/scene-12.mp3')}
        volume={0.5}
        startFrom={2640}
        durationInFrames={480}
      />

      {/* ===== BACKGROUND MUSIC ===== */}
      {/* Industry Standard: Subtle ambient background throughout video */}
      {/* Volume: 0.1 = 10% = -20dB (doesn't compete with voiceover) */}
      {/* NOTE: Add background-corporate.mp3 file to public/audio/music/ before rendering */}
      {/* See AUDIO_ASSETS_GUIDE.md for free download sources */}

      {/* TEMPORARILY DISABLED - uncomment when background-corporate.mp3 is added */}
      {/*
      <Audio
        src={staticFile('audio/music/background-corporate.mp3')}
        volume={0.1}
        startFrom={0}
      />
      */}

      {/* ===== SOUND EFFECTS ===== */}
      {/* Industry Standard: Subtle UI feedback for button clicks and state changes */}
      {/* NOTE: Add SFX files to public/audio/sfx/ before rendering */}
      {/* See AUDIO_ASSETS_GUIDE.md for free download sources */}

      {/* TEMPORARILY DISABLED - uncomment when SFX files are added */}
      {/*
      <Audio
        src={staticFile('audio/sfx/click.mp3')}
        volume={0.15}
        startFrom={980}
      />

      <Audio
        src={staticFile('audio/sfx/success.mp3')}
        volume={0.12}
        startFrom={990}
      />

      <Audio
        src={staticFile('audio/sfx/click.mp3')}
        volume={0.15}
        startFrom={1100}
      />

      <Audio
        src={staticFile('audio/sfx/success.mp3')}
        volume={0.12}
        startFrom={1120}
      />

      <Audio
        src={staticFile('audio/sfx/click.mp3')}
        volume={0.15}
        startFrom={1355}
      />

      <Audio
        src={staticFile('audio/sfx/success.mp3')}
        volume={0.12}
        startFrom={1360}
      />

      <Audio
        src={staticFile('audio/sfx/whoosh.mp3')}
        volume={0.10}
        startFrom={1430}
      />

      <Audio
        src={staticFile('audio/sfx/click.mp3')}
        volume={0.15}
        startFrom={1480}
      />

      <Audio
        src={staticFile('audio/sfx/whoosh.mp3')}
        volume={0.10}
        startFrom={1670}
      />

      <Audio
        src={staticFile('audio/sfx/click.mp3')}
        volume={0.15}
        startFrom={1700}
      />

      <Audio
        src={staticFile('audio/sfx/click.mp3')}
        volume={0.15}
        startFrom={1965}
      />

      <Audio
        src={staticFile('audio/sfx/phone-ring.mp3')}
        volume={0.15}
        startFrom={1970}
      />

      <Audio
        src={staticFile('audio/sfx/notification.mp3')}
        volume={0.12}
        startFrom={2330}
      />
      */}
    </div>
  );
};
