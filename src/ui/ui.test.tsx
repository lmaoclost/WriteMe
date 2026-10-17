import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Field } from "./Field";
import { Modal } from "./Modal";
import { Toasts, toastKindAttr } from "./Toasts";
import { useScriptorium } from "../data/store";

describe("Button", () => {
  it("renders label and fires click", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("danger gets ember accent classes", () => {
    render(<Button kind="danger">Excluir</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("border-destructive");
    expect(btn).toHaveClass("text-destructive");
  });
});

describe("Field / Modal", () => {
  it("field associates label", () => {
    render(<Field label="Nome"><input aria-label="Nome" /></Field>);
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });
  it("modal closes via close button", () => {
    const onClose = vi.fn();
    render(<Modal title="Excluir projeto" onClose={onClose}><p>confirmar</p></Modal>);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("modal closes on Escape keydown", () => {
    const onClose = vi.fn();
    render(<Modal title="Excluir projeto" onClose={onClose}><p>confirmar</p></Modal>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("modal closes on scrim click", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal title="Excluir projeto" onClose={onClose}><p>confirmar</p></Modal>
    );
    const overlay = (container.ownerDocument as Document).querySelector("[data-slot='dialog-overlay']");
    expect(overlay).not.toBeNull();
    // radix attaches its outside-press listener on a macrotask and defers
    // the dismissal to the follow-up click; jsdom lacks PointerEvent → raw events
    await new Promise((resolve) => setTimeout(resolve, 0));
    const down = new Event("pointerdown", { bubbles: true, cancelable: true }) as
      Event & { pointerType: string; button: number };
    down.pointerType = "mouse";
    down.button = 0;
    const click = new Event("click", { bubbles: true, cancelable: true });
    (overlay as Element).dispatchEvent(down);
    (overlay as Element).dispatchEvent(click);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Toasts", () => {
  it("shows pushed toasts with kind and dismisses", () => {
    render(<Toasts />);
    let id;
    act(() => { id = useScriptorium.getState().pushToast("error", "Falhou"); });
    const el = screen.getByText("Falhou").closest(toastKindAttr("error"));
    expect(el).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dispensar" }));
    const t = useScriptorium.getState().toasts;
    expect(t.map((x) => x.id)).not.toContain(id);
  });
});
