import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { authErrorMessage, signIn } from '@/features/session/api';
import { fieldErrors, signInSchema } from '@/features/session/validation';
import { Button, NidoWordmark, Screen, Text, TextField, space } from '@/ui';

type Field = 'email' | 'password';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors<Field>(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      // El layout raíz cambia de grupo solo al detectar la sesión.
    } catch (e) {
      setFormError(authErrorMessage(e));
      setLoading(false);
    }
  }

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      footer={
        <>
          <Button label="Entrar" onPress={submit} loading={loading} />
          <Link href="/crear-cuenta" replace asChild>
            <Button label="Crear una cuenta" variant="text" />
          </Link>
        </>
      }
    >
      <View style={styles.header}>
        <NidoWordmark />
        <Text tone="muted">La casa de los dos, en una sola línea.</Text>
      </View>

      <TextField
        label="Correo"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={passwordRef}
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {formError ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {formError}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: space.xxxl,
  },
  header: {
    gap: space.sm,
    marginBottom: space.lg,
  },
});
