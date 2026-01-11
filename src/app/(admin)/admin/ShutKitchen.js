"use client";

import { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import { useRouter } from 'next/navigation';

export default function ShutKitchen() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const loadStatus = async () => {
      try {
        const response = await fetch('/api/kitchen/status');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to fetch kitchen status');
        }
        if (alive && typeof payload.isOpen === 'boolean') {
          setIsOpen(payload.isOpen);
        }
      } catch (statusError) {
        console.error(statusError);
      }
    };
    loadStatus();
    return () => {
      alive = false;
    };
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/kitchen/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: !isOpen }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to update kitchen status');
      }
      setIsOpen(payload.isOpen);
      router.refresh();
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setLoading(false);
    }
  };

  const buttonLabel = isOpen ? 'Shut Kitchen' : 'Open Kitchen';

  return (
    <Button
      onClick={handleToggle}
      disabled={loading}
      title={error || buttonLabel}
      sx={{
        textTransform: 'none',
        border: '1px solid rgba(248,194,141,0.4)',
        color: '#f7f2ed',
        '&:hover': {
          borderColor: '#f8c28d',
          color: '#f8c28d',
        },
      }}
    >
      {loading ? 'Updating...' : buttonLabel}
    </Button>
  );
}
