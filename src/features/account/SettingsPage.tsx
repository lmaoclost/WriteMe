import { useState } from "react";
import { Link } from "react-router-dom";
import { Seal } from "../../ui/Seal";
import { useAccount } from "../../data/account";
import { useScriptorium } from "../../data/store";

const CANCEL_CONFIRM = "Are you sure you want to cancel your Mythic subscription? You will lose access to Mythic features.";

const SECTION = "bg-night border border-line rounded-lg p-5 mb-5";
const SECTION_H3 = "font-display text-[1.25rem] font-semibold text-parchment-strong border-b border-line pb-2 mb-3";
const FIELD_INPUT =
  "w-full resize-y bg-ink text-parchment border border-line rounded-sm px-3 py-2.5 text-base placeholder:text-slate outline-none focus-visible:border-gold-dim";

export function SettingsPage() {
  const user = useAccount();
  const setBillingCycle = useAccount((s) => s.setBillingCycle);
  const upgrade = useAccount((s) => s.upgrade);
  const cancelSubscription = useAccount((s) => s.cancelSubscription);
  const buyBinderyPass = useAccount((s) => s.buyBinderyPass);

  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSuccess, setUsernameSuccess] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [cancelMsg, setCancelMsg] = useState("");

  const mythic = user.plan === "mythic";
  const showUpgradeHints = !mythic || user.subscriptionStatus === "cancelled";
  const cycleLabel = user.billingCycle === "yearly" ? " — Yearly" : " — Monthly";
  const statusClass = user.subscriptionStatus || "active";

  const handleUsername = (e: React.FormEvent) => {
    e.preventDefault();
    const err = useAccount.getState().updateUsername(newUsername);
    if (err) { setUsernameError(err); setUsernameSuccess(""); return; }
    setUsernameSuccess("Username updated successfully!");
    setUsernameError("");
    setNewUsername("");
  };

  const handlePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const err = useAccount.getState().updatePassword(currentPassword, newPassword, confirmNewPassword);
    if (err) { setPasswordError(err); setPasswordSuccess(""); return; }
    setPasswordSuccess("Password updated successfully!");
    setPasswordError("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  const handleCancel = () => {
    if (!window.confirm(CANCEL_CONFIRM)) return;
    cancelSubscription();
    setCancelMsg("Your subscription has been cancelled.");
  };

  const exportData = useScriptorium((s) => s.exportData);
  const importData = useScriptorium((s) => s.importData);
  const pushToast = useScriptorium((s) => s.pushToast);

  const doExport = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scriptorium-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (file: File) => {
    const fr = new FileReader();
    fr.onload = () => {
      const r = importData(String(fr.result));
      if (r.ok) pushToast("success", "Backup imported.");
      else pushToast("error", r.error);
    };
    fr.onerror = () => pushToast("error", "That file could not be read.");
    fr.readAsText(file);
  };

  const statusText: string | null = !mythic ? null
    : user.subscriptionStatus === "on_hold"
      ? "Your subscription payment failed. Please update your payment method to keep Mythic access."
      : user.subscriptionStatus === "unpaid"
        ? "Your Mythic subscription ended because we couldn't take payment. Resubscribe below to restore Mythic features."
        : user.subscriptionStatus === "cancelled"
          ? "Your subscription has been cancelled. Upgrade again to restore Mythic features."
          : "Your Mythic subscription is active.";

  return (
    <div>
      <header className="bg-night border-b border-line flex items-center justify-between px-6 min-h-16">
        <h1 className="my-2.5 m-0">
          <Link to="/" className="inline-flex items-center gap-2.5 no-underline">
            <Seal letter="S" className="size-7 text-sm" />
            <span className="font-display text-[0.9375rem] font-semibold tracking-[0.14em] uppercase text-parchment-strong">Scriptorium</span>
          </Link>
        </h1>
        <div className="flex items-center gap-2.5">
          <Link
            to="/"
            className="inline-block bg-transparent text-slate border border-line rounded-sm px-3.5 py-1.5 text-sm no-underline cursor-pointer transition-colors hover:text-parchment-strong hover:border-gold-dim"
          >
            Back to Feed
          </Link>
        </div>
      </header>
      <main className="max-w-[600px] mx-auto my-6 px-4 pb-12">
        <h2 className="font-display text-[1.375rem] font-semibold text-parchment-strong mt-2 mb-4">Account Settings</h2>
        <p className="text-slate -mt-3 mb-4">Manage your account information</p>
        <div className={SECTION}>
          <h3 className={SECTION_H3}>Your Plan</h3>
          <div>
            <span className={`inline-flex items-center rounded-full px-3.5 py-1.5 font-semibold border ${mythic ? "bg-[color-mix(in_srgb,var(--gold)_14%,var(--night-2))] text-gold border-gold-dim" : "text-slate border-line-strong bg-night-2"}`}>
              {mythic ? "Mythic" : "Free"}
              {mythic && <span className="text-slate font-normal" data-slot="settings-cycle">{cycleLabel}</span>}
            </span>
            {statusText && <div className={`mt-2.5 text-sm text-slate ${statusClass}`}>{statusText}</div>}
            {mythic && (user.subscriptionStatus === "active" || user.subscriptionStatus === "on_hold") && (
              <button
                type="button"
                onClick={handleCancel}
                className="block mt-2.5 bg-transparent text-danger border border-destructive rounded-sm px-3.5 py-2 font-semibold cursor-pointer hover:bg-[color-mix(in_srgb,var(--destructive)_18%,transparent)]"
              >
                Cancel Subscription
              </button>
            )}
            {cancelMsg && <p className="text-success">{cancelMsg}</p>}
          </div>
          {showUpgradeHints && (
            <>
              <p className="text-slate text-[0.9375rem] mt-2 mb-2.5">
                Upgrade to Mythic for unlimited timelines, calendars, and more.
              </p>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className={`rounded-full py-1.5 px-3 text-sm cursor-pointer border bg-night-2 transition-colors ${user.billingCycle === "monthly" ? "text-lilac border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_20%,var(--night-2))]" : "text-slate border-line hover:text-parchment hover:border-gold-dim"}`}
                  onClick={() => setBillingCycle("monthly")}
                >
                  Monthly — $8/mo
                </button>
                <button
                  type="button"
                  className={`rounded-full py-1.5 px-3 text-sm cursor-pointer border bg-night-2 transition-colors ${user.billingCycle === "yearly" ? "text-lilac border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_20%,var(--night-2))]" : "text-slate border-line hover:text-parchment hover:border-gold-dim"}`}
                  onClick={() => setBillingCycle("yearly")}
                >
                  Yearly — $65/yr <span className="text-success text-xs ml-1.5">Save 32%</span>
                </button>
                <button
                  type="button"
                  className="bg-gold text-wax border-0 rounded-sm px-3 py-1.5 text-[0.8125rem] font-semibold cursor-pointer hover:brightness-[1.08]"
                  onClick={() => upgrade("mythic", "active", user.billingCycle)}
                >
                  Upgrade to Mythic
                </button>
              </div>
            </>
          )}
          <div>
            {user.binderyLifetime ? (
              <div className="text-success">
                <p>
                  ✓ You own the <strong className="text-parchment">Bindery Scriptorium</strong>
                </p>
              </div>
            ) : (
              <div>
                <p className="text-parchment-strong font-semibold mt-3 mb-1">Bindery Scriptorium — Lifetime</p>
                <p className="text-slate text-sm leading-[1.5]">
                  Just want to publish your book? Own the Bindery forever — EPUB + print-ready PDF + every future
                  formatting upgrade — for a one-time <strong className="text-parchment">$100</strong>. No subscription.
                </p>
                <button
                  type="button"
                  onClick={buyBinderyPass}
                  className="mt-2 bg-gold text-wax border-0 rounded-sm px-3.5 py-2 font-semibold cursor-pointer hover:brightness-[1.08]"
                >
                  Get Bindery — $100 once
                </button>
              </div>
            )}
          </div>
        </div>
        <div className={SECTION}>
          <h3 className={SECTION_H3}>Public Profile</h3>
          <p className="text-slate text-sm m-0 mb-3">Your avatar, bios, and how others see you live in Profile Settings.</p>
          <div className="flex flex-col gap-2">
            <Link to="/profile" className="text-lilac no-underline font-semibold hover:underline">Open Profile Settings →</Link>
          </div>
        </div>
        <div className={SECTION}>
          <h3 className={SECTION_H3}>Account Information</h3>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 py-1">
              <span className="text-slate">Username:</span>
              <span className="text-parchment">{user.username || "Not set"}</span>
            </div>
            <div className="flex gap-2 py-1">
              <span className="text-slate">Email:</span>
              <span className="text-parchment">{user.email || "Not set"}</span>
            </div>
          </div>
        </div>
        <div className={SECTION}>
          <h3 className={SECTION_H3}>Change Username</h3>
          {usernameSuccess && <p className="text-success">{usernameSuccess}</p>}
          {usernameError && <p className="text-danger">{usernameError}</p>}
          <form onSubmit={handleUsername}>
            <div className="flex flex-col">
              <label htmlFor="newUsername" className="inline-flex items-baseline flex-wrap gap-1.5 text-parchment-dim text-sm mb-1">New Username:</label>
              <input
                type="text"
                id="newUsername"
                value={newUsername}
                placeholder="Enter new username"
                onChange={(e) => setNewUsername(e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <button type="submit" className="w-full mt-3 bg-gold text-wax border-0 rounded-sm px-5 py-3 text-base font-semibold cursor-pointer hover:brightness-[1.08] disabled:bg-night-2 disabled:text-slate disabled:cursor-not-allowed">Update Username</button>
          </form>
        </div>
        <div className={SECTION}>
          <h3 className={SECTION_H3}>Change Password</h3>
          {passwordSuccess && <p className="text-success">{passwordSuccess}</p>}
          {passwordError && <p className="text-danger">{passwordError}</p>}
          <form onSubmit={handlePassword} noValidate>
            <div className="flex flex-col mb-2.5">
              <label htmlFor="currentPassword" className="inline-flex items-baseline flex-wrap gap-1.5 text-parchment-dim text-sm mb-1">Current Password:</label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                placeholder="Enter current password"
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex flex-col mb-2.5">
              <label htmlFor="newPassword" className="inline-flex items-baseline flex-wrap gap-1.5 text-parchment-dim text-sm mb-1">New Password:</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                placeholder="Enter new password (min 6 characters)"
                onChange={(e) => setNewPassword(e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex flex-col mb-2.5">
              <label htmlFor="confirmNewPassword" className="inline-flex items-baseline flex-wrap gap-1.5 text-parchment-dim text-sm mb-1">Confirm New Password:</label>
              <input
                type="password"
                id="confirmNewPassword"
                value={confirmNewPassword}
                placeholder="Confirm new password"
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <button type="submit" className="w-full mt-3 bg-gold text-wax border-0 rounded-sm px-5 py-3 text-base font-semibold cursor-pointer hover:brightness-[1.08] disabled:bg-night-2 disabled:text-slate disabled:cursor-not-allowed">Update Password</button>
          </form>
        </div>
        <div className={SECTION}>
          <h3 className={SECTION_H3}>Data &amp; backup</h3>
          <p className="text-slate text-sm m-0 mb-3">Your worlds live only in this browser. Export regularly to keep them safe.</p>
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={doExport} className="bg-gold text-wax border-0 rounded-sm px-5 py-3 text-base font-semibold cursor-pointer hover:brightness-[1.08]">Export all data</button>
            <label className="inline-block text-slate border border-line rounded-sm px-3.5 py-2 text-sm cursor-pointer transition-colors hover:text-parchment-strong hover:border-gold-dim">
              Import backup
              <input
                type="file"
                accept="application/json,text/plain"
                aria-label="Import backup"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { doImport(f); e.target.value = ""; }
                }}
              />
            </label>
          </div>
        </div>
        <div className={SECTION}>
          <h3 className={SECTION_H3}>Community</h3>
          <a href="https://discord.gg/b9vrfR8rYC" target="_blank" rel="noopener" className="text-slate no-underline text-sm hover:text-parchment">
            Join our Discord
          </a>
        </div>
      </main>
    </div>
  );
}
