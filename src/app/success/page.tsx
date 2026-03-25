"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Copy, Check, User } from "lucide-react";
import { igWarn } from "@/lib/igLog";
import type { Nip07ProfileBundle } from "@/lib/nip07Metadata";
import { STORAGE_NIP07_PROFILE_KEY } from "@/lib/nip07Metadata";
import { hexPubkeyToNpub } from "@/lib/nostrPubFormats";

const STORAGE_PUBKEY = "relay_connect_display_pubkey";

function readBundle(): Nip07ProfileBundle | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_NIP07_PROFILE_KEY);
  if (!raw) return null;
  try {
    const b = JSON.parse(raw) as Nip07ProfileBundle;
    if (b && typeof b.pubkey === "string") return b;
  } catch {
    /* ignore */
  }
  return null;
}

function truncateNpub(npub: string, head = 16, tail = 16): string {
  if (npub.length <= head + tail + 3) return npub;
  return `${npub.slice(0, head)}…${npub.slice(-tail)}`;
}

export default function SuccessPage() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [nip07, setNip07] = useState<Nip07ProfileBundle | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const p = sessionStorage.getItem(STORAGE_PUBKEY);
    const b = readBundle();
    startTransition(() => {
      setPubkey(p);
      setNip07(b);
    });
    if (!p) igWarn("[success] sessionStorage missing relay_connect_display_pubkey");
  }, []);

  const meta = nip07?.metadata;
  const displayName =
    meta?.display_name?.trim() || meta?.name?.trim() || "Connected";
  const npub = pubkey ? hexPubkeyToNpub(pubkey) : null;

  const copyNpub = async () => {
    if (!npub) return;
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 px-4 py-10">
      {pubkey && npub ? (
        <>
          <div
            className="relative w-full max-w-[340px] overflow-hidden rounded-[22px] px-6 pb-8 pt-14 shadow-2xl"
            style={{
              background:
                "linear-gradient(145deg, #7493FF 0%, #9C56FF 52%, #F24686 100%)",
            }}
          >
            <Link
              href="/"
              className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </Link>

            <div className="flex flex-col items-center text-center">
              <div className="mb-3 h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border-2 border-white bg-black/20 shadow-md">
                {meta?.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.picture}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/90">
                    <User className="h-10 w-10 stroke-[1.25]" />
                  </div>
                )}
              </div>

              <h1 className="mb-8 text-[20px] font-semibold italic tracking-tight text-white drop-shadow-sm">
                {displayName}
              </h1>

              <div className="mb-2 w-full">
                <p className="mb-1 inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                  Public key
                </p>
                <div className="mx-auto h-px w-12 bg-white/80" />
              </div>

              <div className="mb-5 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/5">
                <QRCodeSVG
                  value={npub}
                  size={216}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: "/nostr-mark.svg",
                    height: 44,
                    width: 44,
                    excavate: true,
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => void copyNpub()}
                className="flex w-full max-w-[280px] items-center gap-2 rounded-full bg-black/25 px-4 py-2.5 pl-4 pr-3 text-left text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/35"
              >
                <span className="min-w-0 flex-1 select-all font-mono text-[11px] leading-snug tracking-tight sm:text-[12px]">
                  {truncateNpub(npub)}
                </span>
                <span className="shrink-0 text-white/90" aria-hidden>
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-200" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </span>
              </button>

              <Link
                href="/"
                className="mt-7 inline-flex w-full max-w-[280px] items-center justify-center rounded-full bg-white py-3 text-[15px] font-medium tracking-tight text-zinc-900 shadow-md transition hover:bg-zinc-100"
              >
                Back to home
              </Link>
            </div>
          </div>

          <details className="mt-8 w-full max-w-[340px] rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-left">
            <summary className="cursor-pointer text-[12px] font-medium text-zinc-400">
              Technical details
            </summary>
            <div className="mt-3 space-y-3 text-[11px] text-zinc-500">
              <p className="break-all font-mono text-zinc-400">{pubkey}</p>
              {nip07 ? (
                <p className="text-zinc-600">
                  NIP-07 profile bundle · kind 0 from relays when available.
                </p>
              ) : (
                <p className="text-zinc-600">NIP-46 session (app keypair pubkey shown).</p>
              )}
              {meta?.nip05 ? (
                <p>
                  <span className="text-zinc-600">NIP-05:</span> {meta.nip05}
                </p>
              ) : null}
            </div>
          </details>
        </>
      ) : (
        <div className="max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 px-6 py-10 text-center text-zinc-500">
          <p className="text-[14px]">Could not read pubkey from session.</p>
          <Link
            href="/"
            className="mt-6 inline-block text-[13px] text-zinc-400 underline decoration-zinc-600 underline-offset-4"
          >
            Back
          </Link>
        </div>
      )}
    </main>
  );
}
