import { Image } from 'expo-image';
import { useThemeColor } from 'heroui-native';
import { useRef, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel';

import { Button } from '@/components/ui/Button';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { Screen, SCREEN_HORIZONTAL_PADDING } from '@/components/ui/Screen';
import { markLandingSeen } from '@/lib/landingStorage';

type Slide = {
  // Slide 1 wears the app's own mark (mark.png) — the other two are icon
  // compositions in the token palette, not a second illustration style. See
  // AGENTS.md's Design posture: library/token-first, no new illustration set.
  image?: 'mark';
  icon?: IconSymbolName;
  headline: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    image: 'mark',
    headline: 'Stay ahead of your semester.',
    body: 'See your class schedule, assignments, and exams in one place, with reminders before things sneak up.',
  },
  {
    icon: 'checklist',
    headline: 'Add your own reminders.',
    body: 'Study blocks, prep sessions, personal tasks — set a nudge for anything you want to remember, tied to a course or entirely on its own.',
  },
  {
    icon: 'graduationcap.fill',
    headline: 'Built around your class.',
    body: 'Termio knows your program, level, and section, so what you see is what applies to you — nothing more, nothing less.',
  },
];

const BADGE_OUTER = 208;
const BADGE_INNER = 156;

// One consistent "halo ring + filled circle" badge behind every slide's visual — a
// very-low-opacity accent ring for depth, a solid accent-soft circle for contrast, and
// the mark/icon centred and shadowed on top. Slide 1 still wears the app's own
// full-colour mark rather than a single-tone IconSymbol (see AGENTS.md's Design
// posture — no second illustration style), but now sits in the exact same badge
// geometry as slides 2–3 instead of floating bare, so all three read as one sequence
// rather than two different treatments stitched together.
function SlideIllustration({ slide, accent, accentSoft }: { slide: Slide; accent: string; accentSoft: string }) {
  return (
    <View className="items-center justify-center" style={{ width: BADGE_OUTER, height: BADGE_OUTER }}>
      <View
        className="absolute rounded-full"
        style={{ width: BADGE_OUTER, height: BADGE_OUTER, backgroundColor: accent, opacity: 0.07 }}
      />
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: BADGE_INNER,
          height: BADGE_INNER,
          backgroundColor: accentSoft,
          shadowColor: accent,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 20,
          elevation: 6,
        }}>
        {slide.image === 'mark' ? (
          <Image source={require('@/assets/images/mark.png')} style={{ width: 88, height: 88 }} contentFit="contain" />
        ) : (
          <IconSymbol name={slide.icon!} size={60} color={accent} />
        )}
      </View>
    </View>
  );
}

function LandingSlide({ slide, accent, accentSoft }: { slide: Slide; accent: string; accentSoft: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-8" style={{ paddingHorizontal: SCREEN_HORIZONTAL_PADDING }}>
      <SlideIllustration slide={slide} accent={accent} accentSoft={accentSoft} />
      <Animated.View entering={FadeIn.duration(300)} className="gap-3">
        <Text className="text-center text-2xl font-bold text-foreground">{slide.headline}</Text>
        <Text className="text-center text-base leading-6 text-muted">{slide.body}</Text>
      </Animated.View>
    </View>
  );
}

// Active dot morphs into a pill (animated via Reanimated's layout transition, not a
// hard cut) rather than every dot just swapping colour — a small, standard bit of
// polish for a carousel indicator.
function DotIndicator({ count, activeIndex }: { count: number; activeIndex: number }) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      {Array.from({ length: count }, (_, index) => (
        <Animated.View
          key={index}
          layout={LinearTransition.duration(250)}
          className={index === activeIndex ? 'h-2 w-6 rounded-full bg-accent' : 'h-2 w-2 rounded-full bg-muted/30'}
        />
      ))}
    </View>
  );
}

// Shown ONCE per device, ever — before (auth), gated by lib/landingStorage.ts's
// AsyncStorage flag (device-level, not per-account, see hooks/use-auth-gate.ts). Not a
// "welcome, new user" screen: a returning device with a brand-new account still skips
// straight past this.
export default function LandingScreen() {
  const { width } = useWindowDimensions();
  const accent = useThemeColor('accent');
  const accentSoft = useThemeColor('accent-soft');
  const carouselRef = useRef<ICarouselInstance>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [carouselHeight, setCarouselHeight] = useState(0);
  const isLastSlide = activeIndex === SLIDES.length - 1;

  // No explicit navigation — flipping the flag re-evaluates useAuthGate (see
  // lib/landingStorage.ts's useSyncExternalStore wiring), which swaps the Stack.
  // Protected group in app/_layout.tsx from (landing) to (auth) on its own, the same
  // way signing out swaps (protected) for (auth) without an explicit router call.
  const finishLanding = () => {
    markLandingSeen();
  };

  return (
    <Screen horizontalPadding={0} bottomInset className="gap-6">
      <View className="flex-row justify-end pt-2" style={{ paddingHorizontal: SCREEN_HORIZONTAL_PADDING, height: 32 }}>
        {isLastSlide ? null : (
          <Pressable onPress={finishLanding} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip">
            <Text className="text-base font-medium text-accent">Skip</Text>
          </Pressable>
        )}
      </View>

      <View className="flex-1" onLayout={(event) => setCarouselHeight(event.nativeEvent.layout.height)}>
        {carouselHeight > 0 && (
          <Carousel
            ref={carouselRef}
            loop={false}
            width={width}
            height={carouselHeight}
            data={SLIDES}
            mode="parallax"
            modeConfig={{ parallaxScrollingScale: 0.92, parallaxScrollingOffset: 40 }}
            onSnapToItem={setActiveIndex}
            renderItem={({ item }) => <LandingSlide slide={item} accent={accent} accentSoft={accentSoft} />}
          />
        )}
      </View>

      <View className="gap-6 pb-2" style={{ paddingHorizontal: SCREEN_HORIZONTAL_PADDING }}>
        <DotIndicator count={SLIDES.length} activeIndex={activeIndex} />
        <Button
          onPress={isLastSlide ? finishLanding : () => carouselRef.current?.next()}
          icon={isLastSlide ? 'checkmark' : undefined}>
          {isLastSlide ? 'Get started' : 'Next'}
        </Button>
      </View>
    </Screen>
  );
}
