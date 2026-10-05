# Pagewright

Studio για βιβλία ζωγραφικής: σχεδιάζεις, ζωγραφίζεις και εκδίδεις (Amazon KDP, Etsy/printables), και τα παιδιά ζωγραφίζουν τα βιβλία σε tablet, μόνα τους ή μέσα από μια τάξη.

Next.js 16 (App Router, Turbopack) · React 19 · Konva · Supabase (Postgres + Auth + Storage) · Tailwind 4. Ελληνικό UI με διακόπτη EL/EN.

## Τι κάνει

| Περιοχή | Πού |
|---|---|
| Editor (σχέδιο, χρώμα, εξώφυλλο, συναρμολόγηση) | `/studio/editor`, `src/components/studio/editor/` |
| Βιβλιοθήκη, πρότυπα, βιβλίο από περιγραφή, βιβλίο-ιστορία, ιδέες για niche | `/studio`, `src/components/studio/screens/` |
| Εξαγωγή KDP (PDF εσωτερικού και εξωφύλλου, bleed, ράχη), τιμή & royalty | `src/utils/pdfExport.ts`, `src/utils/kdpPricing.ts` |
| Πακέτο ψηφιακής λήψης (ZIP: PNG ανά σελίδα, PDF A4/Letter, άδεια χρήσης) | `src/utils/digitalPack.ts`, `src/utils/zip.ts` |
| AI: εικόνες (OpenAI/Fal), σταθερός χαρακτήρας, αυτόματο vectorize, κείμενα (Claude ή OpenAI) | `src/services/`, `src/app/api/` |
| Πλάνα και credits (Stripe) | `/studio/billing`, `src/lib/stripe.ts`, `src/app/api/billing/` |
| Συνεργάτες σε βιβλίο (συντάκτες/θεατές, σύνδεσμοι πρόσκλησης) | `src/utils/collaborators.ts`, `/studio/join/<token>` |
| Τάξεις & οικογένειες: τα παιδιά μπαίνουν με κωδικό + δύο εικόνες | `/studio/groups` (ενήλικας), `/kids`, `/kids/<code>` (παιδί) |
| Κοινοποίηση για ζωγραφική χωρίς λογαριασμό | `/share/<token>` |
| Εγκαταστάσιμη εφαρμογή (PWA) | `src/app/manifest.ts`, `public/sw.js` |
| Admin (supervisor), με καταγραφή σφαλμάτων server και browser | `/studio/admin`, `src/instrumentation*.ts`, `src/lib/errorLog.ts` |
| Όρια αιτημάτων ανά λεπτό στα API (AI, export, αναφορές σφαλμάτων) | `src/lib/rateLimit.ts` |

## Ξεκίνημα

```bash
npm install
cp .env.local.example .env.local   # συμπλήρωσε τουλάχιστον τα Supabase κλειδιά
npm run dev                        # http://localhost:3000
```

1. **Supabase**: τρέξε το `sql/00_ALL.sql` στο SQL Editor (λεπτομέρειες στο [sql/README.md](sql/README.md)).
2. **AI** (προαιρετικά): `OPENAI_API_KEY` ή `FAL_KEY` για εικόνες, `ANTHROPIC_API_KEY` για τα κείμενα (σχεδιασμός βιβλίου, ιστορίες, command bar). Ο σταθερός χαρακτήρας από εικόνα αναφοράς χρειάζεται `OPENAI_API_KEY`.
3. **Πληρωμές** (προαιρετικά): τα `STRIPE_*` και `SUPABASE_SERVICE_ROLE_KEY`. Τα βήματα είναι στο `.env.local.example`. Χωρίς αυτά όλοι μένουν στο Free.

Ό,τι δεν έχει ρυθμιστεί (κλειδί ή migration) απενεργοποιείται ήσυχα, με μήνυμα στη σχετική οθόνη. Η υπόλοιπη εφαρμογή συνεχίζει να δουλεύει.

## Εντολές

| Εντολή | Τι κάνει |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run check:i18n` | Δείχνει κείμενα UI χωρίς ελληνική μετάφραση (`src/lib/i18n-el.ts`) |
| `npm run sql:all` | Ξαναφτιάχνει το `sql/00_ALL.sql` από τα αριθμημένα αρχεία |
| `npm test` | unit + SQL + e2e (δες [tests/README.md](tests/README.md)) |
| `node scripts/build-icons.mjs` | Ξαναβγάζει τα PNG εικονίδια της εφαρμογής από το `public/icon.svg` |

## Συμβάσεις

- **Next.js 16**: διάβασε τον σχετικό οδηγό στο `node_modules/next/dist/docs/` πριν γράψεις κώδικα (δες `AGENTS.md`). Το middleware λέγεται πλέον `src/proxy.ts`.
- **Ασφάλεια**: το πραγματικό όριο πρόσβασης είναι το RLS στην Postgres. Τα παιδιά (χωρίς λογαριασμό) περνούν μόνο από `security definer` functions με token. Το `RequireAuth` κάνει μόνο δρομολόγηση.
- **Αποθήκευση βιβλίου**: το `saveBook` ενημερώνει χωρίς να αλλάζει ποτέ τον ιδιοκτήτη, και με `expectedUpdatedAt` αρνείται να σβήσει νεότερη αποθήκευση κάποιου άλλου (`BookConflictError`).
- **Κείμενα UI**: κάθε `t("…")` χρειάζεται ελληνική απόδοση. Το `npm run check:i18n` πρέπει να βγαίνει καθαρό.
- **Νέα αλλαγή στη βάση**: νέο αριθμημένο αρχείο στο `sql/`, ασφαλές να ξανατρέξει, μετά `npm run sql:all` και `npm run test:sql`.
