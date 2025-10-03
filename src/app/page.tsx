'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
  IconButton,
} from '@mui/material';
import { AccountCircle, Settings, ExitToApp } from '@mui/icons-material';
import { signOut } from 'next-auth/react';
import TimelineInterface from '@/components/TimelineInterface';
import Footer from '@/components/Footer';
import dynamic from 'next/dynamic';

// Create a client-only wrapper for the authenticated content
function AuthenticatedContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    // Only redirect after session is resolved
    if (status !== 'loading' && !session) {
      router.push('/auth/signin');
      return;
    }

    // Initialize default admin user on first load when session is available
    if (session && status !== 'loading') {
      fetch('/api/init', { method: 'POST' });
    }
  }, [session, status, router]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/auth/signin' });
  };

  const handleAdminPanel = () => {
    router.push('/admin');
    handleMenuClose();
  };

  // Show loading during session loading or if no session
  if (status === 'loading' || !session) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            <img
              src="/logo.png"
              alt="Timeliner Logo"
              style={{ height: '56px', width: 'auto' }}
            />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Timeliner
            </Typography>
          </Box>
          <IconButton color="inherit" onClick={handleMenuOpen}>
            <AccountCircle />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem disabled>
              <Typography variant="body2">
                {session.user.username} ({session.user.role})
              </Typography>
            </MenuItem>
            {session.user.role === 'admin' && (
              <MenuItem onClick={handleAdminPanel}>
                <Settings sx={{ mr: 1 }} />
                Admin Panel
              </MenuItem>
            )}
            <MenuItem onClick={handleSignOut}>
              <ExitToApp sx={{ mr: 1 }} />
              Sign Out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'hidden', mb: '20px' }}>
        <TimelineInterface userId={session.user.id} />
      </Box>

      <Footer />
    </Box>
  );
}

// Create a client-only version with dynamic import
const DynamicAuthenticatedContent = dynamic(() => Promise.resolve(AuthenticatedContent), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <span>Loading...</span>
    </div>
  )
});

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Return null to avoid hydration mismatch
  }

  return (
    <div suppressHydrationWarning>
      <DynamicAuthenticatedContent />
    </div>
  );
}