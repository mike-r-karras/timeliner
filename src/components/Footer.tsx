'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Link,
  Divider,
  Stack,
  useTheme,
  useMediaQuery,
  IconButton,
  Collapse,
} from '@mui/material';
import { Timeline, Login, Logout, HelpOutline, Info, ExpandLess, ExpandMore } from '@mui/icons-material';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Footer() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: session } = useSession();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  // Load expanded state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('footerExpanded');
    if (savedState !== null) {
      setIsExpanded(savedState === 'true');
    }
  }, []);

  // Save expanded state to localStorage when it changes
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('footerExpanded', String(newState));
  };

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
        mt: 'auto',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Collapsed Tab */}
      {!isExpanded && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            py: 0.5,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'grey.200',
            },
            transition: 'background-color 0.2s',
          }}
          onClick={toggleExpanded}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img
              src="/logo.png"
              alt="Lucidio Logo"
              style={{ height: '24px', width: 'auto' }}
            />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                color: 'primary.main',
                fontSize: '0.875rem',
              }}
            >
              Lucidio
            </Typography>
            <IconButton size="small" sx={{ ml: 0.5 }}>
              <ExpandLess fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Expanded Footer Content */}
      <Collapse in={isExpanded}>
        <Box sx={{ py: 2 }}>
          {/* Toggle Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
            <IconButton
              size="small"
              onClick={toggleExpanded}
              sx={{
                '&:hover': {
                  bgcolor: 'grey.200',
                },
              }}
            >
              <ExpandMore fontSize="small" />
            </IconButton>
          </Box>

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
                  alt="Lucidio Logo"
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
                  Lucidio
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
                © {new Date().getFullYear()} Lucidio - Create Beautiful Annotated Timelines
              </Typography>
            </Box>
          </Container>
        </Box>
      </Collapse>
    </Box>
  );
}