import type { CSSProperties } from "react";

export type MagicDustMood = "calm" | "urgent";

type MagicDustProps = {
  mood: MagicDustMood;
};

const particleOffsets = [
  [3, 1, 0],
  [9, 4, 1],
  [15, 2, 2],
  [22, 5, 3],
  [28, 1, 4],
  [36, 4, 5],
  [43, 2, 6],
  [51, 5, 7],
  [59, 1, 8],
  [66, 4, 9],
  [73, 2, 10],
  [81, 5, 11],
  [88, 1, 12],
  [95, 4, 13],
] as const;

/** A thin, decorative workload signal. The planner can provide the mood later. */
export function MagicDust({ mood }: MagicDustProps) {
  return (
    <div
      className="magic-dust"
      data-mood={mood}
      role="status"
      aria-label={
        mood === "urgent"
          ? "Today's workload needs attention."
          : "Today's workload is light."
      }
    >
      <div className="magic-dust-line" />
      <div className="magic-dust-particles" aria-hidden="true">
        {particleOffsets.map(([left, top, delay]) => (
          <span
            key={left}
            className="magic-dust-particle"
            style={
              {
                "--dust-left": `${left}%`,
                "--dust-top": `${top}px`,
                "--dust-delay": `${delay * -0.37}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
