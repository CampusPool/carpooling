import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Mobility · Campus commute', description: 'Campus commute matching demo' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
