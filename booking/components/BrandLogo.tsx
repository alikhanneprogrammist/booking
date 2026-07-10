// Фирменный знак URS CRM: буква U — «чаша», внутри которой R и S
// (система, которая держит всех клиентов внутри себя). Вектор повторяет
// утверждённый макет (URS.PNG), палитра: navy #161B33 / blue #3E63FF / teal #13B8A6.
// Показывается по умолчанию там, где админ не загрузил свой logoUrl в настройках.
export default function BrandLogo({className = 'h-6 w-6 shrink-0'}: {className?: string}) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M17 8 L17 33 Q17 51 32 51 Q47 51 47 33 L47 8"
        stroke="#161B33"
        strokeWidth="6.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M27 28 L27 13 L32 13 Q37.5 13 37.5 16.75 Q37.5 20.5 32 20.5 L27 20.5 M32.5 20.5 L37.5 28"
        stroke="#3E63FF"
        strokeWidth="3.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36.5 34.5 Q36.5 32.5 32 32.5 Q27.5 32.5 27.5 35.5 Q27.5 38.5 32 38.5 Q36.5 38.5 36.5 41.5 Q36.5 44.5 32 44.5 Q27.5 44.5 27.5 42.5"
        stroke="#13B8A6"
        strokeWidth="3.3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
