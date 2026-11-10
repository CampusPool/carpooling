import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'CampusPool · Campus carpooling', description: 'CampusPool student carpooling and database course demonstration' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
