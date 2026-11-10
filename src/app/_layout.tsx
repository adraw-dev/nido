import { Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from '@expo-google-fonts/roboto';
import {
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
} from '@expo-google-fonts/schibsted-grotesk';
import { QueryClientProvider } from '@tanstack/react-query';
import { isRunningInExpoGo } from 'expo';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useMyMembership } from '@/features/household/hooks';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';
import { queryClient } from '@/lib/query';
import { supabase } from '@/lib/supabase';
import { Button, Screen, Text, useTheme } from '@/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});
// En Expo Go el splash no se puede personalizar; solo en builds propios (APK).
if (!isRunningInExpoGo()) {
  SplashScreen.setOptions({ duration: 200, fade: true });
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
  });

  return (
    <GestureHandlerRootView style={styles.flex}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <NavigationTheme>
            {fontsLoaded || fontError ? <RootNavigator /> : null}
          </NavigationTheme>
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function NavigationTheme({ children }: { children: React.ReactNode }) {
  const { scheme, colors } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.trunk,
      background: colors.bg,
      card: colors.bg,
      text: colors.ink,
      border: colors.rule,
    },
  };
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="auto" />
      {children}
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, loading: sessionLoading } = useSession();
  const membership = useMyMembership();

  const signedIn = !!session;
  const checkingHousehold = signedIn && membership.isPending;
  const ready = !sessionLoading && !checkingHousehold;
  const hasHousehold = !!membership.data;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  // Sin hogar confirmado por un error de red: no mandar a "crear hogar" por error.
  if (signedIn && membership.isError && !membership.data) {
    return (
      <ConnectionError
        error={membership.error}
        onRetry={() => membership.refetch()}
        retrying={membership.isFetching}
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasHousehold}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && hasHousehold}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

function ConnectionError({
  error,
  onRetry,
  retrying,
}: {
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { colors } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const detail = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error ?? '');
  // PGRST205: la tabla no existe → la migración no se aplicó en Supabase.
  const missingSchema = code === 'PGRST205' || code === '42P01';

  return (
    <Screen
      contentStyle={styles.center}
      footer={
        <>
          <Button label="Reintentar" onPress={onRetry} loading={retrying} />
          <Button
            label="Cerrar sesión"
            variant="text"
            loading={signingOut}
            onPress={async () => {
              setSigningOut(true);
              // signOut local: funciona aunque el usuario ya no exista en el servidor.
              await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
              setSigningOut(false);
            }}
          />
        </>
      }
    >
      <View style={[styles.cut, { backgroundColor: colors.danger }]} />
      <Text variant="headline">No pudimos cargar tu hogar</Text>
      <Text tone="muted">
        {missingSchema
          ? 'La base de datos todavía no tiene las tablas de Nido. Aplica la migración en Supabase (SQL Editor) y vuelve a intentar.'
          : 'Revisa tu conexión a internet y vuelve a intentar.'}
      </Text>
      {detail ? (
        <Text variant="caption" tone="subtle" selectable>
          {code ? `${code} · ` : ''}
          {detail}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: 'center' },
  cut: { width: 40, height: 6, borderRadius: 3 },
});
