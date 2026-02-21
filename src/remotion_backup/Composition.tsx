
import { AbsoluteFill, Sequence, Audio, staticFile } from 'remotion';
import { CallInterface } from './components/CallInterface';
import { TranscriptionOverlay } from './components/TranscriptionOverlay';
import scriptData from './data/script.json';

export const VoxanneDemo = () => {
    // Cast script data to expected type
    const events = (scriptData.timeline || []).map(e => ({
        ...e,
        speaker_name: e.speaker_name || "Speaker",
        text: e.text || ""
    }));

    return (
        <AbsoluteFill className="bg-white">
            <Audio src={staticFile("audio.mp3")} />

            <Sequence from={0}>
                <CallInterface isActive={true} />
            </Sequence>

            <Sequence from={0}>
                <TranscriptionOverlay events={events} />
            </Sequence>
        </AbsoluteFill>
    );
};
