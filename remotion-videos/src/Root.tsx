import React from 'react';
import { Composition } from 'remotion';
import { VoxanneDemo } from './VoxanneDemo';
import { Scene0A_HomepageScroll } from './scenes/Scene0A_HomepageScroll';
import { Scene0B_SignIn } from './scenes/Scene0B_SignIn';
import { Scene1_ZeroToHero } from './scenes/Scene1_ZeroToHero';
import { Scene2_TheBirth } from './scenes/Scene2_TheBirth';
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
import { TestimonialVideo } from './scenes/TestimonialVideo';
import './styles.css';

export const Root: React.FC = () => {
  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          TESTIMONIAL VIDEO — "The Immersive Overlay"
          Portrait 9:16 | 02:28 | Social Proof + Technical Excellence
          ═══════════════════════════════════════════════════════════════════ */}
      <Composition
        id="VoxanneTestimonial"
        component={TestimonialVideo}
        durationInFrames={4440}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      {/* Individual Scene Compositions (for scene-by-scene rendering) */}
      <Composition
        id="Scene0A"
        component={Scene0A_HomepageScroll}
        durationInFrames={300} // 10 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene0B"
        component={Scene0B_SignIn}
        durationInFrames={300} // 10 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene1"
        component={Scene1_ZeroToHero}
        durationInFrames={300} // 10 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene2Birth"
        component={Scene2_TheBirth}
        durationInFrames={240} // 8 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene2"
        component={Scene2_DashboardOverview}
        durationInFrames={180} // 6 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene3"
        component={Scene3_ConfigureAgent}
        durationInFrames={240} // 8 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene4"
        component={Scene4_UploadKnowledge}
        durationInFrames={150} // 5 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene5"
        component={Scene5_ConnectTelephony}
        durationInFrames={210} // 7 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene6"
        component={Scene6_AIForwarding}
        durationInFrames={240} // 8 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene7"
        component={Scene7_BrowserTest}
        durationInFrames={240} // 8 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene8"
        component={Scene8_LivePhoneTest}
        durationInFrames={240} // 8 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene9"
        component={Scene9_CallLogs}
        durationInFrames={180} // 6 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene10"
        component={Scene10_HotLeads}
        durationInFrames={180} // 6 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene11"
        component={Scene11_AppointmentsBooked}
        durationInFrames={180} // 6 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="Scene12"
        component={Scene12_CTA}
        durationInFrames={480} // 16 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />

      {/* Master Composition (for final merged render - keep for reference) */}
      <Composition
        id="VoxanneDemo"
        component={VoxanneDemo}
        durationInFrames={2700} // 90 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
