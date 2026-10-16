import { router, useNavigation } from 'expo-router';

/**
 * Go to a screen without stacking duplicates: if the screen right below this
 * one is the same route with the same id, go back to it instead of pushing a
 * new copy (e.g. campaign page ⇄ Manage).
 */
export function useBackOrPush() {
  const navigation = useNavigation<any>();
  return (routeName: string, href: Parameters<typeof router.push>[0], id?: string) => {
    const state = navigation.getState?.();
    const prev = state?.routes?.[state.index - 1];
    if (prev && prev.name === routeName && (!id || prev.params?.id === id)) router.back();
    else router.push(href);
  };
}
