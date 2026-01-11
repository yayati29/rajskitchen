import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppBar, Box, Button, Stack, Toolbar, Typography } from '@mui/material';
import Link from 'next/link';
import ShutKitchen from './ShutKitchen';
import LogoutButton from '@/app/admin/login/LogoutButton';

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get('adminAuth')?.value === '1';

  if (!isAuthenticated) {
    redirect('/admin/login');
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          bgcolor: 'rgba(12,8,5,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', py: 1.5 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Link href="/admin" style={{ textDecoration: 'none' }}>
              <Typography
                variant="h6"
                sx={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#f8c28d' }}
              >
                Dashboard
              </Typography>
            </Link>
            <Link href="/admin/edit-menu" style={{ textDecoration: 'none' }}>
              <Button
                sx={{
                  textTransform: 'none',
                  color: '#f7f2ed',
                  border: '1px solid rgba(248,194,141,0.4)',
                  '&:hover': { borderColor: '#f8c28d', color: '#f8c28d' },
                }}
              >
                Edit Menu
              </Button>
            </Link>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ShutKitchen />
            <LogoutButton />
          </Stack>
        </Toolbar>
      </AppBar>
      <Box component="main">{children}</Box>
    </Box>
  );
}
