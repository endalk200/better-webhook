const items = [
  "TYPE-SAFE",
  "LOCAL-FIRST",
  "OPEN SOURCE",
  "SECURE",
  "TYPESCRIPT",
  "ZERO BOILERPLATE",
  "FAST",
  "EXTENSIBLE",
];

export function Marquee() {
  const doubled = [...items, ...items];

  return (
    <div className="nb-marquee">
      <div className="nb-marquee-track">
        {doubled.map((item, i) => (
          <span key={i} className="nb-marquee-item">
            {item} <span className="nb-marquee-sep">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}
