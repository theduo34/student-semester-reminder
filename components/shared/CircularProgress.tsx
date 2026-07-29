import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';

type CircularProgressProps = {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
};

// A themed completion ring, built directly on react-native-svg (already a project
// dependency, see AGENTS.md's Library-first rule) rather than adding a third-party
// progress library — every ready-made one takes raw colour props, not this app's
// semantic CSS-variable tokens, so there'd be no less code either way, and this stays
// consistent with every other themed value in the app instead of a one-off hex string.
// Fully round shape — exempt from the rounded-md card convention (see AGENTS.md's
// Design posture).
export function CircularProgress({ percent, size = 120, strokeWidth = 12, label }: CircularProgressProps) {
  const [accent, track] = useCSSVariable(['--accent', '--border']) as [string, string];
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          // Rotated so the arc starts at 12 o'clock — svg circles otherwise start
          // drawing from 3 o'clock.
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text className="text-2xl font-bold text-foreground">{clamped}%</Text>
      {label ? <Text className="text-xs text-muted">{label}</Text> : null}
    </View>
  );
}
