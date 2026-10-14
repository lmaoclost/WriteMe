export function Seal({ letter = "S" }: { letter?: string }) {
  return <span className="seal" aria-hidden="true">{letter}</span>;
}
