import Image from 'next/image';

interface AvatarViewProps {
    isPlaying: boolean;
    isTalking: boolean;
    onPlay: () => void;
}

export default function AvatarView({ isPlaying, isTalking, onPlay }: AvatarViewProps) {
    return (
        <div className="relative w-full h-full bg-gray-900">
            {/* IDLE STATE (Base Layer) */}
            <div className="absolute inset-0 w-full h-full">
                <Image
                    src="/demo/anna-idle.png"
                    alt="AI Receptionist Anna - Idle"
                    fill
                    className="object-cover"
                    priority
                />
            </div>

            {/* TALKING STATE (Overlay with animation) */}
            <div
                className={`absolute inset-0 w-full h-full transition-opacity duration-150 ${isTalking && isPlaying ? 'opacity-100' : 'opacity-0'
                    }`}
            >
                {/* 
            Since we are using the SAME image for consistency as per user request, 
            we use a CSS scale/pulse animation on the container to simulate breathing/speaking energy 
            rather than a second image that might look like a different person.
         */}
                <div className="relative w-full h-full animate-subtle-pulse">
                    <Image
                        src="/demo/anna-talking.png" // Using the same base image (copy) or specific talking version if available and matched.
                        alt="AI Receptionist Anna - Talking"
                        fill
                        className="object-cover"
                    />
                </div>
            </div>

            {/* VAD PULSE RING (Visual Flair/Indicator) */}
            {isTalking && isPlaying && (
                <div className="absolute bottom-10 right-10 w-12 h-12 bg-blue-500/50 rounded-full animate-ping pointer-events-none" />
            )}
        </div>
    );
}
