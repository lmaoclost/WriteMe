import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";
import { AppRouter } from "../../app/router";
import { fileToDataUrl } from "../../data/image";
import { useScriptorium } from "../../data/store";
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

beforeEach(() => {
  localStorage.clear();
  useAccount.setState(useAccount.getInitialState());
  useScriptorium.setState(useScriptorium.getInitialState());
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
    expect(screen.queryByRole("link", { name: "Join our Discord" })).toBeNull();
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

  it("avatar stack shows Click to upload, Upload button and image-only input", () => {
    renderPage();
    expect(screen.getByTitle("Click to upload avatar")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload" })).toBeTruthy();
    const input: HTMLInputElement = document.querySelector('input[type="file"]')!;
    expect(input.getAttribute("accept")).toBe("image/*");
  });

  it("avatar decoding failure surfaces exact error and clears uploading", async () => {
    vi.mocked(fileToDataUrl).mockRejectedValueOnce(new Error("boom"));
    renderPage();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const ok = new File(["x"], "ok.png", { type: "image/png", lastModified: 0 });
    Object.defineProperty(ok, "size", { value: 100 });
    fireEvent.change(input, { target: { files: [ok] } });
    expect(await screen.findByText("Failed to upload avatar. Please try again.")).toBeTruthy();
    expect(screen.queryByText("Uploading...")).toBeNull();
    expect(screen.queryByTitle("Click to change avatar")).toBeNull();
  });

  it("picking the same file twice re-uploads both times", async () => {
    renderPage();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const ok = new File(["x"], "same.png", { type: "image/png", lastModified: 0 });
    Object.defineProperty(ok, "size", { value: 100 });
    fireEvent.change(input, { target: { files: [ok] } });
    await waitFor(() => expect(screen.getByText("Avatar updated.")).toBeTruthy());
    Object.defineProperty(ok, "size", { value: 100 });
    const reInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(reInput, { target: { files: [ok] } });
    await waitFor(() => expect(fileToDataUrl).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText("Avatar updated.")).toHaveLength(1);
  });
});

describe("public profile /u/:username", () => {
  it("identity, roles that have bios, and worlds list", () => {
    useAccount.setState({ username: "renan", readerBio: "Loves rivers.", worldbuilderBio: "", authorBio: "" });
    const p1 = useScriptorium.getState().addProject("Vellmora", "The sealed kingdom.");
    render(
      <MemoryRouter initialEntries={["/u/renan"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "renan" })).toBeInTheDocument();
    expect(screen.getByText("✦ Reader")).toBeInTheDocument();
    expect(screen.queryByText("✦ Worldbuilder")).toBeNull();
    expect(screen.getByText(/Loves rivers/i)).toBeInTheDocument();
    expect(screen.getByText("Vellmora")).toBeInTheDocument();
    void p1;
  });

  it("omits bios that are empty, in Reader-Worldbuilder-Author order", () => {
    useAccount.setState({ username: "renan", readerBio: "", worldbuilderBio: "Builds worlds.", authorBio: "Tells stories." });
    render(
      <MemoryRouter initialEntries={["/u/renan"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    const wb = screen.getByText("Worldbuilder bio");
    const au = screen.getByText("Author bio");
    const readerSection = screen.queryByText("About you");
    expect(readerSection).toBeNull();
    expect(wb.compareDocumentPosition(au) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("unknown username renders not-found", () => {
    useAccount.setState({ username: "renan" });
    render(
      <MemoryRouter initialEntries={["/u/other"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No profile named/i)).toBeInTheDocument();
  });

  it("View public profile button on profile page reaches /u/:username", () => {
    useAccount.setState({ username: "renan" });
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "View public profile" }).getAttribute("href")).toBe("/u/renan");
  });
});
