import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWriteme } from "../../data/store";
import { selectOption } from "../../test/selectHelper";
import { LibraryPage } from "./LibraryPage";

function wrap() {
  return (
    <MemoryRouter>
      <LibraryPage />
    </MemoryRouter>
  );
}

const SURFACE_NAMES = [
  "Lore", "Atlas", "Calendar", "Plot board", "Bloodline", "Manuscript", "Publishing",
];

beforeEach(() => {
  useWriteme.setState(useWriteme.getInitialState());
  localStorage.clear();
});

describe("library storage usage", () => {
  it("shows the storage usage line next to the backup buttons", () => {
    localStorage.setItem("writeme.v1", "x".repeat(2 * 1024 * 1024));
    render(wrap());
    expect(screen.getByText(/Storage used: 2\.0 MB of ~5 MB/)).toBeInTheDocument();
  });

  it("no warning below 80%", () => {
    localStorage.setItem("writeme.v1", "x".repeat(3 * 1024 * 1024));
    render(wrap());
    expect(screen.queryByText(/almost full/i)).toBeNull();
  });

  it("warns at or above 80% of the approximated quota", () => {
    localStorage.setItem("writeme.v1", "x".repeat(Math.ceil(4.2 * 1024 * 1024)));
    render(wrap());
    expect(screen.getByText(/almost full/i)).toBeInTheDocument();
  });
});

describe("LibraryPage hub", () => {
  it("shows welcome and my-worlds section even with zero worlds", () => {
    render(wrap());
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My worlds" })).toBeInTheDocument();
  });

  it("forge panels are gone: the library only lists worlds", () => {
    render(wrap());
    SURFACE_NAMES.forEach((f) => expect(screen.queryByText(f)).toBeNull());
  });

  it("site nav is gone: no chronicles/updates/settings/profile links", () => {
    render(wrap());
    expect(screen.queryByRole("link", { name: "Chronicles" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Updates" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Profile" })).toBeNull();
    expect(screen.queryByLabelText("Site pages")).toBeNull();
  });

  it("single world shows its card and no active-world selector", () => {
    const p = useWriteme.getState().addProject("Solo");
    render(wrap());
    expect(screen.queryByLabelText(/active world/i)).toBeNull();
    expect(screen.getByRole("link", { name: /Solo/i })).toHaveAttribute("href", `/p/${p.id}`);
  });

  it("load demo from empty state populates a full world and hides afterward", async () => {
    render(wrap());
    const btn = screen.getByRole("button", { name: /load the sample project/i });
    fireEvent.click(btn);
    await waitFor(() => expect(useWriteme.getState().seedFlag).toBe(true));
    expect(useWriteme.getState().projects).toHaveLength(1);
    expect(useWriteme.getState().entries.length).toBeGreaterThanOrEqual(6);
    expect(screen.queryByRole("button", { name: /load the sample project/i })).toBeNull();
  });





  it("creates a world through the modal in EN", async () => {
    render(wrap());
    fireEvent.click(screen.getByRole("button", { name: /new world/i }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Shimradis" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(useWriteme.getState().projects.map((p) => p.name)).toEqual(["Shimradis"]));
    expect(useWriteme.getState().toasts.some((t) => t.message === "World created.")).toBe(true);
  });

  it("deletes with EN confirmation modal", async () => {
    act(() => { useWriteme.getState().addProject("Old"); });
    render(wrap());
    fireEvent.click(screen.getByRole("button", { name: "Delete world" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(useWriteme.getState().projects).toHaveLength(0));
    expect(useWriteme.getState().toasts.some((t) => t.message === "World deleted.")).toBe(true);
  });

  it("world cards show relative updated stamps", () => {
    useWriteme.getState().addProject("Stamper");
    render(wrap());
    expect(screen.getByText(/Updated (just now|a minute ago|1 minute ago|\d+ (minutes?|hours?) ago|today)/i)).toBeInTheDocument();
  });

  it("search and sort appear at three worlds and filter the list", () => {
    useWriteme.getState().addProject("Amber Library");
    useWriteme.getState().addProject("Bastion");
    useWriteme.getState().addProject("Cinder March");
    render(wrap());
    const section = screen.getByRole("region", { name: "My worlds" });
    expect(within(section).getByRole("searchbox", { name: /search worlds/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: /search worlds/i }), { target: { value: "bas" } });
    expect(within(section).getByText("Bastion")).toBeInTheDocument();
    expect(within(section).queryByText("Cinder March")).toBeNull();
  });

  it("sort by name orders cards A–Z", async () => {
    ["Zulu", "Alder", "Mirren"].forEach((n) => useWriteme.getState().addProject(n));
    render(wrap());
    await selectOption(() => screen.getByLabelText(/sort/i), "Name A–Z");
    const h2 = screen.getByRole("heading", { name: "My worlds" });
    const grid = h2.parentElement!.nextElementSibling as HTMLElement;
    const cards = within(grid).getAllByRole("heading").map((h) => h.textContent);
    expect(cards).toEqual(["Alder", "Mirren", "Zulu"]);
  });

  it("keeps the sample-project invite in the empty worlds list", () => {
    render(wrap());
    expect(screen.getByText(/create your first world or load the sample/i)).toBeInTheDocument();
  });

  it("switches the whole library to Portuguese from the top-right toggle", async () => {
    render(wrap());
    fireEvent.click(screen.getByRole("button", { name: "Switch to Portuguese" }));

    expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Meus mundos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo mundo" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("pt-BR");
    expect(localStorage.getItem("writeme.lang")).toBe("pt-BR");
  });
});

describe("library backup", () => {
  it("offers an export button that downloads a JSON backup", async () => {
    act(() => { useWriteme.getState().addProject("Shimradis"); });
    let captured: Blob | null = null;
    const stub = (name: "createObjectURL" | "revokeObjectURL", impl: unknown) => {
      Object.defineProperty(URL, name, { value: impl, writable: true, configurable: true });
    };
    stub("createObjectURL", (blob: Blob) => { captured = blob; return "blob:fake"; });
    stub("revokeObjectURL", () => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(this: HTMLAnchorElement) {});
    render(wrap());
    fireEvent.click(screen.getByRole("button", { name: "Download backup" }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.getAttribute("download")).toMatch(/^writeme-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(captured as Blob);
    });
    const payload = JSON.parse(text);
    expect(payload.app).toBe("writeme");
    expect(payload.projects.map((p: { name: string }) => p.name)).toContain("Shimradis");
    delete (URL as unknown as Record<string, unknown>).createObjectURL;
    delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  });

  it("restore replaces the whole library from a backup file", async () => {
    act(() => { useWriteme.getState().addProject("Temporary"); });
    const exportBefore = useWriteme.getState().exportData();
    act(() => { useWriteme.getState().resetAll(); });
    render(wrap());
    fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));
    const input = screen.getByLabelText(/Restore from backup file/i) as HTMLInputElement;
    const file = new File([exportBefore], "backup.json", { type: "application/json" });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(useWriteme.getState().projects.map((p) => p.name)).toContain("Temporary");
    expect(useWriteme.getState().toasts.some((t) => /restored/i.test(t.message))).toBe(true);
  });

  it("restore rejects invalid files with an error toast", async () => {
    render(wrap());
    fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));
    const input = screen.getByLabelText(/Restore from backup file/i) as HTMLInputElement;
    const file = new File(["{not json"], "broken.json", { type: "application/json" });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await waitFor(() => expect(useWriteme.getState().toasts.some((t) => t.kind === "error")).toBe(true));
    expect(screen.getByRole("button", { name: "Download backup" })).toBeInTheDocument();
  });

  it("restore tells the user when the file cannot be read at all", async () => {
    render(wrap());
    fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));
    const readSpy = vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function broken(this: FileReader) {
      window.setTimeout(() => { (this.onerror as ((e: Event) => void) | null)?.(new Event("error")); }, 0);
    });
    const input = screen.getByLabelText(/Restore from backup file/i) as HTMLInputElement;
    const file = new File([""], "unreadable.json", { type: "application/json" });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    readSpy.mockRestore();
    await waitFor(() => expect(useWriteme.getState().toasts.some((t) => t.message.includes("read"))).toBe(true));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("restore needs a confirmation before replacing the library", async () => {
    const exportBefore = useWriteme.getState().exportData();
    render(wrap());
    fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));
    expect(screen.getByText(/replaces the whole library/i)).toBeInTheDocument();
    expect(useWriteme.getState().projects).toHaveLength(0);
    const input = screen.getByLabelText(/Restore from backup file/i) as HTMLInputElement;
    const file = new File([exportBefore], "backup.json", { type: "application/json" });
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(useWriteme.getState().toasts.some((t) => /restored/i.test(t.message))).toBe(true);
  });
});
