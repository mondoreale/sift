import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/inter-tight/400.css';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './globals.css';

export const metadata: Metadata = {
    title: 'Job Search',
    description: 'Approved job listings',
    icons: {
        icon: { url: '/favicon.svg', type: 'image/svg+xml' },
    },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className="min-h-screen bg-canvas font-sans text-ink">{children}</body>
        </html>
    );
}
