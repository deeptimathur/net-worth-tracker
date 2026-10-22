"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { usePlaidLink } from "react-plaid-link";
import { afterReconnect, completeLink, createLinkToken } from "../actions/plaid";

type Kind = "bank" | "investments";

/** Opens Plaid Link as soon as its token is ready. */
function Launcher({ token, onSuccess, onExit }: { token: string; onSuccess: (publicToken: string, institution: string) => void; onExit: () => void }) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken, metadata) => onSuccess(publicToken ?? "", metadata.institution?.name ?? ""),
    onExit,
  });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return null;
}

export function ConnectButton({ kind, label, itemId, className }: { kind: Kind; label: string; itemId?: string; className?: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      setMessage(undefined);
      const res = await createLinkToken(kind, itemId);
      if (res.error) setMessage(res.error);
      else setToken(res.token ?? null);
    });

  const onSuccess = (publicToken: string, institution: string) => {
    setToken(null);
    start(async () => {
      if (itemId) {
        await afterReconnect(itemId);
        setMessage("Reconnected.");
      } else {
        const res = await completeLink(publicToken, kind, institution);
        if (res.error) setMessage(res.error);
        else
          setMessage(
            `Added ${res.created} account${res.created === 1 ? "" : "s"}` +
              (res.skipped.length ? `. Skipped ${res.skipped.join(", ")} (currency not supported yet).` : "."),
          );
      }
      router.refresh();
    });
  };

  return (
    <div>
      <button type="button" className={className} onClick={begin} disabled={pending}>
        {pending ? "Working…" : label}
      </button>
      {token && <Launcher token={token} onSuccess={onSuccess} onExit={() => setToken(null)} />}
      {message && <p className="small" role="status">{message}</p>}
    </div>
  );
}
