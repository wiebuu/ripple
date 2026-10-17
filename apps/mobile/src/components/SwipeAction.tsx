import { type ReactNode, useRef } from 'react';
import { Pressable } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import type { CampaignStatus } from '@shared';
import { canCancel, canDelete, cancelCampaign, cancelLabel, confirmDestructive, deleteDraft } from '@/lib/campaignActions';
import { useTheme } from '@/theme';
import { Icon, haptic, type IconName } from './ui';

/** Width of the revealed action area; the round button sits centred in it. */
const ACTION_W = 72;
const BUTTON = 44;

/**
 * A list row that reveals one destructive action as a round icon button when
 * swiped left. The button is pinned to the row's right edge, so it slides in
 * and out with the row instead of being left behind. With no `label`, the
 * row renders as-is (no swipe).
 */
export function SwipeAction({ label, icon = 'trash-outline', onPress, children }: { label?: string; icon?: IconName; onPress: () => void; children: ReactNode }) {
  const ref = useRef<SwipeableMethods>(null);
  if (!label) return <>{children}</>;
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.5}
      rightThreshold={ACTION_W / 2}
      overshootRight={false}
      onSwipeableWillOpen={() => haptic.light()}
      renderRightActions={(_progress, translation) => (
        <RightAction
          translation={translation}
          icon={icon}
          label={label}
          onPress={() => {
            ref.current?.close();
            onPress();
          }}
        />
      )}>
      {children}
    </ReanimatedSwipeable>
  );
}

function RightAction({ translation, icon, label, onPress }: { translation: SharedValue<number>; icon: IconName; label: string; onPress: () => void }) {
  const { c } = useTheme();
  // translation runs from 0 to -ACTION_W as the row moves left; offsetting by the width keeps the button attached to the row's edge.
  const follow = useAnimatedStyle(() => ({ transform: [{ translateX: translation.value + ACTION_W }] }));
  return (
    <Animated.View style={[{ width: ACTION_W, alignItems: 'center', justifyContent: 'center' }, follow]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => ({
          width: BUTTON,
          height: BUTTON,
          borderRadius: BUTTON / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.dangerSoft,
          borderWidth: 1,
          borderColor: c.danger,
          opacity: pressed ? 0.7 : 1,
        })}>
        <Icon name={icon} size={19} color={c.danger} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Swipe-left action for the user's own campaign rows: Delete for drafts,
 * Cancel for campaigns that can still be cancelled (backers are refunded),
 * nothing once funding has closed. Always asks for confirmation.
 */
export function OwnCampaignSwipe({ c, children }: { c: { id: string; title: string; status: CampaignStatus; raised: number }; children: ReactNode }) {
  const name = c.title || 'this draft';
  if (canDelete(c.status))
    return (
      <SwipeAction label={`Delete ${name}`} onPress={() => confirmDestructive(`Delete “${name}”?`, 'This draft will be removed. This can’t be undone.', 'Delete', () => deleteDraft(c.id))}>
        {children}
      </SwipeAction>
    );
  if (canCancel(c.status))
    return (
      <SwipeAction
        label={`${cancelLabel(c.status)}: ${name}`}
        icon="close-circle-outline"
        onPress={() =>
          confirmDestructive(
            `${cancelLabel(c.status)}?`,
            c.raised > 0 ? 'The campaign will close and every backer will be refunded in full. This can’t be undone.' : 'The campaign will close and won’t be published or advertised. This can’t be undone.',
            cancelLabel(c.status),
            () => cancelCampaign(c.id, c.raised),
          )
        }>
        {children}
      </SwipeAction>
    );
  return <>{children}</>;
}
