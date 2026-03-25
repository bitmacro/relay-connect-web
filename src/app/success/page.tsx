"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { igWarn } from "@/lib/igLog";

const STORAGE_PUBKEY = "relay_connect_display_pubkey";

export default function SuccessPage() {
  const [pubkey, setPubkey] = useState<string | null>(null);

  useEffect(() => {
    const p = sessionStorage.getItem(STORAGE_PUBKEY);
    startTransition(() => setPubkey(p));
    if (!p) igWarn("[success] sessionStorage missing relay_connect_display_pubkey");
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
          <Check className="h-6 w-6 stroke-[2.5] text-emerald-500" aria-hidden />
        </div>
        <h1 className="text-lg font-medium tracking-tight text-zinc-100">
          Connected successfully
        </h1>
        <p className="max-w-xs text-[13px] leading-relaxed text-zinc-500">
          App (client) public key for this NIP-46 session.
        </p>
      </div>
      {pubkey ? (
        <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
            Pubkey
          </p>
          <p className="break-all font-mono text-[12px] leading-relaxed text-zinc-300">
            {pubkey}
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-zinc-500">Could not read pubkey from session.</p>
      )}
      <Link
        href="/"
        className="text-[13px] text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-400"
      >
        Back
      </Link>
    </main>
  );
}
