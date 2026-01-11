'use client';

import Link from 'next/link';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';

export default function KitchenClosedLanding() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0f0b07',
        color: '#f7f2ed',
        display: 'flex',
        alignItems: 'center',
        py: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="sm">
        <Paper
          sx={{
            p: { xs: 4, md: 5 },
            borderRadius: 4,
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(21,13,9,0.9), rgba(54,27,12,0.9))',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Stack spacing={3} alignItems="center">
            <Typography variant="overline" sx={{ letterSpacing: 2, color: 'rgba(247,242,237,0.7)' }}>
              Kitchen Status
            </Typography>
            <Typography variant="h3" sx={{ fontFamily: 'var(--font-heading)', lineHeight: 1.1 }}>
              We will be back shortly.
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(247,242,237,0.75)' }}>
              Thanks for your patience while we reset the line and restock ingredients. We will reopen ordering soon.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} width="100%">
              <Button
                component={Link}
                href="/orders/track"
                variant="outlined"
                sx={{
                  flex: 1,
                  textTransform: 'none',
                  borderColor: 'rgba(247,242,237,0.6)',
                  color: '#f7f2ed',
                  '&:hover': { borderColor: '#f8c28d', color: '#f8c28d' },
                }}
              >
                Track Orders
              </Button>
              <Button
                component={Link}
                href="/about"
                variant="contained"
                sx={{
                  flex: 1,
                  bgcolor: '#f8c28d',
                  color: '#1c130d',
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#ffe1c5' },
                }}
              >
                Learn More
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
