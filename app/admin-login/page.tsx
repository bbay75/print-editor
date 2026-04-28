"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    const res = await fetch("/api/admin-login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      localStorage.setItem("admin_auth", "true");
      router.push("/admin");
    } else {
      alert("Нууц үг буруу");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="p-6 border rounded-xl shadow">
        <h2 className="mb-4 font-bold">Admin Login</h2>
        <input
          type="password"
          placeholder="Нууц үг"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 w-full mb-3"
        />
        <button
          onClick={handleLogin}
          className="bg-black text-white px-4 py-2 w-full"
        >
          Нэвтрэх
        </button>
      </div>
    </div>
  );
}
