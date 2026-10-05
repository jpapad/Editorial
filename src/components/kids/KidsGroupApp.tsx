"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Award, Check, MessageCircle, X } from "lucide-react";
import { ColoringBoard } from "@/components/studio/coloring/ColoringView";
import { printPageImage, Sticker } from "@/components/studio/coloring/rewards";
import { certificateImage, KidAvatar, PIN_PICTURES, PinPicture } from "@/components/kids/kidIcons";
import { changedPages, forgetKid, isMissingGroupsTable, kidBook, kidHome, kidLogin, kidSave, lookupGroup, normalizeCode, rememberKid, savedKid, type KidHome, type KidLookup } from "@/utils/kidGroups";
import { convertPages, interiorSpace } from "@/utils/pageGeometry";
import type { BookPage, PageSpace } from "@/types/editor";
import { LanguageToggle, useT } from "@/lib/i18n";
import { cn } from "@/utils/cn";

type Stage =
  | { kind: "loading" }
  | { kind: "missing"; message: string }
  | { kind: "pick"; group: KidLookup }
  | { kind: "pin"; group: KidLookup; member: KidLookup["members"][number]; wrong: boolean }
  | { kind: "home"; home: KidHome; token: string };

const BIG_BUTTON = "outline-none focus-visible:ring-4 focus-visible:ring-accent focus-visible:ring-offset-2";

/**
 * /kids/<code>: a child of a class or family signs in (their name, then
 * their two pictures) and colors the books the grown-up gave the group.
 * Everything they color is saved with the group (sql/10_kid_groups.sql),
 * so it's there on any tablet and the grown-up sees it too.
 */
export default function KidsGroupApp() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = normalizeCode(rawCode);
  const bookId = useSearchParams().get("book");
  const router = useRouter();
  const t = useT();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = savedKid(code);
        if (saved) {
          const home = await kidHome(saved.token);
          if (home) {
            if (!cancelled) setStage({ kind: "home", home, token: saved.token });
            return;
          }
          forgetKid(code); // signed out by the grown-up
        }
        const group = await lookupGroup(code);
        if (cancelled) return;
        setStage(group ? { kind: "pick", group } : { kind: "missing", message: "We couldn't find that code. Check it with your teacher or parent." });
      } catch (err) {
        if (!cancelled) setStage({ kind: "missing", message: err instanceof Error && isMissingGroupsTable(err.message) ? "Classes aren't set up yet." : "Something went wrong. Try again in a moment." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, reload, bookId]);

  async function tryPin(pin: [number, number]) {
    if (stage.kind !== "pin") return;
    const token = await kidLogin(code, stage.member.id, pin).catch(() => null);
    if (!token) {
      setStage({ ...stage, wrong: true });
      return;
    }
    rememberKid(code, stage.member.id, token);
    const home = await kidHome(token);
    if (home) setStage({ kind: "home", home, token });
  }

  function signOut() {
    forgetKid(code);
    setStage({ kind: "loading" });
    setReload((n) => n + 1);
  }

  if (stage.kind === "home" && bookId) {
    return <KidBookView token={stage.token} bookId={bookId} code={code} onGone={() => router.push(`/kids/${code}`)} />;
  }

  return (
    <div data-theme="light" className="min-h-screen bg-gradient-to-br from-[#fff4d6] via-[#ffe6ef] to-[#dff1ff] px-4 py-8 text-ink">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <p className="font-pw-mono text-mono uppercase tracking-[0.12em] text-ink-secondary">{stage.kind === "home" ? stage.home.group : stage.kind === "pick" || stage.kind === "pin" ? stage.group.name : "Pagewright"}</p>
          <LanguageToggle />
        </div>

        {stage.kind === "loading" && <p className="py-24 text-center text-body text-ink-secondary">{t("Loading…")}</p>}

        {stage.kind === "missing" && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-section-title font-semibold">{t(stage.message)}</p>
            <button type="button" onClick={() => router.push("/kids")} className={cn("rounded-pill bg-accent px-6 py-3 text-body font-bold text-white", BIG_BUTTON)}>
              {t("Type the code again")}
            </button>
          </div>
        )}

        {stage.kind === "pick" && (
          <section aria-labelledby="pick-title" className="flex flex-col gap-5">
            <h1 id="pick-title" className="text-center text-[34px] font-extrabold tracking-[-0.02em]">
              {t("Who are you?")}
            </h1>
            {stage.group.members.length === 0 ? (
              <p className="text-center text-body text-ink-secondary">{t("There are no names here yet. Ask your teacher or parent to add you.")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {stage.group.members.map((m) => (
                  <button key={m.id} type="button" onClick={() => setStage({ kind: "pin", group: stage.group, member: m, wrong: false })} className={cn("flex flex-col items-center gap-3 rounded-[24px] bg-white/90 px-3 py-5 shadow-resting transition-transform hover:scale-[1.03] motion-reduce:transition-none", BIG_BUTTON)}>
                    <KidAvatar index={m.avatar} size={64} />
                    <span className="text-[20px] font-bold">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {stage.kind === "pin" && <PinPad name={stage.member.name} avatar={stage.member.avatar} wrong={stage.wrong} onBack={() => setStage({ kind: "pick", group: stage.group })} onSubmit={(pin) => void tryPin(pin)} />}

        {stage.kind === "home" && <KidHomeView home={stage.home} code={code} onSignOut={signOut} />}
      </div>
    </div>
  );
}

function PinPad({ name, avatar, wrong, onBack, onSubmit }: { name: string; avatar: number; wrong: boolean; onBack: () => void; onSubmit: (pin: [number, number]) => void }) {
  const t = useT();
  const [picked, setPicked] = useState<number[]>([]);
  useEffect(() => {
    if (wrong) setPicked([]); // eslint-disable-line react-hooks/set-state-in-effect -- start over after a wrong try
  }, [wrong]);

  function tap(i: number) {
    const next = [...picked, i];
    setPicked(next);
    if (next.length === 2) onSubmit([next[0], next[1]]);
  }

  return (
    <section aria-labelledby="pin-title" className="flex flex-col items-center gap-5">
      <KidAvatar index={avatar} size={72} />
      <h1 id="pin-title" className="text-center text-[30px] font-extrabold tracking-[-0.02em]">
        {t("Hi {name}! Tap your two pictures", { name })}
      </h1>
      <div className="flex gap-3" aria-live="polite" aria-label={t("Pictures chosen: {n} of 2", { n: picked.length })}>
        {[0, 1].map((slot) => (
          <span key={slot} className="flex h-16 w-16 items-center justify-center rounded-[18px] border-2 border-dashed border-ink/20 bg-white/70">
            {picked[slot] !== undefined && <PinPicture index={picked[slot]} size={52} />}
          </span>
        ))}
      </div>
      {wrong && (
        <p role="alert" className="rounded-pill bg-white px-4 py-2 text-body font-semibold text-error">
          {t("Not those ones — try again!")}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {PIN_PICTURES.map((p, i) => (
          <button key={p.name} type="button" aria-label={t(p.name)} disabled={picked.length >= 2} onClick={() => tap(i)} className={cn("rounded-[22px] bg-white p-2 shadow-resting transition-transform active:scale-95 motion-reduce:transition-none", BIG_BUTTON)}>
            <PinPicture index={i} size={76} />
          </button>
        ))}
      </div>
      <button type="button" onClick={onBack} className={cn("flex items-center gap-1.5 rounded-pill px-4 py-2 text-body font-semibold text-ink-secondary", BIG_BUTTON)}>
        <ArrowLeft size={16} /> {t("That's not me")}
      </button>
    </section>
  );
}

function KidHomeView({ home, code, onSignOut }: { home: KidHome; code: string; onSignOut: () => void }) {
  const t = useT();
  const router = useRouter();

  function printCertificate(title: string) {
    const src = certificateImage(home.name, title, home.group, {
      heading: t("Well done!"),
      line: t("colored every page of"),
      footer: new Date().toLocaleDateString(),
    });
    printPageImage(src, { width: 11 * 72, height: 8.5 * 72, bleed: 0 }, `${home.name} — ${title}`);
  }

  return (
    <section aria-labelledby="home-title" className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <KidAvatar index={home.avatar} size={72} />
        <div className="flex flex-col">
          <h1 id="home-title" className="text-[32px] font-extrabold tracking-[-0.02em]">
            {t("Hi {name}!", { name: home.name })}
          </h1>
          <p className="text-body text-ink-secondary">{t("Pick a book to color.")}</p>
        </div>
        <button type="button" onClick={onSignOut} className={cn("ml-auto rounded-pill bg-white/80 px-4 py-2 text-helper font-semibold text-ink-secondary", BIG_BUTTON)}>
          {t("Not {name}?", { name: home.name })}
        </button>
      </div>

      {home.books.length === 0 ? (
        <p className="rounded-[24px] bg-white/80 p-8 text-center text-body text-ink-secondary">{t("No books yet — your teacher or parent will add some soon.")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {home.books.map((b) => {
            const done = b.pages > 0 && b.done >= b.pages;
            return (
              <div key={b.id} className="flex flex-col gap-3 rounded-[24px] bg-white/90 p-4 shadow-resting">
                <button type="button" onClick={() => router.push(`/kids/${code}?book=${b.id}`)} className={cn("flex flex-col gap-3 rounded-[16px] text-left", BIG_BUTTON)} aria-label={t("Color “{title}”", { title: b.title })}>
                  <span className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[14px] bg-inset">
                    {b.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- the child's own page snapshot (data URL)
                      <img src={b.cover} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-[44px]" aria-hidden>
                        🖍️
                      </span>
                    )}
                  </span>
                  <span className="text-[19px] font-bold leading-tight">{b.title}</span>
                </button>
                <div className="h-3 overflow-hidden rounded-pill bg-inset" role="progressbar" aria-valuemin={0} aria-valuemax={b.pages} aria-valuenow={b.done} aria-label={t("{done} of {total} pages", { done: b.done, total: b.pages })}>
                  <div className="h-full rounded-pill bg-success" style={{ width: `${b.pages ? (100 * b.done) / b.pages : 0}%` }} />
                </div>
                <p className="flex items-center gap-1.5 text-helper font-semibold text-ink-secondary">
                  {done && <Check size={14} className="text-success" aria-hidden />}
                  {t("{done} of {total} pages", { done: b.done, total: b.pages })}
                </p>
                {done && (
                  <button type="button" onClick={() => printCertificate(b.title)} className={cn("flex items-center justify-center gap-2 rounded-pill bg-[#f5c518] px-4 py-2 text-body font-bold text-ink", BIG_BUTTON)}>
                    <Award size={18} aria-hidden /> {t("Print my certificate")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-[24px] bg-white/80 p-5">
        <p className="text-section-title font-bold">{t("Stickers from your teacher")}</p>
        {home.stickers.length === 0 ? <p className="text-body text-ink-secondary">{t("Finish pages and you may get a sticker!")}</p> : <div className="flex flex-wrap gap-2">{home.stickers.map((s, i) => <Sticker key={i} index={s} size={52} />)}</div>}
        {home.notes.slice(0, 3).map((n, i) => (
          <p key={i} className="flex items-start gap-2 text-body">
            <MessageCircle size={16} className="mt-1 shrink-0 text-accent" aria-hidden />
            {n.comment}
          </p>
        ))}
      </div>
    </section>
  );
}

function KidBookView({ token, bookId, code, onGone }: { token: string; bookId: string; code: string; onGone: () => void }) {
  const t = useT();
  const [book, setBook] = useState<{ title: string; pages: BookPage[]; space: PageSpace } | null | "gone">(null);
  const savedRef = useRef<BookPage[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await kidBook(token, bookId).catch(() => null);
      if (!data || data.pages.length === 0) {
        if (!cancelled) setBook("gone");
        return;
      }
      const space = interiorSpace(data.trim_size ?? undefined, data.bleed);
      const pages = (await convertPages(data.pages, space)).map((p) => {
        const w = data.work[p.id];
        return w ? { ...p, fillDataUrl: w.fill ?? undefined, thumbnailDataUrl: w.thumb ?? undefined, completedAt: w.completed_at ?? undefined } : p;
      });
      savedRef.current = pages;
      if (!cancelled) setBook({ title: data.title, pages, space });
    })();
    return () => {
      cancelled = true;
    };
  }, [token, bookId]);

  if (book === "gone") {
    return (
      <div data-theme="light" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-8 text-center">
        <p className="text-body text-ink-secondary">{t("This book isn't here any more.")}</p>
        <button type="button" onClick={onGone} className="flex items-center gap-2 rounded-pill bg-accent px-5 py-2.5 text-body font-semibold text-white">
          <X size={16} /> {t("Back to my books")}
        </button>
      </div>
    );
  }
  if (!book) return <div data-theme="light" className="flex min-h-screen items-center justify-center bg-surface text-body text-ink-secondary">{t("Loading…")}</div>;

  return (
    <ColoringBoard
      title={book.title}
      initialPages={book.pages}
      space={book.space}
      backHref={`/kids/${code}`}
      save={async (pages) => {
        // Only what changed since the last save goes up — a page's fill is a big picture.
        for (const page of changedPages(savedRef.current, pages)) {
          if (!(await kidSave(token, bookId, page))) throw new Error(t("Could not save this page."));
        }
        savedRef.current = pages;
      }}
    />
  );
}
