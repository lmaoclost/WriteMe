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
