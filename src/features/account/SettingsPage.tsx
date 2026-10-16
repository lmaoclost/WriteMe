import { useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "../../data/account";
import { useScriptorium } from "../../data/store";
import "./account.css";

const CANCEL_CONFIRM = "Are you sure you want to cancel your Mythic subscription? You will lose access to Mythic features.";

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
    <div className="settings">
      <header>
        <h1><Link to="/" className="router-link">Scriptorium</Link></h1>
        <div className="header-actions">
          <Link to="/" className="back-btn">Back to Feed</Link>
          <a href="https://discord.gg/b9vrfR8rYC" target="_blank" rel="noopener" className="discord-btn" title="Join our Discord">
            <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M60.1 4.9A58.5 58.5 0 0 0 45.4.2a.2.2 0 0 0-.2.1 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37.4 37.4 0 0 0 25.4.3a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.5 4.9a.2.2 0 0 0-.2.1 51.4 51.4 0 0 0-9 43.6.2.2 0 0 0 .1.2 58.9 58.9 0 0 0 17.8 9 .2.2 0 0 0 .3-.1 42 42 0 0 0 3.2-5.2.2.2 0 0 0-.1-.2 38.9 38.9 0 0 1-5.6-2.7.2.2 0 0 1 0-.3l1.2-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.8 0h.2l1.2.9a.2.2 0 0 1 0 .3 36.5 36.5 0 0 1-5.6 2.7.2.2 0 0 0-.1.2 42 42 0 0 0 3.2 5.2.2.2 0 0 0 .3.1 58.7 58.7 0 0 0 17.8-9 .2.2 0 0 0 .1-.2 51.4 51.4 0 0 0-9-43.6.2.2 0 0 0-.2-.1ZM28.5 39.4c-3.4 0-6.2-3.2-6.2-7.1s2.8-7.1 6.2-7.1 6.3 3.2 6.2 7.1c0 3.9-2.8 7.1-6.2 7.1Zm18.2 0c-3.4 0-6.2-3.2-6.2-7.1s2.8-7.1 6.2-7.1 6.3 3.2 6.2 7.1c0 3.9-2.7 7.1-6.2 7.1Z" />
            </svg>
          </a>
        </div>
      </header>
      <main className="settings-content">
        <h2>Account Settings</h2>
        <p className="subtitle">Manage your account information</p>
        <div className="settings-section">
          <h3>Your Plan</h3>
          <div className="plan-info">
            <span className={`plan-badge ${user.plan}`}>
              {mythic ? "Mythic" : "Free"}
              {mythic && <span className="billing-cycle-label">{cycleLabel}</span>}
            </span>
            {statusText && <div className={`subscription-status ${statusClass}`}>{statusText}</div>}
            {mythic && (user.subscriptionStatus === "active" || user.subscriptionStatus === "on_hold") && (
              <button type="button" className="cancel-btn" onClick={handleCancel}>
                Cancel Subscription
              </button>
            )}
            {cancelMsg && <p className="success-message">{cancelMsg}</p>}
          </div>
          {showUpgradeHints && (
            <>
              <p className="plan-upgrade-hint">
                Upgrade to Mythic for unlimited timelines, calendars, and more.
              </p>
              <div className="billing-toggle">
                <button
                  type="button"
                  className={`toggle-btn${user.billingCycle === "monthly" ? " active" : ""}`}
                  onClick={() => setBillingCycle("monthly")}
                >
                  Monthly — $8/mo
                </button>
                <button
                  type="button"
                  className={`toggle-btn${user.billingCycle === "yearly" ? " active" : ""}`}
                  onClick={() => setBillingCycle("yearly")}
                >
                  Yearly — $65/yr <span className="save-badge">Save 32%</span>
                </button>
                <button
                  type="button"
                  className="upgrade-btn"
                  onClick={() => upgrade("mythic", "active", user.billingCycle)}
                >
                  Upgrade to Mythic
                </button>
              </div>
            </>
          )}
          <div className="bindery-zone">
            {user.binderyLifetime ? (
              <div className="bindery-owned">
                <p>
                  ✓ You own the <strong>Scriptorium Bindery</strong>
                </p>
              </div>
            ) : (
              <div className="bindery-pass">
                <p className="bindery-pass-head">Scriptorium Bindery — Lifetime</p>
                <p className="bindery-pass-desc">
                  Just want to publish your book? Own the Bindery forever — EPUB + print-ready PDF + every future
                  formatting upgrade — for a one-time <strong>$100</strong>. No subscription.
                </p>
                <button type="button" className="bindery-buy-btn" onClick={buyBinderyPass}>
                  Get Bindery — $100 once
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="settings-section profile-link-section">
          <h3>Public Profile</h3>
          <p className="section-hint">Your avatar, bios, and how others see you live in Profile Settings.</p>
          <div className="profile-info">
            <Link to="/profile" className="profile-link-btn">Open Profile Settings →</Link>
          </div>
        </div>
        <div className="settings-section">
          <h3>Account Information</h3>
          <div className="profile-info">
            <div className="info-row">
              <span className="label">Username:</span>
              <span className="value">{user.username || "Not set"}</span>
            </div>
            <div className="info-row">
              <span className="label">Email:</span>
              <span className="value">{user.email || "Not set"}</span>
            </div>
          </div>
        </div>
        <div className="settings-section">
          <h3>Change Username</h3>
          {usernameSuccess && <p className="success-message">{usernameSuccess}</p>}
          {usernameError && <p className="error-message">{usernameError}</p>}
          <form onSubmit={handleUsername}>
            <div className="form-group">
              <label htmlFor="newUsername">New Username:</label>
              <input
                type="text"
                id="newUsername"
                value={newUsername}
                placeholder="Enter new username"
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <button type="submit" className="save-btn">Update Username</button>
          </form>
        </div>
        <div className="settings-section">
          <h3>Change Email</h3>
          <p className="support-message">
            Email changes are temporarily unavailable while we sort out an issue. For any account concerns, please
            contact us at{" "}
            <a href="mailto:support@scriptorium.invalid" className="support-link">support@scriptorium.invalid</a> and we'll
            help you out.
          </p>
        </div>
        <div className="settings-section">
          <h3>Change Password</h3>
          {passwordSuccess && <p className="success-message">{passwordSuccess}</p>}
          {passwordError && <p className="error-message">{passwordError}</p>}
          <form onSubmit={handlePassword} noValidate>
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password:</label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                placeholder="Enter current password"
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="newPassword">New Password:</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                placeholder="Enter new password (min 6 characters)"
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmNewPassword">Confirm New Password:</label>
              <input
                type="password"
                id="confirmNewPassword"
                value={confirmNewPassword}
                placeholder="Confirm new password"
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="save-btn">Update Password</button>
          </form>
        </div>
        {!mythic && (
          <div className="settings-section support-section">
            <h3>Support Scriptorium</h3>
            <p className="support-message">
              Scriptorium is built and maintained by a solo developer. If you enjoy using it, consider upgrading to
              Mythic — it helps fund new features, server costs, and keeps the project alive. Every subscription makes
              a difference. If you have any concerns, please send an email to support@scriptorium.invalid.
            </p>
          </div>
        )}
        <div className="settings-section backup-section">
          <h3>Data &amp; backup</h3>
          <p className="backup-note">Your worlds live only in this browser. Export regularly to keep them safe.</p>
          <div className="backup-actions">
            <button type="button" className="save-btn" onClick={doExport}>Export all data</button>
            <label className="import-label">
              Import backup
              <input
                type="file"
                accept="application/json,text/plain"
                aria-label="Import backup"
                className="visually-hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { doImport(f); e.target.value = ""; }
                }}
              />
            </label>
          </div>
        </div>
        <div className="settings-section">
          <h3>Community</h3>
          <a href="https://discord.gg/b9vrfR8rYC" target="_blank" rel="noopener" className="discord-link">
            Join our Discord
          </a>
        </div>
      </main>
    </div>
  );
}
