import AdminConsole from '../../components/AdminConsole';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Admin Control Center · CampusPool', description: 'Private CampusPool administrator workspace and DBMS evidence' };
export default function AdminPage() { return <AdminConsole />; }
