import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveRecentSearch, getRecentSearches } from '../lib/recentSearches';

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  const underlineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getRecentSearches().then(setRecents);
  }, []);

  const handleFocus = () =>
    Animated.timing(underlineAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();

  const handleBlur = () =>
    Animated.timing(underlineAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();

  const underlineColor = underlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#d8d3c8', '#c96442'],
  });

  const handleSearch = async () => {
    if (query.trim().length < 3) return;
    await saveRecentSearch(query.trim());
    router.push({ pathname: '/results', params: { query: query.trim() } });
  };

  const handleRecent = async (q: string) => {
    await saveRecentSearch(q);
    router.push({ pathname: '/results', params: { query: q } });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>QATAR FASHION FINDER</Text>
            <Text style={styles.title}>Vibe &amp; Thread</Text>
            <Text style={styles.subtitle}>
              Describe what you're looking for — we'll find it across Qatar's stores.
            </Text>
          </View>

          <View style={styles.searchBlock}>
            <Text style={styles.inputLabel}>What are you looking for?</Text>
            <Animated.View style={[styles.inputWrap, { borderBottomColor: underlineColor }]}>
              <TextInput
                style={styles.input}
                placeholder="e.g. flowy beige linen dress for a casual day"
                placeholderTextColor="#8a847a"
                value={query}
                onChangeText={setQuery}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </Animated.View>
            <TouchableOpacity
              style={[styles.searchBtn, query.trim().length < 3 && styles.searchBtnDisabled]}
              onPress={handleSearch}
              disabled={query.trim().length < 3}
              activeOpacity={0.85}
            >
              <Text style={styles.searchBtnText}>Find matches</Text>
            </TouchableOpacity>
          </View>

          {recents.length > 0 && (
            <View style={styles.recentsBlock}>
              <Text style={styles.recentsLabel}>RECENT SEARCHES</Text>
              <FlatList
                data={recents}
                keyExtractor={(item) => item}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.recentItem}
                    onPress={() => handleRecent(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.recentText}>{item}</Text>
                    <Text style={styles.recentArrow}>→</Text>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f3ee' },
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },

  header: { marginBottom: 48 },
  eyebrow: {
    fontSize: 11, letterSpacing: 2.5, color: '#8a847a',
    fontWeight: '500', marginBottom: 12, textTransform: 'uppercase',
  },
  title: {
    fontSize: 40, fontWeight: '700', color: '#191817',
    letterSpacing: -1, lineHeight: 44, marginBottom: 16,
  },
  subtitle: { fontSize: 16, color: '#5a554e', lineHeight: 24 },

  searchBlock: { marginBottom: 40 },
  inputLabel: { fontSize: 13, fontWeight: '500', color: '#5a554e', marginBottom: 12 },
  inputWrap: { borderBottomWidth: 2, marginBottom: 20, paddingBottom: 8 },
  input: { fontSize: 16, color: '#191817', lineHeight: 22 },

  searchBtn: {
    backgroundColor: '#c96442', borderRadius: 6,
    paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center',
  },
  searchBtnDisabled: { backgroundColor: '#d8d3c8' },
  searchBtnText: { color: '#f4f3ee', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },

  recentsBlock: { flex: 1 },
  recentsLabel: {
    fontSize: 11, letterSpacing: 2.5, color: '#8a847a',
    fontWeight: '500', marginBottom: 16, textTransform: 'uppercase',
  },
  recentItem: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 14,
  },
  recentText: { fontSize: 15, color: '#191817', flex: 1 },
  recentArrow: { fontSize: 16, color: '#c96442', marginLeft: 8 },
  separator: { height: 1, backgroundColor: '#d8d3c8' },
});
