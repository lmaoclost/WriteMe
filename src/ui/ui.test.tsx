import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Field } from "./Field";
import { Modal } from "./Modal";
import { Toasts, toastKindAttr } from "./Toasts";
import { act, useScriptorium } from "../data/store";

describe("Button", () => {
  it("renders label and fires click", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("danger gets ember accent class", () => {
    render(<Button kind="danger">Excluir</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-danger");
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