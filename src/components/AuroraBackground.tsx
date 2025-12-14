"use client";

import React from "react";
import { motion } from "framer-motion";

export const AuroraBackground = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen w-full bg-zinc-50 dark:bg-zinc-900 text-slate-950 transition-bg">
            <div className="absolute inset-0 overflow-hidden">
                <div
                    className={`
            [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)]
            [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)]
            [--aurora:repeating-linear-gradient(100deg,#06b6d4_10%,#ffffff_15%,#06b6d4_20%,#0891b2_25%,#06b6d4_30%)]
            [background-image:var(--white-gradient),var(--aurora)]
            dark:[background-image:var(--dark-gradient),var(--aurora)]
            [background-size:300%,_200%]
            [background-position:50%_50%,50%_50%]
            filter blur-[10px] invert dark:invert-0
            after:content-[""] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)] 
            after:dark:[background-image:var(--dark-gradient),var(--aurora)]
            after:[background-size:200%,_100%] 
            after:animate-aurora after:[background-attachment:fixed] after:mix-blend-difference
            pointer-events-none
            absolute -inset-[10px] opacity-50 will-change-transform
          `}
                ></div>
            </div>
            <div className="relative z-10 w-full">{children}</div>
        </div>
    );
};
