'use client';

import { SWRConfig } from 'swr';

export default function SWRProvider({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig
            value={{
                revalidateOnFocus: false,
                revalidateOnReconnect: false,
                revalidateIfStale: false,
                keepPreviousData: true,
                dedupingInterval: 60000,
                errorRetryCount: 2,
            }}
        >
            {children}
        </SWRConfig>
    );
}
