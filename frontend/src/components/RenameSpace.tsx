import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useWorkspace } from "../Workspace";
import { ErrorBox, useToast } from "./UI";

export default function RenameSpace() {
  const { space } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const client = useQueryClient(),
    toast = useToast();
  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(
      new FormData(event.currentTarget).get("name") || "",
    ).trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/spaces/${space.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      await client.invalidateQueries({ queryKey: ["spaces"] });
      toast("Workspace renamed.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={rename}
      className="form-stack space-rename"
      aria-busy={busy}
    >
      <label>
        Workspace name
        <input
          key={space.id + space.name}
          name="name"
          defaultValue={space.name}
          required
          maxLength={80}
          disabled={busy}
        />
      </label>
      {!!error && <ErrorBox error={error} />}
      <button className="button button-secondary" disabled={busy}>
        {busy ? "Saving…" : "Rename space"}
      </button>
    </form>
  );
}
