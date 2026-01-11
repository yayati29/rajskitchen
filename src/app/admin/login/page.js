"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Paper,
  Stack,
} from "@mui/material";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: null, message: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: null, message: "" });

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody?.error || "Login failed");
      }

      setStatus({ type: "success", message: "Login successful" });
      router.push("/admin");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      sx={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}
    >
      <Paper elevation={6} sx={{ p: 4, width: "100%", maxWidth: 420 }}>
        <Stack spacing={3}>
          <Box textAlign="center">
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Admin Login
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enter the credentials provided in your environment variables.
            </Typography>
          </Box>

          {status.type && (
            <Alert severity={status.type}>{status.message}</Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              <TextField
                type="email"
                label="Admin Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                fullWidth
              />

              <TextField
                type="password"
                label="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                fullWidth
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
              >
                {submitting ? "Signing in..." : "Sign In"}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Box>
  );
}
