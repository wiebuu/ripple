import { useNavigation } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * Runs when the user taps the tab of the screen they are already on.
 * Tab screens use it to scroll back to the top and refresh, like most social apps.
 */
export function useTabReselect(onReselect: () => void) {
  const navigation = useNavigation<any>();
  const cb = useRef(onReselect);
  useEffect(() => {
    cb.current = onReselect;
  });
  useEffect(() => {
    return navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) cb.current();
    });
  }, [navigation]);
}
