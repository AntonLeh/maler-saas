type Props = { onImpressum: () => void; onDatenschutz: () => void; onAgb: () => void };

export default function AuthLegal({ onImpressum, onDatenschutz, onAgb }: Props) {
  return (
    <nav className="au-legal" aria-label="Rechtliches">
      <button type="button" onClick={onImpressum}>Impressum</button>
      <span aria-hidden>·</span>
      <button type="button" onClick={onDatenschutz}>Datenschutz</button>
      <span aria-hidden>·</span>
      <button type="button" onClick={onAgb}>AGB</button>
    </nav>
  );
}
