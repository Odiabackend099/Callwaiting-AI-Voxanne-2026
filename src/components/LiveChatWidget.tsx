"use client";

import { useEffect } from "react";

export default function LiveChatWidget() {
    useEffect(() => {
        // Intercom widget initialization
        // Replace with your actual Intercom app ID
        const APP_ID = "YOUR_INTERCOM_APP_ID";

        // @ts-ignore
        window.intercomSettings = {
            app_id: APP_ID,
            custom_launcher_selector: '#intercom_launcher'
        };

        // Load Intercom script
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://widget.intercom.io/widget/${APP_ID}`;
        document.body.appendChild(script);

        return () => {
            // Cleanup
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };
    }, []);

    return (
        <>
            {/* Custom launcher button */}
            <button
                id="intercom_launcher"
                className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
                aria-label="Open chat"
            >
                <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                </svg>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            </button>
        </>
    );
}
