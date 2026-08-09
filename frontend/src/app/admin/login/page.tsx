import type { Metadata } from 'next';
import AdminLoginPage from '../../../views/admin-login';

export const metadata: Metadata = {
    title: 'Admin sign in',
    description: 'Secure staff access to Glockery operations.',
    robots: { index: false, follow: false },
};

export default AdminLoginPage;
