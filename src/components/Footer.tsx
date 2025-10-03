'use client';

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Link,
  Divider,
  Stack,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Timeline, Login, Logout, HelpOutline, Info } from '@mui/icons-material';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Footer() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: session } = useSession();
  const router = useRouter();

  const handleSignOut = () => {
    signOut({ callbackUrl: '/auth/signin' });
  };

  const handleSignIn = () => {
    router.push('/auth/signin');
  };

  const handleAbout = () => {
    // You can implement an about page or modal here
    window.open('https://github.com/anthropics/claude-code', '_blank');
  };

  const handleFAQ = () => {
    // You can implement an FAQ page or modal here
    window.open('https://docs.claude.com/claude-code', '_blank');
  };

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'grey.100',
        borderTop: 1,
        borderColor: 'divider',
        py: 2,
        mt: 'auto',
        flexShrink: 0,
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={isMobile ? 'column' : 'row'}
          justifyContent="space-between"
          alignItems={isMobile ? 'center' : 'center'}
          spacing={2}
        >
          {/* Logo Section */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <img
              src="/logo.png"
              alt="Timeliner Logo"
              style={{ height: '48px', width: 'auto' }}
            />
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 600,
                color: 'primary.main',
                fontSize: isMobile ? '1.1rem' : '1.25rem',
              }}
            >
              Timeliner
            </Typography>
          </Box>

          {/* Navigation Links */}
          <Stack
            direction={isMobile ? 'column' : 'row'}
            spacing={isMobile ? 1 : 3}
            alignItems="center"
          >
            <Link
              component="button"
              onClick={handleAbout}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                textDecoration: 'none',
                color: 'text.secondary',
                fontSize: '0.875rem',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
              }}
            >
              <Info fontSize="small" />
              About
            </Link>

            <Link
              component="button"
              onClick={handleFAQ}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                textDecoration: 'none',
                color: 'text.secondary',
                fontSize: '0.875rem',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
              }}
            >
              <HelpOutline fontSize="small" />
              FAQ
            </Link>

            {!isMobile && <Divider orientation="vertical" flexItem />}

            {session ? (
              <Link
                component="button"
                onClick={handleSignOut}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  textDecoration: 'none',
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                  '&:hover': {
                    color: 'error.main',
                    textDecoration: 'underline',
                  },
                }}
              >
                <Logout fontSize="small" />
                Sign Out
              </Link>
            ) : (
              <Link
                component="button"
                onClick={handleSignIn}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  textDecoration: 'none',
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                  '&:hover': {
                    color: 'primary.main',
                    textDecoration: 'underline',
                  },
                }}
              >
                <Login fontSize="small" />
                Sign In
              </Link>
            )}
          </Stack>
        </Stack>

        {/* Copyright */}
        <Box sx={{ mt: 1, textAlign: 'center' }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.75rem' }}
          >
            © {new Date().getFullYear()} Timeliner - Create Beautiful Annotated Timelines
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}