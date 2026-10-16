import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { Inter_400Regular_Italic } from '@expo-google-fonts/inter/400Regular_Italic';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingScreen } from '@/components/brand/LoadingScreen';
import { ToastHost } from '@/components/Toast';
import { queryClient } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { c, dark } = useTheme();
  const hydrated = useSession((s) => s.hydrated);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    Inter_400Regular_Italic, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold,
  });
  // Keep the branded loading screen up briefly so it reads as intentional, not a flash.
  const [minTimeDone, setMinTimeDone] = useState(false);
  const ready = (fontsLoaded || !!fontError) && hydrated && minTimeDone;

  useEffect(() => {
    // The native splash and LoadingScreen both follow light/dark, so the hand-off is seamless.
    SplashScreen.hideAsync();
    const t = setTimeout(() => setMinTimeDone(true), 1600);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return <LoadingScreen />;

  const navTheme = dark ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, background: c.bg, card: c.surface, text: c.text, border: c.border, primary: c.primary } }}>
            <StatusBar style={dark ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="back/result/[kid]" options={{ gestureEnabled: false, animation: 'fade' }} />
            </Stack>
            <ToastHost />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
