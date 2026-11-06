"use client";

import { useEffect, useState, useTransition } from "react";
import type { User } from "../auth/users";
import { switchUser } from "../auth/switch-user";

export function UserSwitcher({ users, current }: { users: Pick<User, "id" | "name" | "title">[]; current: string }) {
  const [selected, setSelected] = useState(current);
  const [pending, start] = useTransition();
  useEffect(() => setSelected(current), [current]);

  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500">
      <span className="whitespace-nowrap">Signed in as</span>
      <select
        aria-label="Signed in as"
        value={selected}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          setSelected(id);
          start(() => switchUser(id));
        }}
        className="max-w-[14rem] rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 disabled:opacity-60"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} — {u.title}
          </option>
        ))}
      </select>
    </label>
  );
}
