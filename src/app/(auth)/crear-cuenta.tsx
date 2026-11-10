import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { authErrorMessage, signUp } from '@/features/session/api';
import { fieldErrors, signUpSchema } from '@/features/session/validation';
import { Button, NidoMark, Screen, Text, TextField, space } from '@/ui';

type Field = 'name' | 'email' | 'password';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    setFormError(null);
    const parsed = signUpSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setErrors(fieldErrors<Field>(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const signedIn = await signUp(parsed.data.email, parsed.data.password, parsed.data.name);
      if (!signedIn) {
        setNeedsConfirmation(true);
        setLoading(false);
      }
    } catch (e) {
      setFormError(authErrorMessage(e));
      setLoading(false);
    }
  }

  if (needsConfirmation) {
    return (
      <Screen
        contentStyle={styles.content}
        footer={
          <Link href="/" replace asChild>
            <Button label="Ir a entrar" />
          </Link>
        }
      >
        <NidoMark />
        <Text variant="headline">Revisa tu correo</Text>
        <Text tone="muted">
          Te enviamos un enlace a {email.trim()}. Confírmalo y luego entra con tu contraseña.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      footer={
        <>
          <Button label="Crear cuenta" onPress={submit} loading={loading} />
          <Link href="/" replace asChild>
            <Button label="Ya tengo cuenta" variant="text" />
          </Link>
        </>
      }
    >
      <View style={styles.header}>
        <NidoMark />
        <Text variant="headline">Crea tu cuenta</Text>
        <Text tone="muted">Tu nombre firma lo que hagas en la casa.</Text>
      </View>

      <TextField
        label="Nombre"
        value={name}
        onChangeText={setName}
        error={errors.name}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="givenName"
        maxLength={40}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={emailRef}
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
        hint="Mínimo 6 caracteres."
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
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
