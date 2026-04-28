export async function checkAccess(phone: string) {
  const res = await fetch("/api/check-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  return res.json();
}

export async function registerUser(name: string, phone: string) {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, phone }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "register failed");
  }

  return data;
}
