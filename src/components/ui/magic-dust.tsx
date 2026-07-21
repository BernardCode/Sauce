import PulsingBorder from "@/components/ui/pulsing-border";

export type MagicDustMood = "calm" | "urgent";

type MagicDustProps = {
  mood: MagicDustMood;
};

const pastelGreenShades = [
  "#9be8ad",
  "#74dc95",
  "#52d080",
  "#36bd6e",
  "#83e2a0",
];

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
      <div className="magic-dust-effect" aria-hidden="true">
        <PulsingBorder
          className="magic-dust-pulsing-border"
          colorBack="#00000000"
          colors={pastelGreenShades}
          roundness={0}
          thickness={0.28}
          softness={0.77}
          aspectRatio="auto"
          intensity={0.1}
          bloom={0.08}
          spots={4}
          spotSize={0.8}
          pulse={0.4}
          smoke={0.34}
          smokeSize={0.74}
          speed={0.52}
          scale={0.6}
        />
      </div>
    </div>
  );
}
