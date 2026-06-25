import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchClothing } from '../lib/search';
import { ProductCard } from '../components/ProductCard';
import { StoreCard } from '../components/StoreCard';
import { SearchResult } from '../types';

type Tab = 'online' | 'instore';

export default function ResultsScreen() {
  const { query } = useLocalSearchParams<{ query: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('online');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setError(null);
    searchClothing(query)
      .then(setResult)
      .catch(() => setError('Something went wrong. Please try again.'))
      .finally(() => setLoading(false));
  }, [query]);

  const noResults = result && result.products.length === 0 && result.stores.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.queryText} numberOfLines={1}>{query}</Text>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a1a1a" />
          <Text style={styles.loadingText}>Finding your style...</Text>
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {noResults && !loading && (
        <View style={styles.center}>
          <Text style={styles.noResultsTitle}>No exact matches found</Text>
          <Text style={styles.noResultsSubtitle}>We couldn't find an exact match — try describing it differently</Text>
          {result.suggestedTweaks.map((tweak, i) => (
            <Text key={i} style={styles.tweak}>💡 {tweak}</Text>
          ))}
          <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>Search again</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && !noResults && !loading && (
        <>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'online' && styles.tabActive]}
              onPress={() => setActiveTab('online')}
            >
              <Text style={[styles.tabText, activeTab === 'online' && styles.tabTextActive]}>
                Online ({result.products.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'instore' && styles.tabActive]}
              onPress={() => setActiveTab('instore')}
            >
              <Text style={[styles.tabText, activeTab === 'instore' && styles.tabTextActive]}>
                In-Store ({result.stores.length})
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'online' && (
            result!.products.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.noResultsSubtitle}>No online results — check In-Store tab</Text>
              </View>
            ) : (
              <FlatList
                data={result!.products}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <ProductCard product={item} />}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
              />
            )
          )}

          {activeTab === 'instore' && (
            result!.stores.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.noResultsSubtitle}>No in-store results — check Online tab</Text>
              </View>
            ) : (
              <FlatList
                data={result!.stores}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <StoreCard store={item} />}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
              />
            )
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  back: { marginRight: 12 },
  backText: { fontSize: 16, color: '#1a1a1a', fontWeight: '500' },
  queryText: { flex: 1, fontSize: 14, color: '#666', fontStyle: 'italic' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#1a1a1a' },
  tabText: { fontSize: 14, color: '#999', fontWeight: '600' },
  tabTextActive: { color: '#1a1a1a' },
  list: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  errorText: { fontSize: 16, color: '#e00', textAlign: 'center' },
  noResultsTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  noResultsSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 16 },
  tweak: { fontSize: 14, color: '#555', marginBottom: 8 },
  retryButton: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginTop: 16, paddingHorizontal: 32 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
