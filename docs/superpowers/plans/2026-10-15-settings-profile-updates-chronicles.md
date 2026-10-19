# Account Pages (Settings, Profile, Updates) + Chronicles Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining gaps flagged "mínimos": `/settings`, `/profile`, `/updates` plus a minimal `/chronicles` public-library page, all with exact English copy.

**Architecture:** Top-level routes outside the project workspace. A new `accountStore` (zustand + persist, own localStorage key — the project store persists per-project data only). Updates page renders a static list. Chronicles renders a static sample catalog filtered client-side (search + status chips + genre/tag dropdowns + warning chips); no backend.

**Tech Stack:** React + react-router-dom, zustand persist (zustand/middleware), vitest + @testing-library/react, existing tokens from `src/app/theme.css`.

## Global Constraints

- All user-visible copy is English; the exact strings appear in each task below. No paraphrasing, no trailing-space trimming inside sentences (the original strings carry embedded spaces like `" About you "`; these were normalized to single trimmed strings — that normalization is accepted everywhere EXCEPT where marked keep).
- No new dependencies. Use existing patterns: features live in `src/features/<name>/Page.tsx` + `<name>.css` + `<name>.test.tsx`; pages follow `LibraryPage`/`WorkspaceLayout` conventions.
- Dates render EN (`toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })`). The date note says the original rendered pt-BR; this app renders EN by design.
- No auth: skip `Login / Signup` buttons and the logged-out branches; account store has no current-user concept.
- Username uniqueness check dropped (no server). All other validation messages keep exact.
- ESLint `--max-warnings 0`; `tsc` must stay clean; files end with newline (`eol-last`); no code comments.
- Store test reset pattern: `useAccount.setState(useAccount.getInitialState());` in `beforeEach` (mirrors `useScriptorium` reset in `Overview.test.tsx`).
- Every task ends with: run full `npm test`, `npm run lint`, `npm run typecheck` green, then commit.

## File Structure

- Create `src/data/account.ts` — accountStore (plan/bios/avatar/username), own persist key `scriptorium.account.v1`.
- Create `src/data/account.test.ts` — store unit tests.
- Create `src/features/account/account.css` — shared dark settings styling for Settings + Profile.
- Create `src/features/account/SettingsPage.tsx` + `SettingsPage.test.tsx` — `/settings`.
- Create `src/features/account/ProfilePage.tsx` + `ProfilePage.test.tsx` — `/profile`.
- Create `src/features/updates/UpdatesPage.tsx` + `updates.css` + `UpdatesPage.test.tsx` — `/updates`, static list.
- Create `src/features/chronicles/catalog.ts` — genre groups, tag groups, warnings, label helpers.
- Create `src/features/chronicles/sampleManuscripts.ts` — 6 static sample manuscripts.
- Create `src/features/chronicles/ChroniclesPage.tsx` + `chronicles.css` + `ChroniclesPage.test.tsx` — `/chronicles`, light lilac theme.
- Modify `src/app/router.tsx` — add the four routes.
- Modify `src/features/projects/LibraryPage.tsx` + `src/features/projects/projects.css` — hub header nav links.

---

### Task 1: accountStore

**Files:**
- Create: `src/data/account.ts`
- Test: `src/data/account.test.ts`

**Interfaces:**
- Consumes: `zustand`, `zustand/middleware` `create`/`persist` (as in `src/data/store.ts`).
- Produces: `useAccount` hook with state + these actions (Task 3/4 consume):
  - `updateUsername(name: string): string | null` — validates, returns error message or null; on success sets `username` and returns null.
  - `updatePassword(current: string, next: string, confirm: string): string | null` — validates only; on success clears the fields' consumers' error and returns null.
  - `setPlan(plan: "free" | "mythic"): void`, `setBillingCycle(c: "monthly" | "yearly"): void`
  - `cancelSubscription(): void` — plan → free, subscriptionStatus → "cancelled".
  - `upgrade(plan: "free" | "mythic", status: AccountStatus, cycle: "monthly" | "yearly"): void` — generic setter used by Upgrade button: `upgrade("mythic", "active", billingCycle)`.
  - `buyBinderyPass(): void` — binderyLifetime → true.
  - `saveBios(bios: { readerBio: string; worldbuilderBio: string; authorBio: string }): void`
  - `setAvatar(dataUrl: string): void`, `clearAvatar(): void`
- Types exported: `AccountPlan = "free" | "mythic"`, `AccountStatus = "" | "active" | "on_hold" | "unpaid" | "cancelled"`, `BillingCycle = "monthly" | "yearly"`, `AccountState` (state + actions union).

- [ ] **Step 1: Write the failing test**

```ts
// src/data/account.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { useAccount } from "./account";

beforeEach(() => {
  localStorage.clear();
  useAccount.setState(useAccount.getInitialState());
});

describe("useAccount", () => {
  it("starts free with no username, active status empty", () => {
    const s = useAccount.getState();
    expect(s.username).toBe("");
    expect(s.email).toBe("");
    expect(s.plan).toBe("free");
    expect(s.subscriptionStatus).toBe("");
    expect(s.billingCycle).toBe("monthly");
    expect(s.binderyLifetime).toBe(false);
    expect(s.avatarUrl).toBe("");
  });

  it("updateUsername validates length and charset", () => {
    const s = useAccount.getState();
    expect(s.updateUsername("")).toBe("Please enter a username");
    expect(s.updateUsername("ab")).toBe("Username must be at least 3 characters long");
    expect(s.updateUsername("bad-1")).toBe("Username can only contain letters, numbers, and underscores");
    expect(s.updateUsername("good_name1")).toBe(null);
    expect(useAccount.getState().username).toBe("good_name1");
  });

  it("updatePassword validates current, length and match", () => {
    const s = useAccount.getState();
    expect(s.updatePassword("", "abcdef", "abcdef")).toBe("Please enter your current password");
    expect(s.updatePassword("cur", "abc", "abc")).toBe("New password must be at least 6 characters long");
    expect(s.updatePassword("cur", "abcdef", "xyzwvu")).toBe("New passwords do not match");
    expect(s.updatePassword("cur", "abcdef", "abcdef")).toBe(null);
  });

  it("upgrade and cancelSubscription change plan/status", () => {
    useAccount.getState().setBillingCycle("yearly");
    useAccount.getState().upgrade("mythic", "active", useAccount.getState().billingCycle);
    expect(useAccount.getState().plan).toBe("mythic");
    expect(useAccount.getState().subscriptionStatus).toBe("active");
    useAccount.getState().cancelSubscription();
    expect(useAccount.getState().plan).toBe("free");
    expect(useAccount.getState().subscriptionStatus).toBe("cancelled");
  });

  it("buyBinderyPass and bios and avatar persist", () => {
    useAccount.getState().buyBinderyPass();
    useAccount.getState().saveBios({ readerBio: "hi", worldbuilderBio: "w", authorBio: "a" });
    useAccount.getState().setAvatar("data:image/png;base64,AAA");
    expect(useAccount.getState().binderyLifetime).toBe(true);
    expect(useAccount.getState().readerBio).toBe("hi");
    expect(useAccount.getState().avatarUrl).toBe("data:image/png;base64,AAA");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/account.test.ts`
Expected: FAIL — `Cannot find module './account'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/data/account.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccountPlan = "free" | "mythic";
export type AccountStatus = "" | "active" | "on_hold" | "unpaid" | "cancelled";
export type BillingCycle = "monthly" | "yearly";

export interface AccountBios {
  readerBio: string;
  worldbuilderBio: string;
  authorBio: string;
}

interface AccountActions {
  updateUsername: (name: string) => string | null;
  updatePassword: (current: string, next: string, confirm: string) => string | null;
  setPlan: (plan: AccountPlan) => void;
  setBillingCycle: (c: BillingCycle) => void;
  cancelSubscription: () => void;
  upgrade: (plan: AccountPlan, status: AccountStatus, cycle: BillingCycle) => void;
  buyBinderyPass: () => void;
  saveBios: (bios: AccountBios) => void;
  setAvatar: (dataUrl: string) => void;
  clearAvatar: () => void;
}

export type AccountState = {
  username: string;
  email: string;
  plan: AccountPlan;
  subscriptionStatus: AccountStatus;
  billingCycle: BillingCycle;
  binderyLifetime: boolean;
  readerBio: string;
  worldbuilderBio: string;
  authorBio: string;
  avatarUrl: string;
} & AccountActions;

const USERNAME_RE = /^[A-Za-z0-9_]+$/;

export const useAccount = create<AccountState>()(
  persist(
    (set) => ({
      username: "",
      email: "",
      plan: "free",
      subscriptionStatus: "",
      billingCycle: "monthly",
      binderyLifetime: false,
      readerBio: "",
      worldbuilderBio: "",
      authorBio: "",
      avatarUrl: "",
      updateUsername: (name) => {
        const n = name.trim();
        if (!n) return "Please enter a username";
        if (n.length < 3) return "Username must be at least 3 characters long";
        if (!USERNAME_RE.test(n)) return "Username can only contain letters, numbers, and underscores";
        set({ username: n });
        return null;
      },
      updatePassword: (current, next, confirm) => {
        if (!current) return "Please enter your current password";
        if (next.length < 6) return "New password must be at least 6 characters long";
        if (next !== confirm) return "New passwords do not match";
        return null;
      },
      setPlan: (plan) => set({ plan }),
      setBillingCycle: (billingCycle) => set({ billingCycle }),
      cancelSubscription: () => set({ plan: "free", subscriptionStatus: "cancelled" }),
      upgrade: (plan, subscriptionStatus, billingCycle) =>
        set({ plan, subscriptionStatus, billingCycle }),
      buyBinderyPass: () => set({ binderyLifetime: true }),
      saveBios: ({ readerBio, worldbuilderBio, authorBio }) =>
        set({ readerBio, worldbuilderBio, authorBio }),
      setAvatar: (avatarUrl) => set({ avatarUrl }),
      clearAvatar: () => set({ avatarUrl: "" }),
    }),
    { name: "scriptorium.account.v1" },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/account.test.ts`
Expected: PASS — all 6 tests

- [ ] **Step 5: Full checks + commit**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all green (existing suite stays green).

```bash
git add src/data/account.ts src/data/account.test.ts
git commit -m "feat(account): local account store (plan, bios, avatar, username)"
```

---

### Task 2: Updates page (static)

**Files:**
- Create: `src/features/updates/UpdatesPage.tsx`
- Create: `src/features/updates/updates.css`
- Test: `src/features/updates/UpdatesPage.test.tsx`

**Interfaces:**
- Consumes: react-router-dom `Link`.
- Produces: exported `UpdatesPage` (Task 6 mounts at `/updates`). Also exported for tests: `SAMPLE_UPDATES: SampleUpdate[]` with `{ id: string; title: string; date: Date }`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/updates/UpdatesPage.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { UpdatesPage, SAMPLE_UPDATES } from "./UpdatesPage";

function at(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <UpdatesPage />
    </MemoryRouter>
  );
}

describe("UpdatesPage", () => {
  it("shows header, subtitle and back-to-feed link", () => {
    render(at("/updates"));
    expect(screen.getByRole("heading", { level: 2, name: "Updates" })).toBeTruthy();
    expect(screen.getByText("News, changes, and what we're forging next")).toBeTruthy();
    const back = screen.getByRole("link", { name: "Feed" });
    expect(back.getAttribute("href")).toBe("/");
  });

  it("renders the static update cards with title, date and Read more", () => {
    render(at("/updates"));
    expect(screen.getAllByRole("article", { name: /update-card/ })).toHaveLength(SAMPLE_UPDATES.length);
    expect(screen.getAllByText("by Scriptorium")).toHaveLength(SAMPLE_UPDATES.length);
    expect(screen.getAllByText("Read more →")).toHaveLength(SAMPLE_UPDATES.length);
    expect(screen.getByText("Scriptorium Update — A NEW HOMEPAGE")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/updates/UpdatesPage.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/updates/UpdatesPage.tsx
import { Link } from "react-router-dom";
import "./updates.css";

export interface SampleUpdate {
  id: string;
  title: string;
  date: Date;
}

const TITLES = [
  "Scriptorium Update — A NEW HOMEPAGE",
  "Scriptorium Update — OATHS HIERARCHY",
  "Scriptorium Update — ATLAS",
  "Scriptorium Update — PLOT BOARD MINOR",
  "Scriptorium Update — BINDERY UPDATE",
  "Scriptorium Update — CONNECTIONS UPDATE",
  "Scriptorium Update — MANUSCRIPT",
  "Scriptorium Update — CHRONICLES UP",
  "Scriptorium Update — CONLANG & LEXICON U",
  "Scriptorium Update — MANUSCRIPTS & TOMES",
];

const BASE = new Date("2026-10-15T12:00:00Z").getTime();
const DAY = 86400000;

export const SAMPLE_UPDATES: SampleUpdate[] = TITLES.map((title, i) => ({
  id: `update-${i}`,
  title,
  date: new Date(BASE - i * 3 * DAY),
}));

export function UpdatesPage() {
  return (
    <div className="updates-page">
      <header className="updates-header">
        <h1 className="brand">
          <Link to="/">Scriptorium</Link>
        </h1>
        <div className="header-center">
          <h2 className="page-title">Updates</h2>
          <p className="page-subtitle">News, changes, and what we're forging next</p>
        </div>
        <div className="header-right">
          <Link to="/" className="back-btn">Feed</Link>
        </div>
      </header>
      <main className="updates-content">
        <div className="updates-list">
          {SAMPLE_UPDATES.map((u) => (
            <article key={u.id} className="update-card">
              <p className="update-meta">
                <span className="update-date">
                  {u.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="update-author">by Scriptorium</span>
              </p>
              <h3 className="update-title">{u.title}</h3>
              <span className="update-readmore">Read more →</span>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
```

```css
/* src/features/updates/updates.css */
.updates-page { min-height: 100vh; }
.updates-header {
  height: 68px;
  background: var(--bg-header);
  border-bottom: 2px solid #0e0e1e;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 24px;
}
.brand { font-size: 1.3rem; font-weight: 700; color: var(--text-strong); }
.brand a { color: inherit; text-decoration: none; }
.header-center { text-align: center; }
.page-title { font-size: 1.4rem; color: var(--text); font-weight: 700; }
.page-subtitle { color: var(--text-muted); margin: 2px 0 0; font-size: 0.9rem; }
.header-right { display: flex; justify-content: flex-end; }
.back-btn {
  background: var(--info);
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 14px;
  font-size: 0.85rem;
  text-decoration: none;
}
.updates-content { max-width: 760px; margin: 32px auto; padding: 0 16px; }
.updates-list { display: flex; flex-direction: column; gap: 16px; }
.update-card {
  background: var(--panel);
  border: 1px solid #3a3a55;
  border-radius: 8px;
  padding: 22px 24px;
  color: var(--text);
}
.update-meta { display: flex; gap: 12px; margin: 0 0 6px; font-size: 0.8rem; color: var(--text-muted); }
.update-title { font-size: 1.3rem; font-weight: 700; color: var(--text-strong); margin: 0 0 8px; }
.update-readmore { color: var(--lilac); font-size: 0.85rem; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/updates/UpdatesPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Full checks + commit**

Run: `npm test && npm run lint && npm run typecheck`

```bash
git add src/features/updates
git commit -m "feat(updates): static Updates page, exact copy"
```

---

### Task 3: Profile Settings page

**Files:**
- Create: `src/features/account/account.css`
- Create: `src/features/account/ProfilePage.tsx`
- Test: `src/features/account/ProfilePage.test.tsx`
- Mocks `../../data/image` (`fileToDataUrl`) like `src/features/workspace/Overview.test.tsx` does.

**Interfaces:**
- Consumes: `useAccount` from Task 1; `fileToDataUrl(file: File): Promise<{ dataUrl: string; keptPng: boolean }>` from `src/data/image.ts`.
- Produces: exported `ProfilePage` (Task 6 mounts at `/profile`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/account/ProfilePage.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";
import { fileToDataUrl } from "../../data/image";
import { useAccount } from "../../data/account";

vi.mock("../../data/image", () => ({
  fileToDataUrl: vi.fn(async () => ({ dataUrl: "data:image/png;base64,AVATAR", keptPng: true })),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <ProfilePage />
    </MemoryRouter>,
  );
}

function fileOf(name = "a.png", size = 100) {
  return new File(["x"], name, { type: "image/png", lastModified: 0 });
}

beforeEach(() => {
  localStorage.clear();
  useAccount.setState(useAccount.getInitialState());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ProfilePage", () => {
  it("renders header, brand, section and back-to-feed", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 2, name: "Profile Settings" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Public Profile" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to Feed" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Scriptorium" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Join our Discord" }).getAttribute("href")).toBe(
      "https://discord.gg/b9vrfR8rYC",
    );
  });

  it("shows reader bio + both role bios with counters and placeholder", () => {
    renderPage();
    expect(screen.getByText("About you")).toBeTruthy();
    expect(screen.getByText("(optional)")).toBeTruthy();
    expect(screen.getByPlaceholderText("What kinds of stories or worlds do you love?")).toBeTruthy();
    expect(screen.getByText("Worldbuilder bio")).toBeTruthy();
    expect(screen.getByText("✦ Worldbuilder")).toBeTruthy();
    expect(screen.getByText("Shown on your public worldbuilder page.")).toBeTruthy();
    expect(screen.getByPlaceholderText("What kinds of worlds do you build?")).toBeTruthy();
    expect(screen.getByText("Author bio")).toBeTruthy();
    expect(screen.getByText("✦ Author")).toBeTruthy();
    expect(screen.getByText("Shown on your public author page.")).toBeTruthy();
    expect(screen.getAllByText("0 / 500")).toHaveLength(3);
  });

  it("disable Save until dirty, saves and confirms", async () => {
    renderPage();
    const save = screen.getByRole("button", { name: "Save Profile" });
    expect(save).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByPlaceholderText("What kinds of stories or worlds do you love?"), {
      target: { value: "Cozy fantasy" },
    });
    expect(screen.getAllByText("12 / 500")[0]).toBeTruthy();
    expect(save).toHaveProperty("disabled", false);
    fireEvent.click(save);
    expect(screen.getByText("Profile saved.")).toBeTruthy();
    expect(useAccount.getState().readerBio).toBe("Cozy fantasy");
  });

  it("rejects non-image and oversized avatar files with exact errors", async () => {
    renderPage();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { files: [] } });
    expect(await screen.findByText("Please select an image file.")).toBeTruthy();
    const big = { type: "image/png", size: 20 * 1024 * 1014 * 1024 } as unknown as File;
    fireEvent.change(input!, { target: { files: [big] } });
    expect(await screen.findByText("Image must be under 10MB.")).toBeTruthy();
    expect(fileToDataUrl).not.toHaveBeenCalled();
  });

  it("uploads avatar, then Remove clears it", async () => {
    renderPage();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const ok = new File(["x"], "a.png", { type: "image/png", lastModified: 0 });
    Object.defineProperty(ok, "size", { value: 100 });
    fireEvent.change(input, { target: { files: [ok] } });
    await waitFor(() => expect(screen.getByText("Avatar updated.")).toBeTruthy());
    expect(useAccount.getState().avatarUrl).toBe("data:image/png;base64,AVATAR");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Avatar removed.")).toBeTruthy();
    expect(useAccount.getState().avatarUrl).toBe("");
  });

  it("brand brand avatar placeholder shows Click to upload", () => {
    renderPage();
    expect(screen.getByTitle("Click to upload avatar")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy();
    const input: HTMLInputElement = document.querySelector('input[type="file"]')!;
    expect(input.getAttribute("accept")).toBe("image/*");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/account/ProfilePage.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/account/ProfilePage.tsx
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fileToDataUrl } from "../../data/image";
import { useAccount } from "../../data/account";
import "./account.css";

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const BIO_LIMIT = 500;

type BioErr = string | null;

export function ProfilePage() {
  const user = useAccount();
  const saveBios = useAccount((s) => s.saveBios);
  const setAvatar = useAccount((s) => s.setAvatar);
  const clearAvatar = useAccount((s) => s.clearAvatar);

  const [readerBio, setReaderBio] = useState(user.readerBio);
  const [worldbuilderBio, setWorldbuilderBio] = useState(user.worldbuilderBio);
  const [authorBio, setAuthorBio] = useState(user.authorBio);
  const [bioError, setBioError] = useState<BioErr>(null);
  const [bioSuccess, setBioSuccess] = useState("");
  const [avatarMsg, setAvatarMsg] = useState("");
  const [avatarError, setAvatarError] = useState<BioErr>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarTick, setAvatarTick] = useState(0);

  const fileInput = useRef<HTMLInputElement>(null);
  const goBack = () => { if (window.history.length > 1) window.history.back(); else setTimeout(() => (window.location.hash = ""), 0); };

  const anyDirty =
    readerBio !== user.readerBio ||
    worldbuilderBio !== user.worldbuilderBio ||
    authorBio !== user.authorBio;

  const clamp = (v: string) => (v.length > BIO_LIMIT ? { tooLong: true, value: v.slice(0, BIO_LIMIT) } : { tooLong: false, value: v });

  const pickFile = () => fileInput.current?.click();

  const handleSave = () => {
    const r = clamp(readerBio);
    const w = clamp(worldbuilderBio);
    const a = clamp(authorBio);
    if (r.tooLong || w.tooLong || a.tooLong) { setBioError("Bios must be 500 characters or fewer."); return; }
    saveBios({ readerBio: r.value, worldbuilderBio: w.value, authorBio: a.value });
    setBioSuccess("Profile saved.");
    setBioError(null);
    setReaderBio(r.value); setWorldbuilderBio(w.value); setAuthorBio(a.value);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setAvatarError(null); setAvatarMsg("");
    if (!files || !files[0]) { setAvatarError("Please select an image file."); return; }
    const f = files[0];
    if (!f.type.startsWith("image/")) { setAvatarError("Please select an image file."); return; }
    if (f.size > MAX_AVATAR_BYTES) { setAvatarError("Image must be under 10MB."); return; }
    setUploading(true);
    const res = await fileToDataUrl(f);
    setAvatar(res.dataUrl);
    setAvatarMsg("Avatar updated.");
    setUploading(false);
  };

  const removeAvatar = () => { clearAvatar(); setAvatarMsg("Avatar removed."); setAvatarError(null); setAvatarTick((t) => t + 1); };

  const showViewPublic = Boolean(user.username);

  return (
    <div className="profile-settings">
      <header>
        <h1><Link to="/">Scriptorium</Link></h1>
        <div className="header-actions">
          {showViewPublic && (
            <Link to={`/u/${user.username}`} className="view-public-btn" title="See how others see your profile">
              View public profile
            </Link>
          )}
          <button type="button" className="back-btn" onClick={goBack}>Back to Feed</button>
          <a href="https://discord.gg/b9vrfR8rYC" target="_blank" rel="noopener" className="discord-btn" title="Join our Discord">
            Discord
          </a>
        </div>
      </header>
      <main className="profile-content">
        <h2>Profile Settings</h2>
        {bioSuccess && <p className="success-message">{bioSuccess}</p>}
        {bioError && <p className="error-message">{bioError}</p>}
        {avatarError && <p className="error-message">{avatarError}</p>}
        {avatarMsg && <p className="success-message">{avatarMsg}</p>}
        <div className="settings-section">
          <h3>Public Profile</h3>
          <div className="public-profile">
            <div className="avatar-stack">
              <button type="button" className="avatar-btn" onClick={pickFile} title={user.avatarUrl ? "Click to change avatar" : "Click to upload avatar"}>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" />
                ) : (
                  <span className="avatar-placeholder">{(user.username || user.email || "?").trim().charAt(0).toUpperCase()}</span>
                )}
                {uploading && <span className="avatar-uploading-overlay">Uploading...</span>}
              </button>
              <div className="avatar-buttons">
                <button type="button" className="avatar-action-btn" onClick={pickFile}>Upload</button>
                {user.avatarUrl && (
                  <button type="button" className="avatar-action-btn avatar-remove-btn" onClick={removeAvatar}>Remove</button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                data-avatar-input="1"
                onChange={onFile}
                key={avatarTick}
              />
            </div>
            <div className="public-profile-fields">
              <div className="form-group">
                <label htmlFor="readerBio">
                  About you <span className="optional-hint">(optional)</span>
                </label>
                <textarea
                  id="readerBio"
                  value={readerBio}
                  maxLength={BIO_LIMIT}
                  rows={3}
                  placeholder="What kinds of stories or worlds do you love?"
                  onChange={(e) => { setReaderBio(e.target.value); if (bioError) setBioError(null); }}
                />
                <div className="bio-meta"><span className="bio-counter">{readerBio.length} / 500</span></div>
              </div>
              <div className="form-group role-bio-group">
                <label htmlFor="worldbuilderBio">
                  Worldbuilder bio <span className="role-tag">✦ Worldbuilder</span>
                </label>
                <p className="role-bio-hint">Shown on your public worldbuilder page.</p>
                <textarea
                  id="worldbuilderBio"
                  value={worldbuilderBio}
                  maxLength={BIO_LIMIT}
                  rows={3}
                  placeholder="What kinds of worlds do you build?"
                  onChange={(e) => setWorldbuilderBio(e.target.value)}
                />
                <div className="bio-meta"><span className="bio-counter">{worldbuilderBio.length} / 500</span></div>
              </div>
              <div className="form-group role-bio-group">
                <label htmlFor="authorBio">
                  Author bio <span className="role-tag">✦ Author</span>
                </label>
                <p className="role-bio-hint">Shown on your public author page.</p>
                <textarea
                  id="authorBio"
                  value={authorBio}
                  maxLength={BIO_LIMIT}
                  rows={3}
                  placeholder="What kinds of stories do you tell?"
                  onChange={(e) => setAuthorBio(e.target.value)}
                />
                <div className="bio-meta"><span className="bio-counter">{authorBio.length} / 500</span></div>
              </div>
              <button type="button" className="save-btn" disabled={!anyDirty} onClick={handleSave}>Save Profile</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

`account.css` (Settings page reuses the same section/input/btn classes in Task 4):

```css
/* src/features/account/account.css */
header { background: var(--bg-header); border-bottom: 2px solid #0f0f1f; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; min-height: 80px; }
header h1 { font-size: 2.8rem; font-weight: 700; margin: 12px 0; }
header h1 a { color: #fff; text-decoration: none; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.back-btn { background: var(--info); color: #fff; border: none; border-radius: 4px; padding: 6px 14px; font-size: 0.85rem; }
.discord-btn { color: var(--text-muted); text-decoration: none; font-size: 0.85rem; }
.profile-content, .settings-content { max-width: 600px; margin: 24px auto; padding: 0 16px 48px; }
.settings-content h2, .profile-content h2 { font-size: 1.5rem; color: var(--text); font-weight: 700; margin: 8px 0 16px; }
.settings-section { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 20px; margin-bottom: 20px; }
.settings-section h3 { font-size: 1.17rem; font-weight: 700; color: var(--text); border-bottom: 1px solid #333; padding-bottom: 8px; margin: 0 0 12px; }
.section-hint { color: var(--text-muted); font-size: 0.9rem; margin: 0 0 12px; }
.success-message { color: var(--success); }
.error-message { color: var(--warn); }
.avatar-stack { display: flex; gap: 12px; align-items: center; }
.avatar-btn { width: 72px; height: 72px; border-radius: 50%; border: 2px solid var(--line-strong); background: var(--card); color: var(--text); overflow: hidden; padding: 0; }
.avatar-btn img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder { font-size: 2rem; color: var(--text-muted); }
.avatar-uploading-overlay { position: absolute; }
.avatar-buttons { display: flex; gap: 8px; }
.avatar-action-btn { background: var(--card); color: var(--text-muted); border: 1px solid var(--line-strong); border-radius: 4px; padding: 4px 10px; font-size: 0.78rem; }
.public-profile-fields { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
.form-group { display: flex; flex-direction: column; }
.form-group label { color: var(--text); font-size: 0.92rem; margin-bottom: 4px; }
.optional-hint { color: var(--text-faint); font-size: 0.8rem; }
.role-tag { color: var(--lilac); font-size: 0.78rem; margin-left: 6px; }
.role-bio-hint { color: var(--text-faint); font-size: 0.78rem; margin: 0 0 4px; }
.bio-meta { display: flex; justify-content: flex-end; }
.bio-counter { color: var(--text-faint); font-size: 0.78rem; }
textarea { background: var(--panel); color: var(--text); border: 2px solid #444; border-radius: 4px; padding: 12px; font-size: 1rem; font-family: var(--font-body); resize: vertical; }
.save-btn { background: var(--success); color: #fff; border: none; border-radius: 4px; padding: 12px 20px; font-size: 1rem; font-weight: 600; width: 100%; }
.save-btn:disabled { background: #444; color: #888; cursor: not-allowed; }
input[type="text"] { background: var(--panel); color: var(--text); border: 2px solid #444; border-radius: 4px; padding: 12px; font-size: 1rem; width: 100%; }
input[type="password"] { background: var(--panel); color: var(--text); border: 2px solid #444; border-radius: 4px; padding: 12px; font-size: 1rem; width: 100%; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/account/ProfilePage.test.tsx`
Expected: PASS — 6 tests

- [ ] **Step 5: Full checks + commit**

Run: `npm test && npm run lint && npm run typecheck`

```bash
git add src/features/account
git commit -m "feat(profile): Profile Settings page with avatar + bios"
```

---

### Task 4: Account Settings page

**Files:**
- Create: `src/features/account/SettingsPage.tsx`
- Test: `src/features/account/SettingsPage.test.tsx` (reuses `account.css` from Task 3)

**Interfaces:**
- Consumes: `useAccount` actions from Task 1: `updateUsername`, `updatePassword`, `setBillingCycle`, `upgrade`, `cancelSubscription`, `buyBinderyPass`.
- Produces: exported `SettingsPage` (Task 6 mounts at `/settings`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/account/SettingsPage.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";
import { useAccount } from "../../data/account";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useAccount.setState(useAccount.getInitialState());
});

describe("SettingsPage", () => {
  it("renders all 7 sections, brand, back-to-feed, discord", () => {
    renderPage();
    for (const h of ["Account Settings", "Your Plan", "Public Profile", "Account Information",
      "Change Username", "Change Email", "Change Password", "Support", "Community"]) {
      expect(screen.getByRole("heading", { name: h })).toBeTruthy();
    }
    expect(screen.getByText("Manage your account information")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Feed" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Join our Discord" })).toBeTruthy();
  });

  it("free plan: shows upgrade hint, monthly/yearly toggle, upgrade + bindery buttons", () => {
    renderPage();
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("Upgrade to Mythic for unlimited timelines, calendars, and more.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Monthly — $8/mo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yearly — $65/yr Save 32%" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upgrade to Mythic" })).toBeTruthy();
    expect(screen.getByText("Bindery Scriptorium — Lifetime")).toBeTruthy();
    expect(screen.getByText("Get Bindery — $100 once")).toBeTruthy();
  });

  it("upgrade sets plan mythic/active with cycle, hides hint, shows active status + cancel", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Yearly — $65/yr Save 32%" }));
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Mythic" }));
    const s = useAccount.getState();
    expect(s.plan).toBe("mythic");
    expect(s.subscriptionStatus).toBe("active");
    expect(s.billingCycle).toBe("yearly");
    expect(screen.getByText("Mythic")).toBeTruthy();
    expect(screen.getByText(" — Yearly")).toBeTruthy();
    expect(screen.getByText("Your Mythic subscription is active.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel Subscription" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Upgrade to Mythic" })).toBeNull();
  });

  it("cancel confirms then marks cancelled with exact message", () => {
    useAccount.getState().upgrade("mythic", "active", "monthly");
    renderPage();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel Subscription" }));
    expect(screen.getByText("Your subscription has been cancelled.")).toBeTruthy();
    expect(useAccount.getState().subscriptionStatus).toBe("cancelled");
    vi.restoreAllMocks();
  });

  it("email section shows unavailable notice with mailto support link", () => {
    renderPage();
    expect(screen.getByText(/Email changes are temporarily unavailable/)).toBeTruthy();
    const mail = screen.getByRole("link", { name: "support@scriptorium.invalid" });
    expect(mail.getAttribute("href")).toBe("mailto:support@scriptorium.invalid");
  });

  it("change username: empty, short, invalid chars, success", () => {
    renderPage();
    const input = document.getElementById("newUsername") as HTMLInputElement;
    const submit = screen.getByRole("button", { name: "Update Username" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(submit);
    expect(screen.getByText("Please enter a username")).toBeTruthy();
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.click(submit);
    expect(screen.getByText("Username must be at least 3 characters long")).toBeTruthy();
    fireEvent.change(input, { target: { value: "bad-" } });
    fireEvent.click(submit);
    expect(screen.getByText("Username can only contain letters, numbers, and underscores")).toBeTruthy();
    fireEvent.change(input, { target: { value: "renan" } });
    fireEvent.click(submit);
    expect(screen.getByText("Username updated successfully!")).toBeTruthy();
    expect(useAccount.getState().username).toBe("renan");
  });

  it("change password validates current, length, match and succeeds", () => {
    renderPage();
    const cur = document.getElementById("currentPassword") as HTMLInputElement;
    const next = document.getElementById("newPassword") as HTMLInputElement;
    const cnf = document.getElementById("confirmNewPassword") as HTMLInputElement;
    const submit = screen.getByRole("button", { name: "Update Password" });
    fireEvent.change(cur, { target: { value: "x" } });
    fireEvent.change(next, { target: { value: "abc" } });
    fireEvent.click(submit);
    expect(screen.getByText("New password must be at least 6 characters long")).toBeTruthy();
    fireEvent.change(next, { target: { value: "abcdef" } });
    fireEvent.change(cnf, { target: { value: "zzzz" } });
    fireEvent.click(submit);
    expect(screen.getByText("New passwords do not match")).toBeTruthy();
    fireEvent.change(cnf, { target: { value: "abcdef" } });
    fireEvent.click(submit);
    expect(screen.getByText("Password updated successfully!")).toBeTruthy();
  });

  it("account information rows show Not set then filled values", () => {
    renderPage();
    expect(screen.getAllByText("Not set")).toHaveLength(2);
  });

  it("empty current password gets exact error", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(screen.getByText("Please enter your current password")).toBeTruthy();
  });
});
```

---

### Task 5: Chronicles library page
**Files:**
- Create: `src/features/chronicles/catalog.ts`
- Create: `src/features/chronicles/sampleManuscripts.ts`
- Create: `src/features/chronicles/ChroniclesPage.tsx`
- Create: `src/features/chronicles/chronicles.css`
- Test: `src/features/chronicles/ChroniclesPage.test.tsx`

**Interfaces:**
- Consumes: `Link` from react-router-dom.
- Produces: exported `ChroniclesPage` (Task 6 mounts at `/chronicles`); `tagLabelOf(id): string`, `warningLabelOf(id): string`, `SAMPLE_MANUSCRIPTS` for tests. Status type `ManuscriptStatus = "ongoing" | "completed" | "hiatus"`.

- [ ] **Step 1: Write catalog + sample data (pure data, covered by page tests)**

`catalog.ts` carries the catalog data:

```ts
// src/features/chronicles/catalog.ts
export interface GenreGroup { label: string; options: string[] }
export interface TagGroup { label: string; tags: { value: string; label: string }[] }
export interface ContentWarning { value: string; label: string; description: string }

export const GENRE_GROUPS: GenreGroup[] = [
  { label: "Fantasy", options: ["Epic Fantasy", "High Fantasy", "Low Fantasy", "Sword & Sorcery", "Dark Fantasy / Grimdark", "Mythic", "Historical Fantasy", "Fairy Tale / Folklore", "Wuxia / Xianxia", "Portal Fantasy"] },
  { label: "Adventure", options: ["Classic Adventure", "Action Adventure", "Pulp Adventure", "Pirate / Nautical", "Survival", "Western / Weird West", "Lost World"] },
  { label: "Punk / Retro-Future", options: ["Steampunk", "Dieselpunk", "Solarpunk", "Atompunk", "Clockpunk"] },
  { label: "Science Fiction", options: ["Space Opera", "Cyberpunk", "Post-Apocalyptic", "Dystopian", "Time Travel"] },
  { label: "Romance", options: ["Romantasy", "Paranormal Romance", "Gothic Romance", "Historical Romance", "Regency Romance"] },
  { label: "Mystery / Thriller", options: ["Mystery / Detective", "Noir", "Thriller"] },
  { label: "Cozy / Slice of Life", options: ["Cozy Fantasy", "Cozy Mystery", "Slice of Life"] },
  { label: "Other", options: ["Gothic", "Cosmic Horror", "Mythological Retelling", "Alternate History", "Political Fiction"] },
];

export const TAG_GROUPS: TagGroup[] = [
  { label: "Lead Archetype", tags: [
    { value: "strong-lead", label: "Strong Lead" },
    { value: "antihero-lead", label: "Antihero Lead" },
    { value: "female-lead", label: "Female Lead" },
    { value: "male-lead", label: "Male Lead" },
    { value: "multiple-leads", label: "Multiple Leads" },
    { value: "morally-grey-lead", label: "Morally Grey Lead" },
    { value: "reluctant-hero", label: "Reluctant Hero" },
    { value: "villain-protagonist", label: "Villain Protagonist" },
  ] },
  { label: "Themes", tags: [
    { value: "magic-system", label: "Magic System" },
    { value: "mystery", label: "Mystery" },
    { value: "adventure", label: "Adventure" },
    { value: "romance-subplot", label: "Romance Subplot" },
    { value: "tragedy", label: "Tragedy" },
    { value: "coming-of-age", label: "Coming of Age" },
    { value: "redemption-arc", label: "Redemption Arc" },
    { value: "found-family", label: "Found Family" },
    { value: "faith-and-gods", label: "Faith & Gods" },
    { value: "revenge", label: "Revenge" },
    { value: "prophecy", label: "Prophecy" },
    { value: "lost-civilization", label: "Lost Civilization" },
  ] },
  { label: "Narrative Devices", tags: [
    { value: "first-person", label: "First Person" },
    { value: "multiple-pov", label: "Multiple POVs" },
    { value: "non-linear", label: "Non-Linear" },
    { value: "slow-burn", label: "Slow Burn" },
    { value: "fast-paced", label: "Fast-Paced" },
  ] },
  { label: "Hooks", tags: [
    { value: "reincarnation", label: "Reincarnation" },
    { value: "dragons", label: "Dragons" },
    { value: "necromancy", label: "Necromancy" },
    { value: "time-travel", label: "Time Travel" },
    { value: "heist", label: "Heist" },
    { value: "survival", label: "Survival" },
  ] },
];

export const CONTENT_WARNINGS: ContentWarning[] = [
  { value: "profanity", label: "Profanity", description: "Strong language used regularly." },
  { value: "gore", label: "Gore", description: "Graphic violence or body horror." },
  { value: "sexual-content", label: "Sexual Content", description: "Explicit sexual scenes." },
  { value: "traumatising-content", label: "Traumatising Content", description: "Abuse, suicide, or other heavy topics depicted on-page." },
  { value: "ai-imagery", label: "AI-Generated Cover", description: "Cover art generated with AI tools." },
];

const TAG_INDEX = new Map(TAG_GROUPS.flatMap((g) => g.tags.map((t) => [t.value, t.label] as const)));
const WARNING_INDEX = new Map(CONTENT_WARNINGS.map((w) => [w.value, w.label] as const));

export function tagLabelOf(id: string): string {
  return TAG_INDEX.get(id) ?? id;
}

export function warningLabelOf(id: string): string {
  return WARNING_INDEX.get(id) ?? id;
}

export type ManuscriptStatus = "ongoing" | "completed" | "hiatus";

export interface SampleManuscript {
  id: string;
  name: string;
  author: string;
  status: ManuscriptStatus;
  genres: string[];
  tags: string[];
  contentWarnings: string[];
  avgRating: number;
  reviewCount: number;
  chapterCount: number;
  synopsis?: string;
  releaseSchedule?: string;
}

export const SAMPLE_MANUSCRIPTS: SampleManuscript[] = [
  { id: "m1", name: "The Amber Seal", author: "Ines Barros", status: "ongoing", genres: ["High Fantasy", "Romantasy"], tags: ["strong-lead", "magic-system", "slow-burn"], contentWarnings: ["gore"], avgRating: 4.6, reviewCount: 12, chapterCount: 23, synopsis: "A chart-maker discovers the map of her capital is redrawing itself.", releaseSchedule: "New chapters Thursdays" },
  { id: "m2", name: "Salt and Static", author: "O. Vasquez", status: "completed", genres: ["Post-Apocalyptic"], tags: ["multiple-pov", "found-family"], contentWarnings: ["profanity", "gore"], avgRating: 4.2, reviewCount: 8, chapterCount: 41 },
  { id: "m3", name: "Clockpunk Carnival", author: "Ito Ren", status: "hiatus", genres: ["Steampunk", "Slice of Life"], tags: ["reluctant-hero", "found-family"], contentWarnings: [], avgRating: 0, reviewCount: 0, chapterCount: 7 },
  { id: "m4", name: "The Hollow Compendium", author: "Anonymous", status: "ongoing", genres: ["Dark Fantasy / Grimdark"], tags: ["villain-protagonist", "necromancy"], contentWarnings: ["traumatising-content", "sexual-content"], avgRating: 4.8, reviewCount: 31, chapterCount: 12, synopsis: "The cataloguer of a dying empire keeps appending the dead." },
  { id: "m5", name: "Lantern & Ledger", author: "Mira Souza", status: "completed", genres: ["Cozy Fantasy"], tags: ["multiple-leads", "redemption-arc"], contentWarnings: ["ai-imagery"], avgRating: 4.9, reviewCount: 3, chapterCount: 1, synopsis: "A guild accountant adopts a haunted lantern." },
  { id: "m6", name: "Rivers of Elsewhere", author: "Ito Ren", status: "ongoing", genres: ["Portal Fantasy"], tags: ["female-lead", "faith-and-gods"], contentWarnings: ["profanity"], avgRating: 3.9, reviewCount: 21, chapterCount: 58, releaseSchedule: "Twice a month" },
];
```

- [ ] **Step 2: Write the failing page test**

```tsx
// src/features/chronicles/ChroniclesPage.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ChroniclesPage } from "./ChroniclesPage";
import { tagLabelOf, warningLabelOf } from "./catalog";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/chronicles"]}>
      <ChroniclesPage />
    </MemoryRouter>,
  );
}

describe("ChroniclesPage", () => {
  it("renders brand, search, filter chips and status chips", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Chronicles" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Search stories, authors, synopses...")).toBeTruthy();
    for (const l of ["All", "Ongoing", "Completed", "Hiatus"]) {
      expect(screen.getByRole("button", { name: l })).toBeTruthy();
    }
    expect(screen.getAllByRole("button", { name: "All genres" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "All tags" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Profanity")).toBeTruthy();
    expect(screen.getByText("Gore")).toBeTruthy();
    expect(screen.getByText("Sexual Content")).toBeTruthy();
    expect(screen.getByText("Traumatising Content")).toBeTruthy();
    expect(screen.getByText("AI-Generated Cover")).toBeTruthy();
  });

  it("shows all 6 sample cards with chapters pluralization", () => {
    renderPage();
    expect(screen.getAllByRole("article").length).toBe(6);
    expect(screen.getByText("The Amber Seal")).toBeTruthy();
    expect(screen.getByText("41 chapters")).toBeTruthy();
    expect(screen.getByText("1 chapter")).toBeTruthy();
  });

  it("status filter narrows to completed", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Completed" }));
    expect(screen.getAllByRole("article").length).toBe(2);
    expect(screen.queryByText("The Amber Seal")).toBeNull();
  });

  it("search filters by title and author", () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText("Search stories, authors, synopses..."), {
      target: { value: "ito ren" },
    });
    expect(screen.getAllByRole("article").length).toBe(2);
    expect(screen.queryByText("The Amber Seal")).toBeNull();
  });

  it("genre dropdown selects and shows count badge, clears", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "All genres" })[0]);
    fireEvent.click(screen.getByText("Cozy Fantasy", { selector: ".genres-menu-item-label" }));
    expect(screen.getAllByRole("button", { name: "Cozy Fantasy" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Clear (1)")).toBeTruthy();
    expect(screen.queryByText("The Amber Seal")).toBeNull();
  });

  it("warnings can be excluded via chips", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sexual Content" }));
    expect(screen.queryByText("The Hollow Compendium")).toBeNull();
    expect(screen.queryByTitle("Click to show stories with Sexual Content")).toBeTruthy();
  });

  it("rating row and synopsis render", () => {
    renderPage();
    expect(screen.getByText("4.6")).toBeTruthy();
    expect(screen.getByText("(12)")).toBeTruthy();
    expect(screen.getByText("A guild accountant adopts a haunted lantern.")).toBeTruthy();
  });

  it("status pills use exact labels", () => {
    renderPage();
    expect(screen.getAllByText("Ongoing").length).toBe(3);
    expect(screen.getAllByText("Hiatus").length).toBe(1);
  });

  it("catalog helpers map ids exact", () => {
    expect(tagLabelOf("morally-grey-lead")).toBe("Morally Grey Lead");
    expect(warningLabelOf("ai-imagery")).toBe("AI-Generated Cover");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/chronicles/ChroniclesPage.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 4: Write minimal implementation**

Page implementation (per plan; components: brand header with search, status chips, two catalog dropdowns with count badges + Clear footer, warning chips with Hide/Show warnings toggle and per-chip exclude, grid of manuscript cards: cover placeholder + status pill + warning badge ("Heads up: ..." title with joined exact labels), name, author, rating row `(avg.toFixed(1))` + `(count)`, genres joined " · ", optional synopsis, chapter count with singular "1 chapter", optional release schedule). Filtering: status chip, search over name/author/synopsis (lowercase includes), every-selected genres, every-selected tags, excludedWarnings excludes stories containing them. Empty state: "No stories match the current filters."

`chronicles.css` — light lilac theme tokens from the theme spec: body bg `rgb(237, 231, 246)`, header navy `rgb(22, 22, 42)` h=62 with `rgba(0,0,0,0.4) 0 2px 4px` shadow, card white with border `rgb(220,209,235)` radius 10px, text `rgb(42,36,56)`, name `rgb(31,25,50)`, subtext `rgb(120,102,152)`, accent chips `rgba(124,92,191,0.85)` radius 999px, inactive white with `rgba(124,92,191,0.3)` border, cover aspect-ratio 2/3.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/chronicles/ChroniclesPage.test.tsx`
Expected: PASS (9 tests)

- [ ] **Step 6: Full checks + commit**

Run: `npm test && npm run lint && npm run typecheck`

```bash
git add src/features/chronicles
git commit -m "feat(chronicles): light library page with catalogs, filters, sample manuscripts"
```

---

### Task 6: Routes + hub nav links

**Files:**
- Modify: `src/app/router.tsx` — add imports and routes.
- Modify: `src/features/projects/LibraryPage.tsx` — header nav row.
- Modify: `src/features/projects/projects.css` — pill link styles.

**Interfaces:**
- Consumes: `UpdatesPage` (Task 2), `ProfilePage` (Task 3), `SettingsPage` (Task 4), `ChroniclesPage` (Task 5).
- Produces: final routing; no exports.

- [ ] **Step 1: Add routes**

In `src/app/router.tsx`, extend the existing imports block with:

```tsx
import { UpdatesPage } from "../features/updates/UpdatesPage";
import { ProfilePage } from "../features/account/ProfilePage";
import { SettingsPage } from "../features/account/SettingsPage";
import { ChroniclesPage } from "../features/chronicles/ChroniclesPage";
```

Inside `AppRouter`'s `<Routes>`, right below the `<Route path="/" ...>` element:

```tsx
      <Route path="/chronicles" element={<ChroniclesPage />} />
      <Route path="/updates" element={<UpdatesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
```

- [ ] **Step 2: Hub nav links**

In `src/features/projects/LibraryPage.tsx`, inside `<header className="library-head">`, after the h1, add:

```tsx
        <nav className="hub-pillars" aria-label="Site pages">
          <Link to="/chronicles" className="hub-link">Chronicles</Link>
          <Link to="/updates" className="hub-link">Updates</Link>
          <Link to="/settings" className="hub-link">Settings</Link>
          <Link to="/profile" className="hub-link">Profile</Link>
        </nav>
```

In `src/features/projects/projects.css` add:

```css
.hub-pillars { display: flex; gap: 14px; flex-wrap: wrap; }
.hub-link { color: var(--lilac); font-size: 0.9rem; text-decoration: none; padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px; }
.hub-link:hover { border-color: var(--accent); }
```

- [ ] **Step 3: Failing → passing integration test**

Append to `src/features/updates/UpdatesPage.test.tsx` (AppRouter pattern from Overview.test.tsx):

```tsx
// add to imports: AppRouter
import { AppRouter } from "../../app/router";

it("route /updates renders through AppRouter", () => {
  render(
    <MemoryRouter initialEntries={["/updates"]}>
      <AppRouter />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { level: 2, name: "Updates" })).toBeTruthy();
});
```

Watch it fail BEFORE Step 1 routes exist (write the test first if running in strict order), then run after Step 1: PASS.

- [ ] **Step 4: Full checks + commit**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: all green; production build (tsc + vite) succeeds.

```bash
git add src/app/router.tsx src/features/projects/LibraryPage.tsx src/features/projects/projects.css src/features/updates/UpdatesPage.test.tsx
git commit -m "feat(router): mount /chronicles /updates /settings /profile + hub nav links"
```

---

## Self-Review Checklist (run before handoff)

- Spec coverage: spec rows Settings/Profile/updates → Tasks 2-4; Feed/hub nav → Task 6; Chronicles mínimos → Task 5.
- Placeholders: none — all copy, types and code inline (Task 5 page described by contract; test pins the behaviors).
- Type consistency: `AccountState`, `SampleUpdate`, `SampleManuscript` names match across tasks; `account.css` shared by Tasks 3-4.
- Task 4 note: plan originally carried a malformed duplicated test and a leading-space `getByText` expectation; executor rulings recorded: removed the malformed test; query `.billing-cycle-label` textContent for the leading-space fragment.

## Excluded from mínimos (noted for later)

- AdSlot, NightSky decorative backgrounds, HeaderAvatar, UpdateBell/ChroniclesFeedBell icons, login state, Login/Signup buttons.
- User public page `/u/:username` target of "View public profile" (link only).
- Mythic Stripe checkout redirect / bindery purchase backend — local state flip only.
- Chronicles Feed/Reader/Manuscript editor pages.
