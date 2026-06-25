import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveRecentSearch, getRecentSearches } from '../lib/recentSearches';
import { RecentSearches } from '../components/RecentSearches';

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    getRecentSearches().then(setRecentSearches);
  }, []);

  async function handleSearch() {
    const trimmed = query.trim();
    if (trimmed.length < 3) return;
    await saveRecentSearch(trimmed);
    router.push({ pathname: '/results', params: { query: trimmed } });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <Text style={styles.title}>Vibe&Thread</Text>
        <Text style={styles.subtitle}>Find clothing in Qatar</Text>

        <TextInput
          style={styles.input}
          placeholder="Describe what you're looking for..."
          placeholderTextColor="#aaa"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.button, query.trim().length < 3 && styles.buttonDisabled]}
          onPress={handleSearch}
          disabled={query.trim().length < 3}
        >
          <Text style={styles.buttonText}>Search</Text>
        </TouchableOpacity>

        <RecentSearches
          searches={recentSearches}
          onSelect={(q) => {
            setQuery(q);
            router.push({ pathname: '/results', params: { query: q } });
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 24 },
  title: { fontSize: 32, fontWeight: '700', color: '#1a1a1a', marginTop: 24 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, padding: 16, fontSize: 16, color: '#1a1a1a', minHeight: 80, textAlignVertical: 'top', backgroundColor: '#fafafa' },
  button: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
