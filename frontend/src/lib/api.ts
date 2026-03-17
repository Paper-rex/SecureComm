const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3001/api`
    : "http://localhost:3001/api");

async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  token?: string
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Users ───────────────────────────────────────────────────

export const usersApi = {
  syncUser: (token: string, data: { email: string; displayName: string; profilePicture?: string; publicKey: string }) =>
    fetchWithAuth("/users/sync", { method: "POST", body: JSON.stringify(data) }, token),

  searchByEmail: (token: string, email: string) =>
    fetchWithAuth(`/users/search?email=${encodeURIComponent(email)}`, {}, token),

  getPublicKey: (token: string, userId: string) =>
    fetchWithAuth(`/users/${userId}/public-key`, {}, token),

  invite: (token: string, email: string) =>
    fetchWithAuth("/users/invite", { method: "POST", body: JSON.stringify({ email }) }, token),
};

// ─── Chats ───────────────────────────────────────────────────

export const chatsApi = {
  list: (token: string) =>
    fetchWithAuth("/chats", {}, token),

  create: (token: string, participantId: string) =>
    fetchWithAuth("/chats", { method: "POST", body: JSON.stringify({ participantId }) }, token),

  getMessages: (token: string, chatId: string, page = 1) =>
    fetchWithAuth(`/chats/${chatId}/messages?page=${page}`, {}, token),
};

// ─── Groups ──────────────────────────────────────────────────

export const groupsApi = {
  list: (token: string) =>
    fetchWithAuth("/groups", {}, token),

  create: (token: string, data: { name: string; description?: string; memberEmails: string[] }) =>
    fetchWithAuth("/groups", { method: "POST", body: JSON.stringify(data) }, token),

  update: (token: string, groupId: string, data: { name?: string; description?: string }) =>
    fetchWithAuth(`/groups/${groupId}`, { method: "PATCH", body: JSON.stringify(data) }, token),

  addMember: (token: string, groupId: string, email: string) =>
    fetchWithAuth(`/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ email }) }, token),

  removeMember: (token: string, groupId: string, userId: string) =>
    fetchWithAuth(`/groups/${groupId}/members/${userId}`, { method: "DELETE" }, token),

  promoteAdmin: (token: string, groupId: string, userId: string) =>
    fetchWithAuth(`/groups/${groupId}/admins`, { method: "PATCH", body: JSON.stringify({ userId, action: "promote" }) }, token),

  demoteAdmin: (token: string, groupId: string, userId: string) =>
    fetchWithAuth(`/groups/${groupId}/admins`, { method: "PATCH", body: JSON.stringify({ userId, action: "demote" }) }, token),

  getMessages: (token: string, groupId: string, page = 1) =>
    fetchWithAuth(`/groups/${groupId}/messages?page=${page}`, {}, token),
};

// ─── Files ───────────────────────────────────────────────────

export const filesApi = {
  upload: async (token: string, formData: FormData) => {
    const response = await fetch(`${API_URL}/files/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) throw new Error("Upload failed");
    return response.json();
  },

  download: async (token: string, fileKey: string) => {
    const response = await fetch(`${API_URL}/files/${fileKey}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Download failed");
    return response.arrayBuffer();
  },
};
