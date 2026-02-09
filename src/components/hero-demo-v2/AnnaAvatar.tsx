import React from 'react';
import Image from 'next/image';

interface AnnaAvatarProps {
    isSpeaking: boolean;
}

export default function AnnaAvatar({ isSpeaking }: AnnaAvatarProps) {
    return (
        <div className="relative w-[400px] h-[400px] flex items-center justify-center">
            {/* VAD Ring Animation */}
            {isSpeaking && (
                <>
                    <div className="absolute inset-0 rounded-full border-4 border-teal-400 opacity-50 animate-ping"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-teal-300 opacity-70 animate-pulse"></div>
                </>
            )}

            {/* Avatar Image */}
            <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-white shadow-2xl z-10">
                <Image
                    src="/demo/anna-avatar-ai.png"
                    alt="Anna AI Receptionist"
                    width={400}
                    height={400}
                    className="object-cover w-full h-full"
                    priority
                />
            </div>

            {/* Speaking Indicator Badge (Optional) */}
            {isSpeaking && (
                <div className="absolute bottom-4 right-10 bg-teal-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg z-20 animate-bounce">
                    Speaking
                </div>
            )}
        </div>
    );
}
