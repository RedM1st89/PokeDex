import { useAuth } from '@/context/AuthContext';
import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { user, signIn, signUp, signInWithGoogle } = useAuth();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 500;

  // If user is already logged in, redirect to main app
  if (user) {
    return <Redirect href="/" />;
  }

  const handleAuth = async () => {
    // Clear previous error
    setErrorMessage('');

    // Validation
    if (!email || !password) {
      const error = 'Please fill in all fields';
      setErrorMessage(error);
      Alert.alert('Error', error);
      return;
    }

    if (!isLogin && !displayName) {
      const error = 'Please enter a display name';
      setErrorMessage(error);
      Alert.alert('Error', error);
      return;
    }

    if (password.length < 6) {
      const error = 'Password must be at least 6 characters';
      setErrorMessage(error);
      Alert.alert('Error', error);
      return;
    }

    // Password confirmation check for signup
    if (!isLogin && password !== confirmPassword) {
      const error = 'Passwords do not match';
      setErrorMessage(error);
      Alert.alert('Error', error);
      return;
    }

    setLoading(true);
    console.log('Starting authentication...', { isLogin, email });

    try {
      if (isLogin) {
        console.log('Attempting sign in...');
        await signIn(email, password);
        console.log('Sign in successful');
        Alert.alert('Success', 'Logged in successfully!');
      } else {
        console.log('Attempting sign up...');
        await signUp(email, password, displayName);
        console.log('Sign up successful');
        Alert.alert('Success', 'Account created successfully!');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      const errorMsg = error.message || error.toString() || 'Authentication failed';
      setErrorMessage(errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
      console.log('Authentication process completed');
    }
  };

  const handleGoogleSignIn = async () => {
    // Prevent action on Android
    if (Platform.OS === 'android') {
      return;
    }

    setErrorMessage('');
    setLoading(true);
    console.log('Starting Google sign-in...');

    try {
      await signInWithGoogle();
      console.log('Google sign-in successful');
      Alert.alert('Success', 'Signed in with Google!');
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      const errorMsg = error.message || error.toString() || 'Failed to sign in with Google';
      setErrorMessage(errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
      console.log('Google sign-in process completed');
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setErrorMessage('');
    setConfirmPassword('');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isSmallScreen && styles.containerMobile]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isSmallScreen && styles.scrollContentMobile,
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.authContainer, isSmallScreen && styles.authContainerMobile]}>
          <Text style={[styles.title, isSmallScreen && styles.titleMobile]}>Pokédex</Text>
          <Text style={[styles.subtitle, isSmallScreen && styles.subtitleMobile]}>
            {isLogin ? 'Welcome Back!' : 'Create Account'}
          </Text>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <TextInput
          style={[styles.input, isSmallScreen && styles.inputMobile]}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setErrorMessage('');
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
          testID="email-input"
        />

        <TextInput
          style={[styles.input, isSmallScreen && styles.inputMobile]}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setErrorMessage('');
          }}
          secureTextEntry
          editable={!loading}
          testID="password-input"
        />

        {!isLogin && (
          <>
            <TextInput
              style={[styles.input, isSmallScreen && styles.inputMobile]}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setErrorMessage('');
              }}
              secureTextEntry
              editable={!loading}
              testID="confirm-password-input"
            />
            <TextInput
              style={[styles.input, isSmallScreen && styles.inputMobile]}
              placeholder="Display Name"
              placeholderTextColor="#999"
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                setErrorMessage('');
              }}
              editable={!loading}
              testID="display-name-input"
            />
          </>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            loading && styles.buttonDisabled,
            isSmallScreen && styles.buttonMobile,
          ]}
          onPress={handleAuth}
          disabled={loading}
          testID="auth-button">
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={[styles.dividerText, isSmallScreen && styles.dividerTextMobile]}>OR</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity
          style={[
            styles.googleButton,
            loading && styles.buttonDisabled,
            Platform.OS === 'android' && styles.googleButtonDisabled,
            isSmallScreen && styles.googleButtonMobile,
          ]}
          onPress={handleGoogleSignIn}
          disabled={loading || Platform.OS === 'android'}
          testID="google-signin-button">
          {loading ? (
            <ActivityIndicator color="#333" />
          ) : (
            <>
              <Text style={[styles.googleIcon, isSmallScreen && styles.googleIconMobile]}>G</Text>
              <Text
                style={[
                  styles.googleButtonText,
                  Platform.OS === 'android' && styles.googleButtonTextDisabled,
                  isSmallScreen && styles.googleButtonTextMobile,
                ]}>
                {Platform.OS === 'android' ? 'Google Sign-In (iOS/Web only)' : 'Continue with Google'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleMode}
          disabled={loading}
          testID="toggle-mode-button">
          <Text style={[styles.link, isSmallScreen && styles.linkMobile]}>
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
          </Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  containerMobile: {
    paddingVertical: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
  },
  scrollContentMobile: {
    paddingHorizontal: 16,
  },
  authContainer: {
    width: '90%',
    maxWidth: 620,
    justifyContent: 'center',
    padding: 50,
    borderRadius: 80,
    backgroundColor: 'e9e9e9',
    borderWidth: 0.1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  authContainerMobile: {
    width: '100%',
    maxWidth: 380,
    padding: 28,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 6,
  },
  title: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 42,
    letterSpacing: 2,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 14,
    color: '#e74c3c',
  },
  titleMobile: {
    fontSize: 32,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 20,
    letterSpacing: 2,
    fontWeight: 'bold',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 30,
    color: 'black',
  },
  subtitleMobile: {
    fontSize: 16,
    lineHeight: 18,
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#ffe6e6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  errorText: {
    fontFamily: 'PressStart2P_400Regular',
    color: '#c0392b',
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    fontFamily: 'PressStart2P_400Regular',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputMobile: {
    padding: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  buttonMobile: {
    paddingVertical: 12,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    fontFamily: 'PressStart2P_400Regular',
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    fontFamily: 'PressStart2P_400Regular',
    marginHorizontal: 10,
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  dividerTextMobile: {
    fontSize: 12,
  },
  googleButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  googleButtonMobile: {
    paddingVertical: 12,
  },
  googleIcon: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 10,
    color: '#4285F4',
  },
  googleIconMobile: {
    fontSize: 16,
    marginRight: 6,
  },
  googleButtonText: {
    fontFamily: 'PressStart2P_400Regular',
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButtonTextMobile: {
    fontSize: 13,
    lineHeight: 16,
  },
  googleButtonDisabled: {
    backgroundColor: '#f0f0f0',
    opacity: 0.6,
  },
  googleButtonTextDisabled: {
    fontFamily: 'PressStart2P_400Regular',
    color: '#999',
  },
  link: {
    fontFamily: 'PressStart2P_400Regular',
    color: '#3498db',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 15,
  },
  linkMobile: {
    fontSize: 12,
  },
});