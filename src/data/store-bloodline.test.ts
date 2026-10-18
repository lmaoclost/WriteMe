import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { useScriptorium, selectBLHistoryFlags } from "./store";
import { STORE_KEY, flushPendingPersist } from "./storage";
import { parseExport, validateProjectData } from "./schema";
import type { Bloodline, BloodlineHouse, BloodlinePerson, Project } from "../domain/types";

/**
 * Cases (plan Task 1):
 * 1. CRUD persons/houses full.
 * 2. movePerson has no history.
 * 3. movePerson push ordering (UI calls pushBLHistory first: test emulates).
 * 4. deletePerson cleans incoming links (connectedTo/siblingId/partnerId — SAME bloodline only).
 * 5. deleteBloodline drops history key + removes.
 * 6. setNotes.
 * 7. undo/redo restore (persons+houses snapshots deep-cloned — alias check).
 * 8. Cap 50.
 * 9. validateProjectData(export) after ops.
 */

const store = () => useScriptorium.getState();

function freshProject(): Project {
  return store().projects[0];
}
function addBloodline(name = "Vellmor"): string {
  let id!: string;
  act(() => { id = store().addBloodline(freshProject().id, name).id; });
  return id;
}
function addPerson(bloodlineId: string, init?: { x?: number; y?: number; name?: string; portraitKey?: string }): BloodlinePerson {
  let person!: BloodlinePerson;
  act(() => { person = store().addPerson(bloodlineId, init) as BloodlinePerson; });
  return person;
}
function addHouse(bloodlineId: string, init?: { x?: number; y?: number; name?: string }): BloodlineHouse {
  let house!: BloodlineHouse;
  act(() => { house = store().addHouse(bloodlineId, init) as BloodlineHouse; });
  return house;
}
function personOf(blId: string, personId: string): BloodlinePerson | undefined {
  return store().bloodlines.find((b) => b.id === blId)?.persons.find((p) => p.id === personId);
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
  act(() => { useScriptorium.getState().addProject("Shimradis"); });
});

describe("bloodline CRUD (case 1)", () => {
  it("addBloodline defaults name 'Untitled Bloodline' with empty persons/houses/notes", () => {
    let bl!: Bloodline;
    act(() => { bl = store().addBloodline(freshProject().id); });
    expect(bl.name).toBe("Untitled Bloodline");
    expect(bl.projectId).toBe(freshProject().id);
    expect(bl.persons).toEqual([]);
    expect(bl.houses).toEqual([]);
    expect(bl.notes).toBe("");
    expect(store().bloodlines).toHaveLength(1);
  });
  it("addBloodline accepts a name and touches project updatedAt", () => {
    const before = freshProject().updatedAt;
    act(() => { store().addBloodline(freshProject().id, "Casa Vellmor"); });
    expect(store().bloodlines[0].name).toBe("Casa Vellmor");
    expect(freshProject().updatedAt).toBeGreaterThanOrEqual(before);
  });
  it("renameBloodline renames only the target", () => {
    const a = addBloodline("A");
    addBloodline("B");
    act(() => { store().renameBloodline(a, "A2"); });
    expect(store().bloodlines.map((b) => b.name)).toEqual(["A2", "B"]);
  });
  it("case 5: deleteBloodline removes the bloodline and drops its history key", () => {
    const a = addBloodline();
    act(() => { store().pushBLHistory(a); });
    expect(Object.keys(store().histories)).toEqual([`bl_${a}`]);
    act(() => { store().deleteBloodline(a); });
    expect(store().bloodlines).toHaveLength(0);
    expect(Object.keys(store().histories)).toEqual([]);
  });
  it("case 6: setNotes writes the notes field", () => {
    const a = addBloodline();
    act(() => { store().setNotes(a, "primeiras notas"); });
    expect(store().bloodlines[0].notes).toBe("primeiras notas");
  });
});

describe("person CRUD (cases 1-4)", () => {
  it("addPerson defaults: x/y 4000, 'Sem nome', empty lists, badge off, not twin", () => {
    const a = addBloodline();
    const p = addPerson(a);
    expect(p.id).toMatch(/^per_/);
    expect(p.x).toBe(4000);
    expect(p.y).toBe(4000);
    expect(p.name).toBe("Sem nome");
    expect(p.additionalTitles).toEqual([]);
    expect(p.tenures).toEqual([]);
    expect(p.showBadge).toBe(false);
    expect(p.badgeText).toBe("");
    expect(p.isTwin).toBe(false);
  });
  it("addPerson accepts init overrides (x, y, name, portraitKey) and pushes undo history", () => {
    const a = addBloodline();
    const p = addPerson(a, { x: 100, y: 200, name: "Aldric", portraitKey: "img_entry_k1" });
    expect(p.x).toBe(100);
    expect(p.y).toBe(200);
    expect(p.name).toBe("Aldric");
    expect(p.portraitKey).toBe("img_entry_k1");
    expect(store().bloodlines[0].persons).toHaveLength(1);
    expect(selectBLHistoryFlags(a)(store())).toEqual({ canUndo: true, canRedo: false });
  });
  it("addPerson on a missing bloodline returns null", () => {
    let r: BloodlinePerson | null = {} as BloodlinePerson;
    act(() => { r = store().addPerson("bl_perdido"); });
    expect(r).toBeNull();
  });
  it("updatePerson patches scalars; arrays are deep-cloned (caller mutation is inert)", () => {
    const a = addBloodline();
    const p = addPerson(a);
    const titles = [{ title: "original" }];
    const tenures = [{ label: "Reinou", from: "1000", to: "1080" }];
    act(() => { store().updatePerson(p.id, { additionalTitles: titles, tenures, name: "Aldric", showBadge: true }); });
    titles[0].title = "sneaky";
    tenures[0].label = "sneaky";
    const person = personOf(a, p.id)!;
    expect(person.name).toBe("Aldric");
    expect(person.showBadge).toBe(true);
    expect(person.additionalTitles).toEqual([{ title: "original" }]);
    expect(person.tenures).toEqual([{ label: "Reinou", from: "1000", to: "1080" }]);
  });
  it("updatePerson on a missing person is inert", () => {
    addBloodline();
    act(() => { store().updatePerson("per_fantasma", { name: "X" }); });
    expect(store().bloodlines[0].persons).toEqual([]);
  });
  it("case 2: movePerson changes coords and pushes NO history", () => {
    const a = addBloodline();
    const p = addPerson(a, { x: 10, y: 20 });
    const flagsBefore = selectBLHistoryFlags(a)(store());
    act(() => { store().movePerson(p.id, 240, 180); });
    const person = personOf(a, p.id)!;
    expect(person.x).toBe(240);
    expect(person.y).toBe(180);
    expect(selectBLHistoryFlags(a)(store())).toEqual(flagsBefore);
  });
  it("case 3: UI push ordering emulated — pushBLHistory then movePerson; undo restores pre-move coords", () => {
    const a = addBloodline();
    const p = addPerson(a, { x: 100, y: 100 });
    act(() => { store().pushBLHistory(a); });
    act(() => { store().movePerson(p.id, 500, 300); });
    expect(personOf(a, p.id)!.x).toBe(500);
    act(() => { store().undoBL(a); });
    expect(personOf(a, p.id)!.x).toBe(100);
    expect(personOf(a, p.id)!.y).toBe(100);
  });
  it("case 4: deletePerson cleans incoming links within the SAME bloodline", () => {
    const a = addBloodline();
    const son = addPerson(a, { name: "Filho" });
    const sibling = addPerson(a, { name: "Irmão" });
    const partner = addPerson(a, { name: "Parceiro" });
    act(() => {
      store().updatePerson(son.id, {
        connectedTo: partner.id, siblingId: sibling.id, partnerId: partner.id,
      });
    });
    expect(personOf(a, son.id)!.connectedTo).toBe(partner.id);
    act(() => { store().deletePerson(partner.id); });
    const cleaned = personOf(a, son.id)!;
    expect(cleaned.connectedTo).toBeUndefined();
    expect(cleaned.partnerId).toBeUndefined();
    expect(cleaned.siblingId).toBe(sibling.id); // not pointing at deleted
    expect(store().bloodlines[0].persons).toHaveLength(2);
  });
  it("case 4: deletePerson does NOT touch links in OTHER bloodlines", () => {
    const a = addBloodline("A");
    const other = addBloodline("B");
    const p = addPerson(a, { name: "Morta" });
    const stranger = addPerson(other, { name: "Estrangeiro" });
    act(() => { store().updatePerson(stranger.id, { connectedTo: p.id, partnerId: p.id, siblingId: p.id }); });
    act(() => { store().deletePerson(p.id); });
    const untouched = store().bloodlines.find((b) => b.id === other)!.persons[0];
    expect(untouched.connectedTo).toBe(p.id);
    expect(untouched.partnerId).toBe(p.id);
    expect(untouched.siblingId).toBe(p.id);
  });
  it("deletePerson releases the portrait key from images when nothing else uses it", () => {
    const a = addBloodline();
    const keeper = addPerson(a, { portraitKey: "img_entry_shared" });
    const doomed = addPerson(a, { portraitKey: "img_entry_solo" });
    act(() => {
      useScriptorium.setState((s) => ({ images: { ...s.images, img_entry_shared: "A", img_entry_solo: "B" } }));
    });
    act(() => { store().deletePerson(doomed.id); });
    expect(personOf(a, keeper.id)!.portraitKey).toBe("img_entry_shared");
    expect(store().images["img_entry_solo"]).toBeUndefined();
    expect(store().images["img_entry_shared"]).toBe("A");
  });
});

describe("house CRUD (case 1)", () => {
  it("addHouse defaults: 'Casa sem nome', flags false; init overrides accepted", () => {
    const a = addBloodline();
    const h = addHouse(a);
    expect(h.id).toMatch(/^hou_/);
    expect(h.x).toBe(4000);
    expect(h.y).toBe(4000);
    expect(h.name).toBe("Casa sem nome");
    expect(h.isMainBranch).toBe(false);
    expect(h.isMonarch).toBe(false);
    const custom = addHouse(a, { x: 50, y: 60, name: "Vellmor" });
    expect(custom.name).toBe("Vellmor");
    expect(store().bloodlines[0].houses).toHaveLength(2);
  });
  it("updateHouse patches flags + subtitle; moveHouse changes coords and pushes NO history", () => {
    const a = addBloodline();
    const h = addHouse(a);
    const flagsBefore = selectBLHistoryFlags(a)(store());
    act(() => { store().updateHouse(h.id, { isMainBranch: true, subtitle: "Ramo principal" }); });
    act(() => { store().moveHouse(h.id, 90, 120); });
    const house = store().bloodlines[0].houses[0];
    expect(house.isMainBranch).toBe(true);
    expect(house.isMonarch).toBe(false);
    expect(house.subtitle).toBe("Ramo principal");
    expect(house.x).toBe(90);
    expect(house.y).toBe(120);
    expect(selectBLHistoryFlags(a)(store())).toEqual(flagsBefore);
  });
  it("deleteHouse pushes history; undo restores it", () => {
    const a = addBloodline();
    const h = addHouse(a);
    act(() => { store().deleteHouse(h.id); });
    expect(store().bloodlines[0].houses).toHaveLength(0);
    act(() => { store().undoBL(a); });
    expect(store().bloodlines[0].houses).toHaveLength(1);
  });
});

describe("history (cases 7-8)", () => {
  it("case 7: undo/redo restore persons AND houses from deep-cloned snapshots (alias check)", () => {
    const a = addBloodline();
    const p = addPerson(a, { name: "Aldric" });
    act(() => {
      store().updatePerson(p.id, { tenures: [{ label: "Reinou", from: "1000", to: "1080" }] });
    });
    act(() => { store().pushBLHistory(a); });
    // probe 1: corrupt the live tenure object in place
    store().bloodlines[0].persons[0].tenures[0].label = "corrompido";
    act(() => { store().undoBL(a); });
    expect(personOf(a, p.id)!.tenures).toEqual([{ label: "Reinou", from: "1000", to: "1080" }]);
    // probe 2: the undo moved the corrupted probe to the redo stack; corrupt live again
    store().bloodlines[0].persons[0].tenures[0].label = "v2";
    act(() => { store().redoBL(a); });
    // redo must apply the FIRST probe ("corrompido"), cloned before the second corruption
    expect(personOf(a, p.id)!.tenures[0].label).toBe("corrompido");
    // houses: same clone guarantees on restore
    addHouse(a, { name: "Solar" });
    act(() => { store().pushBLHistory(a); });
    store().bloodlines[0].houses[0].name = "corrompido";
    act(() => { store().undoBL(a); });
    expect(store().bloodlines[0].houses).toHaveLength(1);
    expect(store().bloodlines[0].houses[0].name).toBe("Solar");
  });
  it("case 7: undo pushes the current snapshot to redo; redo returns it", () => {
    const a = addBloodline();
    addPerson(a);
    act(() => { store().pushBLHistory(a); });
    act(() => { store().deletePerson(store().bloodlines[0].persons[0].id); });
    expect(store().bloodlines[0].persons).toHaveLength(0);
    act(() => { store().undoBL(a); });
    expect(store().bloodlines[0].persons).toHaveLength(1);
    act(() => { store().undoBL(a); });
    act(() => { store().undoBL(a); });
    expect(selectBLHistoryFlags(a)(store())).toEqual({ canUndo: false, canRedo: true });
    act(() => { store().redoBL(a); });
    expect(store().bloodlines[0].persons).toHaveLength(1);
    expect(selectBLHistoryFlags(a)(store())).toEqual({ canUndo: true, canRedo: true });
  });
  it("case 8: history caps at 50; new pushes clear redo", () => {
    const a = addBloodline();
    for (let i = 0; i < 55; i++) {
      act(() => { store().pushBLHistory(a); });
    }
    expect(store().histories[`bl_${a}`].undo.length).toBe(50);
    act(() => { store().pushBLHistory(a); });
    expect(store().histories[`bl_${a}`].undo.length).toBe(50);
  });
  it("pushBLHistory/undoBL on unknown bloodline ids are inert", () => {
    act(() => { store().pushBLHistory("bl_fantasma"); });
    act(() => { store().undoBL("bl_fantasma"); });
    expect(store().histories).toEqual({});
  });
  it("histories stay out of persistence (bl_ keys included)", () => {
    const a = addBloodline();
    act(() => { store().pushBLHistory(a); });
    flushPendingPersist();
    const raw = JSON.parse(localStorage.getItem(STORE_KEY)!) as { state: Record<string, unknown> };
    expect(raw.state.histories).toBeUndefined();
  });
});

describe("persistence + export (case 9)", () => {
  it("state init has bloodlines: []", () => {
    expect(useScriptorium.getInitialState().bloodlines).toEqual([]);
  });
  it("persisted doc is version 2 and carries bloodlines", () => {
    const a = addBloodline();
    addPerson(a, { name: "Fundador" });
    addHouse(a, { name: "Solar" });
    flushPendingPersist();
    const doc = JSON.parse(localStorage.getItem(STORE_KEY)!) as { version: number; state: { bloodlines: Bloodline[] } };
    expect(doc.version).toBe(2);
    expect(doc.state.bloodlines[0].persons).toHaveLength(1);
    expect(doc.state.bloodlines[0].houses).toHaveLength(1);
  });
  it("a v1 persisted doc migrates on rehydrate: bloodlines [] injected", () => {
    localStorage.clear();
    const doc = {
      state: {
        projects: [{ id: "prj_v1", name: "V1", description: "", createdAt: 1, updatedAt: 1 }],
        entries: [], atlases: [], manuscripts: [], images: {}, seedFlag: false,
      },
      version: 1,
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(doc));
    act(() => void useScriptorium.persist.rehydrate());
    const s = store();
    expect(s.projects[0].id).toBe("prj_v1");
    expect(s.bloodlines).toEqual([]);
  });
  it("a v2 persisted doc rehydrates with bloodlines", () => {
    localStorage.clear();
    const doc = {
      state: {
        projects: [], entries: [], atlases: [], manuscripts: [], images: {}, seedFlag: false,
        bloodlines: [{ id: "bl_v2", projectId: "prj_v1", name: "N", persons: [], houses: [], notes: "x" }],
      },
      version: 2,
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(doc));
    act(() => void useScriptorium.persist.rehydrate());
    expect(store().bloodlines[0].id).toBe("bl_v2");
  });
  it("case 9: exportData parses + validates after a full bloodline op chain", () => {
    const a = addBloodline("Vellmor");
    const father = addPerson(a, { name: "Aldric" });
    const son = addPerson(a, { name: "Bram" });
    addHouse(a, { name: "Solar" });
    act(() => { store().updatePerson(son.id, { connectedTo: father.id }); });
    act(() => { store().setNotes(a, "linhagem fundada"); });
    let text = "";
    act(() => { text = store().exportData(); });
    const parsed = parseExport(text);
    expect(validateProjectData(parsed)).toBe(true);
    expect(parsed.bloodlines![0].name).toBe("Vellmor");
    expect(parsed.bloodlines![0].persons).toHaveLength(2);
    expect(parsed.bloodlines![0].houses).toHaveLength(1);
    expect(parsed.bloodlines![0].persons.find((p) => p.id === son.id)?.connectedTo).toBe(father.id);
  });
});
