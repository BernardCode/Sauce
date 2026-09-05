const COURSE_RULES = [
  {
    course: "AP Gov",
    patterns: [
      /\bap\s+(?:u\.?s\.?\s+)?gov(?:ernment)?\b/,
      /\bap\s+(?:u\.?s\.?\s+)?government\s+(?:and\s+)?politics\b/,
      /\bgovernment\s+(?:and\s+)?politics\b/,
      /\bgov\b/,
      /\bgovernment\b/,
      /\bfederalism\b/,
      /\bconstitution(?:al)?\b/,
      /\bcongress(?:ional)?\b/,
      /\bscotus\b/,
      /\bsupreme court\b/,
      /\bcivil liberties\b/,
      /\bbureaucracy\b/,
      /\bpublic policy\b/,
      /\beconomics?\b/,
      /\bmacro(?:economics)?\b/,
      /\bmicro(?:economics)?\b/,
      /\bsupply and demand\b/,
      /\bfiscal policy\b/,
      /\bmonetary policy\b/,
    ],
  },
  {
    course: "AP Lit",
    patterns: [
      /\bap\s+lit(?:erature)?\b/,
      /\bap\s+english\s+lit(?:erature)?\b/,
      /\benglish\s+lit(?:erature)?\b/,
      /\blit\b/,
      /\bliterature\b/,
      /\bliterary\b/,
      /\bpoetry\b/,
      /\bpoem\b/,
      /\bprose analysis\b/,
      /\bclose reading\b/,
      /\bhamlet\b/,
      /\bfrankenstein\b/,
      /\bthe namesake\b/,
    ],
  },
  {
    course: "AP Calc BC",
    patterns: [
      /\bap\s+calc(?:ulus)?\s+bc\b/,
      /\bap\s+calculus\s+bc\b/,
      /\bcalc(?:ulus)?\s+bc\b/,
      /\bbc\b/,
      /\bcalc\b/,
      /\bcalculus\b/,
      /\bderivatives?\b/,
      /\bintegrals?\b/,
      /\blimits?\b/,
      /\btaylor series\b/,
      /\bmaclaurin\b/,
      /\bdifferential equations?\b/,
      /\bparametric equations?\b/,
    ],
  },
  {
    course: "AP Physics C",
    patterns: [
      /\bap\s+physics\s+c\b/,
      /\bap\s+physics\s+c[: -]+(?:mechanics|electricity|magnetism)\b/,
      /\bphysics\s+c\b/,
      /\bphysics\b/,
      /\bkinematics\b/,
      /\bnewton(?:'s)? laws?\b/,
      /\bmomentum\b/,
      /\btorque\b/,
      /\bfree body diagrams?\b/,
      /\bprojectile motion\b/,
      /\belectrostatics\b/,
      /\bmagnetism\b/,
      /\bcircuits?\b/,
    ],
  },
  {
    course: "Ceramics",
    patterns: [
      /\bceramics?\b/,
      /\bpottery\b/,
      /\bclay\b/,
      /\bkiln\b/,
      /\bglaze\b/,
      /\bwheel throwing\b/,
      /\bcoil pot\b/,
      /\bslab project\b/,
      /\bsculpt(?:ure|ing)\b/,
    ],
  },
  {
    course: "PE",
    patterns: [
      /(?:^|\s)p\.?e\.?(?:\s|$)/,
      /\bphysical education\b/,
      /\bfitness\b/,
      /\bmile run\b/,
      /\bworkout\b/,
      /\bcardio\b/,
      /\bpush[ -]?ups?\b/,
      /\bsit[ -]?ups?\b/,
      /\bbasketball\b/,
      /\bvolleyball\b/,
      /\bbadminton\b/,
    ],
  },
] as const;

export type StudentCourse = (typeof COURSE_RULES)[number]["course"];

export function classifyCourse(title: string): StudentCourse | null {
  const normalized = title.toLowerCase().replace(/[_/]+/g, " ");
  const matches = COURSE_RULES.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(normalized)),
  );

  return matches.length === 1 ? matches[0].course : null;
}
