import {
  classifyCourse,
  type StudentCourse,
} from "../../lib/quick-add/course";

export type TaskIdentity = {
  emoji: string;
  label: string;
};

const COURSE_IDENTITIES: Record<StudentCourse, TaskIdentity> = {
  "AP Gov": { emoji: "🏛️", label: "AP Gov/Econ" },
  "AP Lit": { emoji: "📚", label: "AP Lit" },
  "AP Calc BC": { emoji: "🧮", label: "AP Calc BC" },
  "AP Physics C": { emoji: "⚛️", label: "AP Physics C" },
  Ceramics: { emoji: "🏺", label: "Ceramics" },
  PE: { emoji: "🏃", label: "PE" },
};

const COURSE_ALIASES: Record<string, StudentCourse> = {
  "ap gov": "AP Gov",
  "ap government": "AP Gov",
  "ap gov econ": "AP Gov",
  "ap gov/econ": "AP Gov",
  economics: "AP Gov",
  econ: "AP Gov",
  "ap lit": "AP Lit",
  english: "AP Lit",
  "ap calc bc": "AP Calc BC",
  "calc bc": "AP Calc BC",
  math: "AP Calc BC",
  bc: "AP Calc BC",
  "ap physics c": "AP Physics C",
  physics: "AP Physics C",
  ceramics: "Ceramics",
  ceramic: "Ceramics",
  pe: "PE",
  "physical education": "PE",
};

function normalizedCourse(course: string | null): string {
  return (course ?? "")
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function identifyTask(title: string, course: string | null): TaskIdentity {
  const explicitCourse = COURSE_ALIASES[normalizedCourse(course)];
  const inferredCourse =
    explicitCourse ?? classifyCourse(`${course ?? ""} ${title}`);
  if (inferredCourse) return COURSE_IDENTITIES[inferredCourse];

  const context = `${course ?? ""} ${title}`.toLowerCase();
  if (/\b(?:sat|psat)\b/.test(context)) return { emoji: "🎯", label: "SAT" };
  if (/\b(?:essay|essays|personal statement|piq)\b/.test(context)) {
    return { emoji: "✍️", label: "Essays" };
  }
  if (
    /\b(?:college|application|rice|counselor|transcript|naviance)\b/.test(
      context,
    )
  ) {
    return { emoji: "🎓", label: "College applications" };
  }
  if (/\b(?:digital security|cybersecurity)\b/.test(context)) {
    return { emoji: "🔐", label: "Digital Security" };
  }
  if (/\b(?:systems design|system design)\b/.test(context)) {
    return { emoji: "🧩", label: "Systems Design" };
  }
  if (/\b(?:hackathon|hackmit|cal hacks|pioneer hacks)\b/.test(context)) {
    return { emoji: "💻", label: "Hackathons" };
  }
  if (/\b(?:asl|fingerflow)\b/.test(context)) {
    return { emoji: "🤟", label: "ASL" };
  }
  if (/\b(?:tutor|bobtutor)\b/.test(context)) {
    return { emoji: "🤝", label: "Tutoring" };
  }
  if (/\b(?:personal admin|hcb|receipt|registration|rsvp)\b/.test(context)) {
    return { emoji: "📌", label: "Personal admin" };
  }
  return { emoji: "", label: "" };
}
