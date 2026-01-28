export const AG_EASE = [0.16, 1, 0.3, 1]; // "Anti-Gravity" cubic-bezier
export const AG_DURATION = 0.8;

export const fadeInUp = {
    hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
    visible: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: { duration: AG_DURATION, ease: AG_EASE }
    }
};

export const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    }
};

export const scaleOnHover = {
    rest: { scale: 1 },
    hover: {
        scale: 1.02,
        transition: { duration: 0.3, ease: "easeOut" }
    }
};
