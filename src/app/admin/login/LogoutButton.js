"use client";

import { useRouter } from "next/navigation";
import { Button } from "@mui/material";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to logout");
      }
      router.push("/admin/login");
      router.refresh();
    } catch (error) {
      // Intentionally fail silently for now; could show toast/snackbar later
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      startIcon={<LogoutRoundedIcon />}
      color="inherit"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? "Logging out..." : "Logout"}
    </Button>
  );
}
