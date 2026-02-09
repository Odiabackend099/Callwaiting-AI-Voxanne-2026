export const TIMING = {
    INTRO_END: 25.1,       // 25.1s
    CALL_START: 25.1,      // 25.1s
    CALL_END: 133.5,       // 2m 13.5s (approx based on "Have a great day" end)
    OUTRO_START: 134.0,    // 2m 14s
    TOTAL_DURATION: 148.85
};

export interface TranscriptEvent {
    start: number;
    end: number;
    speaker: 'Anna' | 'Lisa (AI)';
    text: string;
}

export const TRANSCRIPT_DATA: TranscriptEvent[] = [
    // --- ACTIVE CALL (25s - 133s) ---
    {
        start: 25.1,
        end: 31.7,
        speaker: 'Lisa (AI)',
        text: "Thank you for choosing Lone Tree Aesthetics. This is Lisa. Who do I have the pleasure of speaking with?"
    },
    {
        start: 31.7,
        end: 38.9,
        speaker: 'Anna',
        text: "Hi Lisa, this is Anna calling. May I book an appointment with you today for Botox please?"
    },
    {
        start: 38.9,
        end: 46.4,
        speaker: 'Lisa (AI)',
        text: "Hi Anna, I'd be happy to help you with that. When are you looking to book your Botox appointment, and what time of day works best for you?"
    },
    {
        start: 46.4,
        end: 50.6,
        speaker: 'Anna',
        text: "Wait, do you have any specials going on for this month?"
    },
    {
        start: 50.6,
        end: 60.9,
        speaker: 'Lisa (AI)',
        text: "Yes, we do have some exciting specials this month. Here are a couple of them: Buy one syringe of Juvéderm Ultra XC and get 20 units of Botox."
    },
    {
        start: 60.9,
        end: 63.3,
        speaker: 'Lisa (AI)',
        text: "Botox is $13.50 for you."
    },
    {
        start: 63.3,
        end: 69.0,
        speaker: 'Anna',
        text: "Well, how do I know... how do I know your before-and-after photos aren't just good lighting and editing?"
    },
    {
        start: 69.0,
        end: 76.0,
        speaker: 'Lisa (AI)',
        text: "That's a great question, Anna. At Lone Tree Aesthetics, we pride ourselves on transparency and real results."
    },
    {
        start: 76.0,
        end: 83.5,
        speaker: 'Lisa (AI)',
        text: "Our before-and-after photos are taken under consistent lighting and angles to ensure they accurately reflect the outcomes of our treatments."
    },
    {
        start: 83.5,
        end: 88.5,
        speaker: 'Lisa (AI)',
        text: "We also encourage clients to come in for a free consultation to discuss their goals and expectations."
    },
    {
        start: 88.5,
        end: 92.5,
        speaker: 'Anna',
        text: "Wait, do you guys do payment plans?"
    },
    {
        start: 92.5,
        end: 100.8,
        speaker: 'Lisa (AI)',
        text: "Yes, we do offer payment plans through Cherry Financing. It allows you to split your payments into smaller, manageable amounts."
    },
    {
        start: 100.8,
        end: 106.1,
        speaker: 'Lisa (AI)',
        text: "If you're interested, I can provide more details or help you explore this option during your consultation."
    },
    {
        start: 106.1,
        end: 108.6,
        speaker: 'Lisa (AI)',
        text: "Would you like to proceed with booking your Botox appointment?"
    },
    {
        start: 108.6,
        end: 112.7,
        speaker: 'Anna',
        text: "Oh, that's wonderful! Yes, yes please, I would like to book that appointment. Thank you."
    },
    {
        start: 112.7,
        end: 119.7,
        speaker: 'Lisa (AI)',
        text: "You're very welcome, Anna. When are you looking to book your Botox appointment and what have you in mind?"
    },
    {
        start: 119.7,
        end: 125.7,
        speaker: 'Anna',
        text: "I need a couple of minutes here. I'll give you a call back. I'm so sorry, I just need to go right now."
    },
    {
        start: 125.7,
        end: 133.5,
        speaker: 'Lisa (AI)',
        text: "No problem at all, Anna. Feel free to call back whenever you're ready. I'll be here to assist you. Have a great day!"
    }
];
