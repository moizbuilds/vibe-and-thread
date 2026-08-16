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
      .catch((e) => { console.error('SEARCH ERROR:', e); setError('Error: ' + e?.message); })
      .finally(() => setLoading(false));
  }, [query]);

  const noResults = result && result.products.length === 0 && result.stores.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} activeOpacity={0.7}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>RESULTS FOR</Text>
        <Text style={styles.queryText} numberOfLines={2}>{query}</Text>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#c96442" />
          <Text style={styles.loadingText}>Finding your style…</Text>
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.retryButton} activeOpacity={0.85}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {noResults && !loading && (
        <View style={styles.center}>
          <Text style={styles.noResultsTitle}>No exact matches</Text>
          <Text style={styles.noResultsSubtitle}>
            We couldn't find an exact match — try describing it differently.
          </Text>
          {result.suggestedTweaks.map((tweak, i) => (
            <View key={i} style={styles.tweakRow}>
              <Text style={styles.tweakDot}>—</Text>
              <Text style={styles.tweakText}>{tweak}</Text>
            </View>
          ))}
          <TouchableOpacity onPress={() => router.back()} style={styles.retryButton} activeOpacity={0.85}>
            <Text style={styles.retryText}>Search again</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && !noResults && !loading && (
        <>
          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'online' && styles.tabActive]}
              onPress={() => setActiveTab('online')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'online' && styles.tabTextActive]}>
                Online
              </Text>
              {result.products.length > 0 && (
                <View style={[styles.badge, activeTab === 'online' && styles.badgeActive]}>
                  <Text style={[styles.badgeText, activeTab === 'online' && styles.badgeTextActive]}>
                    {result.products.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'instore' && styles.tabActive]}
              onPress={() => setActiveTab('instore')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'instore' && styles.tabTextActive]}>
                In-Store
              </Text>
              {result.stores.length > 0 && (
                <View style={[styles.badge, activeTab === 'instore' && styles.badgeActive]}>
                  <Text style={[styles.badgeText, activeTab === 'instore' && styles.badgeTextActive]}>
                    {result.stores.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {activeTab === 'online' && (
            result.products.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.noResultsSubtitle}>No online results — check In-Store tab</Text>
              </View>
            ) : (
              <FlatList
                data={result.products}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <ProductCard product={item} />}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
              />
            )
          )}

          {activeTab === 'instore' && (
            result.stores.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.noResultsSubtitle}>No in-store results — check Online tab</Text>
              </View>
            ) : (
              <FlatList
                data={result.stores}
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
  safe: { flex: 1, backgroundColor: '#f4f3ee' },

  header: {
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: '#d8d3c8', backgroundColor: '#f4f3ee',
  },
  back: { marginBottom: 16 },
  backText: { fontSize: 14, color: '#c96442', fontWeight: '500' },
  eyebrow: { fontSize: 11, letterSpacing: 2.5, color: '#8a847a', fontWeight: '500', textTransform: 'uppercase', marginBottom: 4 },
  queryText: { fontSize: 22, fontWeight: '700', color: '#191817', letterSpacing: -0.5, lineHeight: 28 },

  tabs: {
    flexDirection: 'row', backgroundColor: '#f4f3ee',
    paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#d8d3c8',
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', flex: 1,
    paddingVertical: 16, justifyContent: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#c96442' },
  tabText: { fontSize: 14, color: '#8a847a', fontWeight: '600' },
  tabTextActive: { color: '#191817' },
  badge: {
    marginLeft: 8, backgroundColor: '#eeede6', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeActive: { backgroundColor: '#c96442' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#8a847a' },
  badgeTextActive: { color: '#f4f3ee' },

  list: { padding: 24, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { marginTop: 16, fontSize: 15, color: '#5a554e' },
  errorText: { fontSize: 15, color: '#a53e2a', textAlign: 'center', marginBottom: 24 },
  noResultsTitle: { fontSize: 22, fontWeight: '700', color: '#191817', textAlign: 'center', marginBottom: 8 },
  noResultsSubtitle: { fontSize: 15, color: '#5a554e', textAlign: 'center', lineHeight: 22 },
  tweakRow: { flexDirection: 'row', marginTop: 12, paddingHorizontal: 16 },
  tweakDot: { fontSize: 14, color: '#c96442', marginRight: 8 },
  tweakText: { fontSize: 14, color: '#5a554e', flex: 1, lineHeight: 20 },
  retryButton: {
    marginTop: 24, backgroundColor: '#c96442', borderRadius: 6,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  retryText: { color: '#f4f3ee', fontSize: 14, fontWeight: '600' },
});
