
import React from 'react';
import { Composition } from 'remotion';
import { VoxanneDemo } from './Composition';
import './style.css'; // Will create this too

export const Root: React.FC = () => {
    return (
        <>
            <Composition
                id="VoxanneDemo"
                component={VoxanneDemo}
                durationInFrames={148 * 30} // ~148s based on script
                fps={30}
                width={1920}
                height={1080}
            />
        </>
    );
};
