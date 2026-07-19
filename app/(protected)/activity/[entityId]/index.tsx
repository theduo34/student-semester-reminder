import { useMutation, useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ListGroup, Separator, Skeleton, useThemeColor } from 'heroui-native';
import { Component, ReactNode, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { ActionSheet } from '@/components/shared/ActionSheet';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CoursePill } from '@/components/shared/CoursePill';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { Button } from '@/components/ui/Button';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { SCREEN_HORIZONTAL_PADDING } from '@/components/ui/Screen';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import { useAppToast } from '@/hooks/use-app-toast';
import { formatIntervalsSummary, Priority } from '@/lib/reminderIntervals';

type EntityKind = 'course' | 'semester' | 'personal';
type Resolved = NonNullable<FunctionReturnType<typeof api.activities.resolveById>>;

const ACTIVITY_TYPE_LABELS: Record<Doc<'courseActivities'>['activityType'], string> = {
  ASSIGNMENT: 'Assignment',
  QUIZ: 'Quiz',
  PROJECT: 'Project',
  EXAM: 'Exam',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function pluralize(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

// Calendar-day-aware, not just raw-ms-aware — "Due tomorrow" is a day-boundary concept,
// not a fixed 24h window, and an all-day semester activity (hasTime = false) has no
// time-of-day to compare against at all (its stored `date` field would otherwise look
// "overdue" the moment the day starts). Real-time countdown ticking isn't implemented —
// a snapshot at render time is consistent with how the rest of the app treats "now"
// (e.g. Home's semester-progress calculation), not a scope gap.
function computeCountdown(targetMs: number, now: number, hasTime: boolean) {
  const diff = targetMs - now;
  const dayDiff = Math.round((startOfLocalDay(targetMs) - startOfLocalDay(now)) / DAY_MS);
  const isOverdue = hasTime ? diff < 0 : dayDiff < 0;
  const isUrgent = hasTime ? isOverdue || diff <= DAY_MS : dayDiff <= 0;

  let label: string;
  if (isOverdue) {
    label = hasTime && dayDiff === 0 ? 'Overdue' : `Overdue by ${pluralize(Math.max(1, Math.abs(dayDiff)), 'day')}`;
  } else if (dayDiff === 0) {
    if (!hasTime) {
      label = 'Due today';
    } else if (diff < HOUR_MS) {
      label = `Due in ${pluralize(Math.max(1, Math.round(diff / MINUTE_MS)), 'minute')}`;
    } else {
      label = `Due in ${pluralize(Math.round(diff / HOUR_MS), 'hour')}`;
    }
  } else if (dayDiff === 1) {
    label = 'Due tomorrow';
  } else {
    label = `Due in ${pluralize(dayDiff, 'day')}`;
  }

  return { label, isOverdue, isUrgent };
}

function formatFullDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatShortDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatClockTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

type ViewModel = {
  kind: EntityKind;
  title: string;
  typeLabel: string;
  priority: Priority;
  notes?: string;
  course: { code: string; title: string; colour: string } | null;
  targetMs: number;
  hasTime: boolean;
  endMs?: number;
  isCompleted?: boolean;
  reminderScope: string | null;
};

function buildViewModel(resolved: Resolved): ViewModel {
  const course = resolved.course ? { code: resolved.course.courseCode, title: resolved.course.courseTitle, colour: resolved.course.colourTag } : null;

  if (resolved.kind === 'course') {
    const { activity } = resolved;
    return {
      kind: 'course',
      title: activity.title,
      typeLabel: `Activity type: ${ACTIVITY_TYPE_LABELS[activity.activityType]}`,
      priority: activity.priority,
      notes: activity.notes,
      course,
      targetMs: activity.dueDate,
      hasTime: true,
      isCompleted: activity.status === 'COMPLETED',
      reminderScope: null,
    };
  }

  if (resolved.kind === 'personal') {
    const { activity } = resolved;
    return {
      kind: 'personal',
      title: activity.title,
      typeLabel: 'Personal reminder',
      priority: activity.priority,
      notes: activity.description,
      course,
      targetMs: activity.startTime,
      hasTime: true,
      endMs: activity.endTime,
      isCompleted: activity.isCompleted,
      reminderScope: course ? `Linked to ${course.code}` : null,
    };
  }

  const { activity } = resolved;
  return {
    kind: 'semester',
    title: activity.title,
    typeLabel: 'Institutional event',
    priority: 'CRITICAL',
    notes: activity.description,
    course: null,
    targetMs: activity.date,
    hasTime: false,
    reminderScope: null,
  };
}

// One route, branching render by resolved kind — not three screens to keep in sync.
// See AGENTS.md's "Activity details routing" section. `type` is accepted as a
// navigation hint (set by Home/Calendar card taps and notification payloads) but never
// trusted: api.activities.resolveById re-derives the real kind server-side against all
// three owning tables, since the param can be missing or stale (e.g. a queued
// notification tapped long after the entity's id was last valid).
export default function ActivityDetailsScreen() {
  const { entityId } = useLocalSearchParams<{ entityId: string; type?: EntityKind }>();
  const router = useRouter();
  const { showError } = useAppToast();
  const [attempt, setAttempt] = useState(0);

  return (
    <ActivityErrorBoundary
      key={attempt}
      onError={() => showError('Could not load this activity')}
      fallback={
        <View className="flex-1 bg-background">
          <ActivityEmptyState
            title="Something went wrong"
            message="We couldn't load this activity. Check your connection and try again."
            onBack={() => router.back()}
            onRetry={() => setAttempt((current) => current + 1)}
          />
        </View>
      }>
      <ActivityDetailsContent entityId={entityId} />
    </ActivityErrorBoundary>
  );
}

function ActivityDetailsContent({ entityId }: { entityId: string }) {
  const router = useRouter();
  const { showSuccess, showError } = useAppToast();
  const insets = useSafeAreaInsets();
  const muted = useThemeColor('muted');

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTogglingComplete, setIsTogglingComplete] = useState(false);

  const resolved = useQuery(api.activities.resolveById, { entityId });

  const toggleReminderComplete = useMutation(api.personalReminders.toggleComplete).withOptimisticUpdate(
    (localStore, { reminderId }) => {
      const current = localStore.getQuery(api.activities.resolveById, { entityId });
      if (current && current.kind === 'personal' && current.activity._id === reminderId) {
        localStore.setQuery(api.activities.resolveById, { entityId }, {
          ...current,
          activity: { ...current.activity, isCompleted: !current.activity.isCompleted },
        });
      }
    },
  );
  const updateCourseActivityStatus = useMutation(api.courseActivities.updateStatus).withOptimisticUpdate(
    (localStore, { activityId, status }) => {
      const current = localStore.getQuery(api.activities.resolveById, { entityId });
      if (current && current.kind === 'course' && current.activity._id === activityId) {
        localStore.setQuery(api.activities.resolveById, { entityId }, {
          ...current,
          activity: { ...current.activity, status },
        });
      }
    },
  );
  const removeReminder = useMutation(api.personalReminders.remove);

  const viewModel = resolved ? buildViewModel(resolved) : null;

  const menu =
    resolved && resolved.kind === 'personal' ? (
      <ActionSheet
        trigger={
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Activity actions"
            // The native header can otherwise leave a default background/highlight
            // behind a custom headerRight touchable — force it transparent so this
            // reads the same bare-icon way AppTopBar's back button does, with matching
            // press feedback instead of none.
            style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, backgroundColor: 'transparent' })}>
            <IconSymbol name="ellipsis" color={muted} size={20} />
          </Pressable>
        }
        actions={[
          {
            key: 'edit',
            label: 'Edit',
            icon: 'pencil',
            onSelect: () => router.push({ pathname: '/edit-activity/[entityId]', params: { entityId } }),
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: 'trash',
            variant: 'danger',
            onSelect: () => setIsDeleteDialogOpen(true),
          },
        ]}
      />
    ) : undefined;

  const handleToggleReminder = async () => {
    if (!resolved || resolved.kind !== 'personal') return;
    setIsTogglingComplete(true);
    try {
      await toggleReminderComplete({ reminderId: resolved.activity._id });
    } catch {
      showError('Could not update — try again');
    } finally {
      setIsTogglingComplete(false);
    }
  };

  const handleToggleCourseStatus = async () => {
    if (!resolved || resolved.kind !== 'course') return;
    setIsTogglingComplete(true);
    try {
      await updateCourseActivityStatus({
        activityId: resolved.activity._id,
        status: resolved.activity.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED',
      });
    } catch {
      showError('Could not update — try again');
    } finally {
      setIsTogglingComplete(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      {/* Native header (registered in app/(protected)/_layout.tsx) provides the back
          button and title — this just overrides its headerRight reactively, since the
          menu depends on `resolved`, which the layout doesn't have. */}
      <Stack.Screen options={{ headerRight: () => menu ?? null }} />

      {resolved === undefined ? (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SCREEN_HORIZONTAL_PADDING }}
          contentContainerClassName="gap-6 pt-4 pb-6">
          <ActivityDetailsSkeleton />
        </ScrollView>
      ) : resolved === null ? (
        <ActivityEmptyState
          title="This activity is no longer available"
          message="It may have been removed, or the link is out of date."
          onBack={() => router.back()}
        />
      ) : viewModel ? (
        <>
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: SCREEN_HORIZONTAL_PADDING }}
            contentContainerClassName="gap-6 pt-4 pb-6">
            <ActivityHero viewModel={viewModel} />
            <CountdownCard viewModel={viewModel} />
            <ActivityInfoRows viewModel={viewModel} />
            {viewModel.notes ? (
              <View className="rounded-md bg-surface-secondary p-4">
                <Text className="text-sm leading-relaxed text-foreground">{viewModel.notes}</Text>
              </View>
            ) : null}
          </ScrollView>

          {viewModel.kind === 'semester' ? null : (
            <View
              className="flex-row gap-3 border-t border-border bg-surface"
              style={{
                paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
                paddingTop: 12,
                paddingBottom: insets.bottom + 12,
              }}>
              {viewModel.kind === 'personal' ? (
                <>
                  <View className="flex-1">
                    <Button
                      variant="secondary"
                      icon="pencil"
                      onPress={() => router.push({ pathname: '/edit-activity/[entityId]', params: { entityId } })}>
                      Edit
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button
                      icon="checkmark"
                      onPress={handleToggleReminder}
                      isLoading={isTogglingComplete}
                      loadingLabel="Updating…">
                      {viewModel.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                    </Button>
                  </View>
                </>
              ) : (
                <Button
                  icon="checkmark"
                  onPress={handleToggleCourseStatus}
                  isLoading={isTogglingComplete}
                  loadingLabel="Updating…">
                  {viewModel.isCompleted ? 'Mark incomplete' : 'Mark complete'}
                </Button>
              )}
            </View>
          )}

          <ConfirmDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            title="Delete this reminder?"
            message="This can't be undone."
            confirmLabel="Delete"
            onConfirm={async () => {
              if (resolved.kind !== 'personal') return;
              try {
                await removeReminder({ reminderId: resolved.activity._id });
                showSuccess('Reminder deleted');
                router.back();
              } catch {
                showError('Could not delete — try again');
                throw new Error('delete failed');
              }
            }}
          />
        </>
      ) : null}
    </View>
  );
}

function ActivityHero({ viewModel }: { viewModel: ViewModel }) {
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center gap-2">
        <PriorityBadge priority={viewModel.priority} />
        {viewModel.course ? (
          <CoursePill courseCode={viewModel.course.code} courseTitle={viewModel.course.title} colour={viewModel.course.colour} />
        ) : null}
      </View>
      <Text className="text-2xl font-bold leading-snug text-foreground">{viewModel.title}</Text>
      <Text className="text-sm text-muted">{viewModel.typeLabel}</Text>
    </View>
  );
}

function CountdownCard({ viewModel }: { viewModel: ViewModel }) {
  const [critical, criticalForeground] = useCSSVariable(['--critical', '--critical-foreground']) as [string, string];
  const muted = useThemeColor('muted');
  const foreground = useThemeColor('foreground');

  const countdown = computeCountdown(viewModel.targetMs, Date.now(), viewModel.hasTime);
  const icon: IconSymbolName = countdown.isOverdue
    ? 'exclamationmark.circle.fill'
    : countdown.isUrgent
      ? 'exclamationmark.triangle.fill'
      : 'calendar';

  const dateLabel = !viewModel.hasTime
    ? `${formatFullDate(viewModel.targetMs)} — All day`
    : viewModel.endMs !== undefined
      ? `${formatFullDate(viewModel.targetMs)} — ${formatClockTime(viewModel.targetMs)} – ${formatClockTime(viewModel.endMs)}`
      : `${formatFullDate(viewModel.targetMs)} — ${formatClockTime(viewModel.targetMs)}`;

  return (
    <View
      className={`flex-row items-center gap-3 rounded-md border p-4 ${
        countdown.isUrgent ? 'border-critical/20 bg-critical/10' : 'border-border bg-surface'
      }`}>
      <IconSymbol name={icon} size={24} color={countdown.isUrgent ? critical : muted} />
      <View className="flex-1 gap-1">
        <Text className="text-lg font-bold" style={{ color: countdown.isUrgent ? criticalForeground : foreground }}>
          {countdown.label}
        </Text>
        <Text className={`text-sm ${countdown.isUrgent ? 'text-critical-foreground/80' : 'text-muted'}`}>
          {dateLabel}
        </Text>
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value, mutedValue }: { icon: IconSymbolName; label: string; value: string; mutedValue?: boolean }) {
  const muted = useThemeColor('muted');
  return (
    <ListGroup.Item disabled>
      <ListGroup.ItemPrefix>
        <IconSymbol name={icon} size={16} color={muted} />
      </ListGroup.ItemPrefix>
      {/* ItemContent's flex-1 alone lets it shrink below the label's natural width once
          the suffix value is long, wrapping the label letter-by-letter instead of on
          word boundaries — numberOfLines on both sides forces each to truncate on one
          line instead, and the suffix gets a max-width so it can't crowd the label out
          entirely. */}
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle className="text-sm font-normal text-muted" numberOfLines={1}>
          {label}
        </ListGroup.ItemTitle>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix style={{ maxWidth: '55%' }}>
        <Text className={`text-sm font-medium ${mutedValue ? 'text-muted' : 'text-foreground'}`} numberOfLines={1}>
          {value}
        </Text>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}

// Only the rows that apply to this activity are rendered — a row whose value would be
// "N/A"/"—" is noise, not information (see AGENTS.md's UX conventions).
function ActivityInfoRows({ viewModel }: { viewModel: ViewModel }) {
  const reminderIntervals = useQuery(api.reminders.getPreferences, { priority: viewModel.priority });
  const intervalsSummary = reminderIntervals ? formatIntervalsSummary(reminderIntervals) : undefined;

  const dueDateValue = viewModel.hasTime
    ? `${formatShortDate(viewModel.targetMs)}, ${formatClockTime(viewModel.targetMs)}`
    : formatShortDate(viewModel.targetMs);

  const priorityValue =
    viewModel.priority === 'CRITICAL'
      ? 'Critical · Non-dismissible'
      : viewModel.priority === 'IMPORTANT'
        ? 'Important'
        : 'Flexible';

  const rows: { key: string; icon: IconSymbolName; label: string; value: string; mutedValue?: boolean }[] = [
    { key: 'due', icon: 'calendar', label: 'Due date', value: dueDateValue },
    { key: 'priority', icon: 'flag.fill', label: 'Priority', value: priorityValue },
  ];

  if (intervalsSummary !== undefined) {
    rows.push({
      key: 'reminder',
      icon: 'bell',
      label: 'Reminder',
      value: intervalsSummary,
      mutedValue: reminderIntervals?.length === 0,
    });
  }

  if (viewModel.course) {
    rows.push({ key: 'course', icon: 'books.vertical.fill', label: 'Course', value: viewModel.course.code });
  }

  if (viewModel.reminderScope) {
    rows.push({ key: 'scope', icon: 'link', label: 'Reminder scope', value: viewModel.reminderScope });
  }

  return (
    <ListGroup className="rounded-md">
      {rows.map((row, index) => (
        <View key={row.key}>
          {index > 0 ? <Separator className="mx-4" /> : null}
          <InfoRow icon={row.icon} label={row.label} value={row.value} mutedValue={row.mutedValue} />
        </View>
      ))}
    </ListGroup>
  );
}

function ActivityEmptyState({
  title,
  message,
  onBack,
  onRetry,
}: {
  title: string;
  message: string;
  onBack: () => void;
  onRetry?: () => void;
}) {
  const muted = useThemeColor('muted');
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6">
      <IconSymbol name="info.circle" size={40} color={muted} />
      <Text className="text-center text-base font-bold text-foreground">{title}</Text>
      <Text className="text-center text-sm text-muted">{message}</Text>
      <View className="mt-2 flex-row gap-3">
        <Button variant="secondary" fullWidth={false} onPress={onBack}>
          Go back
        </Button>
        {onRetry ? (
          <Button fullWidth={false} onPress={onRetry}>
            Retry
          </Button>
        ) : null}
      </View>
    </View>
  );
}

function ActivityDetailsSkeleton() {
  return (
    <View className="gap-6">
      <View className="gap-3">
        <View className="flex-row gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-36 rounded-full" />
        </View>
        <Skeleton className="h-7 w-3/4 rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
      </View>
      <Skeleton className="h-20 w-full rounded-md" />
      <Skeleton className="h-48 w-full rounded-md" />
      <Skeleton className="h-16 w-full rounded-md" />
    </View>
  );
}

// A thrown error inside ActivityDetailsContent (a malformed query response, a bug in a
// downstream mutation call) has nowhere else to go — Convex's useQuery propagates a
// query-level error as a render-time throw, which only a class-component boundary can
// catch (no hook equivalent exists). Remounting via the parent's `key` bump is the
// standard React reset mechanism for this, not a custom retry method here.
type ActivityErrorBoundaryProps = { children: ReactNode; fallback: ReactNode; onError?: () => void };
type ActivityErrorBoundaryState = { hasError: boolean };

class ActivityErrorBoundary extends Component<ActivityErrorBoundaryProps, ActivityErrorBoundaryState> {
  state: ActivityErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
