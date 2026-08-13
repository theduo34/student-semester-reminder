import { useQuery } from 'convex/react';
import { Dialog, Skeleton, useThemeColor } from 'heroui-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

type AcademicPeriodPickerProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** The semester currently being viewed, so reopening the picker starts on its year/semester. Null means "current". */
  selectedSemesterId: Id<'semesters'> | null;
  onSelect: (semesterId: Id<'semesters'>) => void;
  onViewCurrent: () => void;
};

type Step = 'year' | 'semester';

// The Academic Year Progress screen's three-dot menu opens this — a small Dialog with
// a two-step list: pick an academic year, then pick that year's semester. An earlier
// version used two nested heroui Select popovers inside the Dialog, but a Select's own
// popover Portal rendering on top of a Dialog's Portal didn't display reliably (the
// two portals compete for the same overlay layer) — plain pressable rows sidestep that
// entirely and read more like a "menu" besides, matching how ActionSheet elsewhere in
// this app is also just a flat list of rows, not a form control.
export function AcademicPeriodPicker({
  isOpen,
  onOpenChange,
  selectedSemesterId,
  onSelect,
  onViewCurrent,
}: AcademicPeriodPickerProps) {
  const years = useQuery(api.academicYears.listAllForSelection);
  const accent = useThemeColor('accent');
  const muted = useThemeColor('muted');
  const [step, setStep] = useState<Step>('year');
  const [yearId, setYearId] = useState<Id<'academicYears'> | null>(null);

  // Re-derive where to start each time the dialog opens: if the screen is currently
  // showing a specific semester, jump straight to that semester's year's list so
  // reselecting within the same year doesn't require re-picking the year too.
  useEffect(() => {
    if (!isOpen || years === undefined) return;
    const owningYear = selectedSemesterId
      ? years.find((year) => year.semesters.some((semester) => semester._id === selectedSemesterId))
      : undefined;
    setYearId(owningYear?._id ?? null);
    setStep(owningYear ? 'semester' : 'year');
  }, [isOpen, years, selectedSemesterId]);

  const selectedYear = years?.find((year) => year._id === yearId) ?? null;

  const handlePickYear = (id: Id<'academicYears'>) => {
    setYearId(id);
    setStep('semester');
  };

  const handlePickSemester = (id: Id<'semesters'>) => {
    onSelect(id);
    onOpenChange(false);
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="rounded-md">
          <View className="mb-4 gap-1.5">
            {step === 'semester' ? (
              <Pressable
                hitSlop={8}
                onPress={() => setStep('year')}
                className="mb-1 flex-row items-center gap-1 self-start">
                <IconSymbol name="chevron.left" size={14} color={accent} />
                <Text className="text-xs font-semibold text-accent">All academic years</Text>
              </Pressable>
            ) : null}
            <Dialog.Title>{step === 'year' ? 'Choose an academic year' : (selectedYear?.title ?? 'Choose a semester')}</Dialog.Title>
            <Dialog.Description>
              {step === 'year'
                ? 'Pick a year published by your institution to see its semesters.'
                : 'Pick which semester to view progress for.'}
            </Dialog.Description>
          </View>

          {years === undefined ? (
            <View className="gap-2">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </View>
          ) : years.length === 0 ? (
            <Text className="text-sm text-muted">No academic years have been published yet.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {step === 'year'
                  ? years.map((year) => (
                      <Pressable
                        key={year._id}
                        onPress={() => handlePickYear(year._id)}
                        className="flex-row items-center justify-between rounded-md border border-border bg-surface px-4 py-3 active:opacity-60">
                        <Text className="text-sm font-medium text-foreground">{year.title}</Text>
                        <IconSymbol name="chevron.right" size={16} color={muted} />
                      </Pressable>
                    ))
                  : selectedYear?.semesters.map((semester) => {
                      const isSelected = semester._id === selectedSemesterId;
                      return (
                        <Pressable
                          key={semester._id}
                          onPress={() => handlePickSemester(semester._id)}
                          className={`flex-row items-center justify-between rounded-md border px-4 py-3 active:opacity-60 ${
                            isSelected ? 'border-accent bg-accent/5' : 'border-border bg-surface'
                          }`}>
                          <View className="flex-row items-center gap-2">
                            <Text className="text-sm font-medium text-foreground">{semester.title}</Text>
                            {semester.isActive ? (
                              <View className="rounded-full bg-accent/15 px-2 py-0.5">
                                <Text className="text-[10px] font-semibold uppercase text-accent">Current</Text>
                              </View>
                            ) : null}
                          </View>
                          {isSelected ? <IconSymbol name="checkmark" size={16} color={accent} /> : null}
                        </Pressable>
                      );
                    })}
              </View>
            </ScrollView>
          )}

          <View className="mt-5">
            <Button
              variant="secondary"
              onPress={() => {
                onViewCurrent();
                onOpenChange(false);
              }}>
              View current semester
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
