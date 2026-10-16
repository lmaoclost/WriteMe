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
