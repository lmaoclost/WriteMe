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
  vi.restoreAllMocks();
  useAccount.setState(useAccount.getInitialState());
});

describe("SettingsPage", () => {
  it("renders all sections, brand, back-to-feed, discord", () => {
    renderPage();
    for (const h of [
      "Account Settings",
      "Your Plan",
      "Public Profile",
      "Account Information",
      "Change Username",
      "Change Email",
      "Change Password",
      "Support Scriptorium",
      "Community",
    ]) {
      expect(screen.getByRole("heading", { name: h })).toBeTruthy();
    }
    expect(screen.getByText("Manage your account information")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Feed" }).getAttribute("href")).toBe("/");
    expect(screen.getAllByRole("link", { name: "Join our Discord" }).length).toBe(2);
  });

  it("free plan: badge, upgrade hint, cycle toggle, upgrade and bindery buttons", () => {
    renderPage();
    expect(screen.getByText("Free")).toBeTruthy();
    expect(
      screen.getByText("Upgrade to Mythic for unlimited timelines, calendars, and more."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Monthly — $8/mo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yearly — $65/yr Save 32%" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upgrade to Mythic" })).toBeTruthy();
    expect(screen.getByText("Scriptorium Bindery — Lifetime")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Get Bindery — $100 once" })).toBeTruthy();
  });

  it("upgrade sets plan mythic/active with chosen cycle, shows active status and cancel", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Yearly — $65/yr Save 32%" }));
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Mythic" }));
    const s = useAccount.getState();
    expect(s.plan).toBe("mythic");
    expect(s.subscriptionStatus).toBe("active");
    expect(s.billingCycle).toBe("yearly");
    expect(screen.getByText("Mythic")).toBeTruthy();
    expect(document.querySelector(".billing-cycle-label")?.textContent).toBe(" — Yearly");
    expect(screen.getByText("Your Mythic subscription is active.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel Subscription" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Upgrade to Mythic" })).toBeNull();
  });

  it("cancel confirms then marks cancelled with exact message", () => {
    useAccount.getState().upgrade("mythic", "active", "monthly");
    renderPage();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel Subscription" }));
    expect(confirmSpy).toHaveBeenCalledWith(
      "Are you sure you want to cancel your Mythic subscription? You will lose access to Mythic features.",
    );
    expect(screen.getByText("Your subscription has been cancelled.")).toBeTruthy();
    expect(useAccount.getState().subscriptionStatus).toBe("cancelled");
  });

  it("declined cancel keeps mythic active", () => {
    useAccount.getState().upgrade("mythic", "active", "monthly");
    renderPage();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Cancel Subscription" }));
    expect(useAccount.getState().plan).toBe("mythic");
    expect(useAccount.getState().subscriptionStatus).toBe("active");
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
    const input = screen.getByLabelText("New Username:") as HTMLInputElement;
    const submit = screen.getByRole("button", { name: "Update Username" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(submit);
    expect(screen.getByText("Please enter a username")).toBeTruthy();
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.click(submit);
    expect(screen.getByText("Username must be at least 3 characters long")).toBeTruthy();
    fireEvent.change(input, { target: { value: "bad-" } });
    fireEvent.click(submit);
    expect(
      screen.getByText("Username can only contain letters, numbers, and underscores"),
    ).toBeTruthy();
    expect(useAccount.getState().username).toBe("");
    fireEvent.change(input, { target: { value: "renan" } });
    fireEvent.click(submit);
    expect(screen.getByText("Username updated successfully!")).toBeTruthy();
    expect(useAccount.getState().username).toBe("renan");
  });

  it("change password validates empty current, length, mismatch and succeeds", () => {
    renderPage();
    const cur = screen.getByLabelText("Current Password:") as HTMLInputElement;
    const next = screen.getByLabelText("New Password:") as HTMLInputElement;
    const cnf = screen.getByLabelText("Confirm New Password:") as HTMLInputElement;
    const submit = screen.getByRole("button", { name: "Update Password" });
    fireEvent.click(submit);
    expect(screen.getByText("Please enter your current password")).toBeTruthy();
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

  it("account information rows show Not set for empty account", () => {
    renderPage();
    expect(screen.getByText("Username:").nextElementSibling?.textContent).toBe("Not set");
    expect(screen.getByText("Email:").nextElementSibling?.textContent).toBe("Not set");
  });

  it("account information rows reflect stored username and email", () => {
    useAccount.setState({ username: "renan", email: "renan@example.com" });
    renderPage();
    expect(screen.getByText("renan")).toBeTruthy();
    expect(screen.getByText("renan@example.com")).toBeTruthy();
    expect(screen.queryByText("Not set")).toBeNull();
  });

  it("support section hides for mythic plan", () => {
    useAccount.getState().upgrade("mythic", "active", "monthly");
    renderPage();
    expect(screen.queryByRole("heading", { name: "Support Scriptorium" })).toBeNull();
  });

  it("bindery pass flips to owned after purchase", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Get Bindery — $100 once" }));
    expect(useAccount.getState().binderyLifetime).toBe(true);
    expect(screen.getByText("✓ You own the")).toBeTruthy();
    expect(screen.getByText("Scriptorium Bindery")).toBeTruthy();
    expect(screen.queryByText("Scriptorium Bindery — Lifetime")).toBeNull();
  });
});
