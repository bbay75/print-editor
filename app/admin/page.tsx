"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  name: string;
  phone: string;
  used_count: number;
  credit_limit: number;
  is_unlimited: boolean;
};
type Analytics = {
  totalUsers: number;
  totalUsed: number;
  totalCredits: number;
  unlimitedUsers: number;
  limitedUsers: number;
  usagePercent: number;
};

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();
  const logout = () => {
    localStorage.removeItem("admin_auth");
    router.push("/admin-login");
  };
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [search, setSearch] = useState("");
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const [highlightUserId, setHighlightUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [accessLimit, setAccessLimit] = useState<number | null>(null);
  const [accessUsed, setAccessUsed] = useState<number | null>(null);
  const playSound = () => {
    const audio = new Audio("/sound.mp3");
    audio.play().catch(() => {});
  };

  const fetchUsers = async () => {
    setLoading(true);

    const res = await fetch(`/api/admin/users?search=${search}&page=${page}`);
    const data = await res.json();

    setUsers(data.users);
    setTotal(data.total);

    setLoading(false);
  };
  const fetchAnalytics = async () => {
    const res = await fetch("/api/admin/analytics");
    const data = await res.json();
    setAnalytics(data);
  };

  useEffect(() => {
    const ordersChannel = supabase
      .channel("admin-orders-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log("ORDERS REALTIME:", payload);

          if (payload.eventType === "INSERT") {
            const newOrder = payload.new as any;

            playSound();
            toast.success("🔔 Шинэ захиалга орлоо!");

            setNewId(String(newOrder.id));

            setTimeout(() => {
              setNewId(null);
            }, 3000);
          }

          fetchOrders();
        },
      )
      .subscribe((status) => {
        console.log("ORDERS STATUS:", status);
      });

    const usersChannel = supabase
      .channel("admin-users-channel")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
        },
        (payload) => {
          console.log("USERS REALTIME:", payload);

          const updatedUser = payload.new as any;

          playSound();
          toast.success("AI эрх шинэчлэгдлээ");

          if (updatedUser?.id) {
            setHighlightUserId(String(updatedUser.id));

            setTimeout(() => {
              setHighlightUserId(null);
            }, 5000);
          }

          fetchUsers();
          fetchAnalytics();
        },
      )
      .subscribe((status) => {
        console.log("USERS STATUS:", status);
      });

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(usersChannel);
    };
  }, []);
  useEffect(() => {
    const isLogged = localStorage.getItem("admin_auth");

    if (isLogged === "true") {
      setAuthorized(true);
    } else {
      router.push("/admin-login");
    }
  }, []);
  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    fetchOrders();
  }, [orderSearch, orderPage]);

  useEffect(() => {
    setOrderPage(1);
  }, [orderSearch]);
  useEffect(() => {
    fetchUsers();
    fetchAnalytics();
  }, [search, page]);

  const totalPages = Math.ceil(total / 10);
  const orderTotalPages = Math.max(1, Math.ceil(orderTotal / 10));

  const toggleUnlimited = async (phone: string) => {
    await fetch("/api/admin/toggle-unlimited", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    fetchUsers();
    fetchAnalytics();
  };
  const resetCredit = async (phone: string) => {
    await fetch("/api/admin/reset-credit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone }),
    });

    await fetchUsers();
    fetchAnalytics();
  };

  const deleteUser = async (phone: string) => {
    if (!confirm("Энэ хэрэглэгчийг устгах уу?")) return;

    await fetch("/api/admin/delete-user", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    fetchUsers();
    fetchAnalytics();
  };
  const updateCredit = async (phone: string, amount: number) => {
    playSound();
    toast.success("AI эрх шинэчлэгдлээ");

    const targetUser = users.find((u) => u.phone === phone);
    if (targetUser) {
      setHighlightUserId(String(targetUser.id));
      setTimeout(() => setHighlightUserId(null), 5000);
    }

    await fetch("/api/admin/update-credit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, amount }),
    });

    fetchUsers();
    fetchAnalytics();
  };
  const fetchOrders = async () => {
    const res = await fetch(
      `/api/admin/orders?search=${orderSearch}&page=${orderPage}`,
    );
    const data = await res.json();

    setOrders(data.orders || []);
    if (data.orders?.length > 0) {
      setLastOrderId(data.orders[0].id);
    }
    setOrderTotal(data.total || 0);
  };
  const updateOrderStatus = async (id: string, status: string) => {
    await fetch("/api/admin/update-order-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, status }),
    });

    fetchOrders();
  };
  const deleteOrder = async (id: string) => {
    if (!confirm("Энэ захиалгыг устгах уу?")) return;

    await fetch("/api/admin/delete-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    toast.success("Захиалга устгагдлаа");
    fetchOrders();
  };
  if (!authorized) return null;
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Админ самбар</h1>
            <p className="text-sm text-slate-500">
              Хэрэглэгчийн AI эрх, ашиглалт удирдах хэсэг
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Logout
          </button>
        </div>

        {analytics && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["Нийт хэрэглэгч", analytics.totalUsers],
              ["Ашигласан", analytics.totalUsed],
              ["Нийт эрх", analytics.totalCredits],
              ["Хязгааргүй", analytics.unlimitedUsers],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {value}
                </p>
              </div>
            ))}

            <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Ашиглалт</p>
                <p className="text-sm font-bold text-slate-900">
                  {analytics.usagePercent}%
                </p>
              </div>

              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900"
                  style={{
                    width: `${Math.min(analytics.usagePercent, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Захиалгууд</h2>
              <p className="text-xs text-slate-500">
                Ирсэн хэвлэлийн захиалгууд
              </p>
            </div>
          </div>
          <input
            type="text"
            placeholder="Захиалга нэр/утсаар хайх..."
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            className="w-56 rounded-lg border px-3 py-2 text-sm"
          />
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Нэр</th>
                <th className="px-4 py-3 text-left">Утас</th>
                <th className="px-4 py-3 text-left">Огноо</th>
                <th className="px-4 py-3 text-center">Төлөв</th>
                <th className="px-4 py-3 text-right">Файл</th>
                <th className="px-4 py-3 text-right">Үйлдэл</th>
              </tr>
            </thead>

            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    Захиалга олдсонгүй
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    className={`border-t border-slate-100 transition-colors duration-300 ${
                      String(newId) === String(o.id)
                        ? "bg-green-200 animate-pulse"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {orderSearch && o.name?.includes(orderSearch) ? (
                        <>
                          {o.name.split(orderSearch)[0]}
                          <span className="rounded bg-yellow-100 px-1 text-slate-900">
                            {orderSearch}
                          </span>
                          {o.name.split(orderSearch).slice(1).join(orderSearch)}
                        </>
                      ) : (
                        o.name
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {orderSearch && o.phone?.includes(orderSearch) ? (
                        <>
                          {o.phone.split(orderSearch)[0]}
                          <span className="rounded bg-yellow-100 px-1 text-slate-900">
                            {orderSearch}
                          </span>
                          {o.phone
                            .split(orderSearch)
                            .slice(1)
                            .join(orderSearch)}
                        </>
                      ) : (
                        o.phone
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(o.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={o.status}
                        onChange={(e) =>
                          updateOrderStatus(o.id, e.target.value)
                        }
                        className="border rounded px-2 py-1 text-xs"
                      >
                        <option value="new">Шинэ</option>
                        <option value="printing">хэвлэж байна</option>
                        <option value="done">дууссан</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.file_url ? (
                        <a
                          href={o.file_url}
                          target="_blank"
                          className="font-semibold text-blue-600 underline"
                        >
                          Зураг харах
                        </a>
                      ) : (
                        <span className="text-slate-400">Файлгүй</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteOrder(o.id)}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Устгах
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex justify-center gap-2 p-4">
            <button
              onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
              className="rounded border px-3 py-1"
            >
              ←
            </button>

            <span>
              {orderPage} / {orderTotalPages}
            </span>

            <button
              onClick={() =>
                setOrderPage((p) => Math.min(orderTotalPages, p + 1))
              }
              className="rounded border px-3 py-1"
            >
              →
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex justify-between mb-4">
            <input
              type="text"
              placeholder="Нэр эсвэл утас хайх..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border px-3 py-2 rounded-lg text-sm w-60"
            />
          </div>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3">Нэр</th>
                <th className="px-4 py-3 text-left">Утас</th>
                <th className="px-4 py-3 text-center">Ашигласан</th>
                <th className="px-4 py-3 text-center">Үлдсэн эрх</th>
                <th className="px-4 py-3 text-center">Хязгааргүй</th>
                <th className="px-4 py-3 text-right">Үйлдэл</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400">
                    Уншиж байна...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400">
                    Хэрэглэгч олдсонгүй
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-t border-slate-100 transition-colors duration-300 ${
                      String(highlightUserId) === String(u.id)
                        ? "bg-yellow-200 animate-pulse"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {search && u.name?.includes(search) ? (
                        <>
                          {u.name.split(search)[0]}
                          <span className="rounded bg-yellow-100 px-1 text-slate-900">
                            {search}
                          </span>
                          {u.name.split(search).slice(1).join(search)}
                        </>
                      ) : (
                        u.name || "Нэргүй"
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {search && u.phone.includes(search) ? (
                        <>
                          {u.phone.split(search)[0]}
                          <span className="rounded bg-yellow-100 px-1 text-slate-900">
                            {search}
                          </span>
                          {u.phone.split(search).slice(1).join(search)}
                        </>
                      ) : (
                        u.phone
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">{u.used_count}</td>

                    <td className="px-4 py-3 text-center">
                      {u.is_unlimited
                        ? "∞"
                        : Math.max(
                            0,
                            (u.credit_limit ?? 0) - (u.used_count ?? 0),
                          )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {u.is_unlimited ? "✅" : "❌"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => updateCredit(u.phone, 3)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          +3
                        </button>

                        <button
                          onClick={() => updateCredit(u.phone, -3)}
                          className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          -3
                        </button>

                        <button
                          onClick={() => toggleUnlimited(u.phone)}
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Хязгааргүй
                        </button>

                        <button
                          onClick={() => resetCredit(u.phone)}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Тэглэх
                        </button>

                        <button
                          onClick={() => deleteUser(u.phone)}
                          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Устгах
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex justify-center mt-4 gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border rounded"
            >
              ←
            </button>

            <span>
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border rounded"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
