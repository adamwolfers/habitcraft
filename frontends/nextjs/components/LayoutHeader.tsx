'use client';

import { usePathname } from 'next/navigation';
import HeaderWithProfile from './HeaderWithProfile';

export default function LayoutHeader() {
  const pathname = usePathname();

  // Use landing variant for the root path, app variant for everything else
  const variant = pathname === '/' ? 'landing' : 'app';

  return <HeaderWithProfile variant={variant} />;
}
