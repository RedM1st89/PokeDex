
import { useAuth } from '@/context/AuthContext';
import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { user, signIn, signUp } = useAuth();

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
        const result = await signIn(email, password);
        console.log('Sign in result:', result);
        Alert.alert('Success', 'Logged in successfully!');
      } else {
        console.log('Attempting sign up...');
        const result = await signUp(email, password, displayName);
        console.log('Sign up result:', result);
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

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setErrorMessage('');
    setConfirmPassword('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.authContainer}>
        <Text style={styles.title}>🔴 Pokédex</Text>
        <Text style={styles.subtitle}>{isLogin ? 'Welcome Back!' : 'Create Account'}</Text>

        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
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
          style={styles.input}
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
              style={styles.input}
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
              style={styles.input}
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
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAuth}
          disabled={loading}
          testID="auth-button">
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={toggleMode} 
          disabled={loading}
          testID="toggle-mode-button">
          <Text style={styles.link}>
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#e74c3c',
  },
  subtitle: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
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
    color: '#c0392b',
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    color: '#3498db',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 15,
  },
});