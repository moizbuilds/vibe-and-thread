import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Store } from '../types';

interface Props { store: Store; }

export function StoreCard({ store }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.logoContainer}>
        {store.logoUrl ? (
          <Image source={{ uri: store.logoUrl }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoFallbackText}>{store.name[0]}</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{store.name}</Text>
        {store.mallLocation && <Text style={styles.location}>📍 {store.mallLocation}</Text>}
        {store.matchReason && <Text style={styles.reason}>{store.matchReason}</Text>}
      </View>
      {store.mapsUrl && (
        <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(store.mapsUrl!)}>
          <Text style={styles.buttonText}>Directions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', padding: 12, borderRadius: 12, backgroundColor: '#fff', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, alignItems: 'center' },
  logoContainer: { marginRight: 12 },
  logo: { width: 48, height: 48, borderRadius: 8 },
  logoFallback: { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  logoFallbackText: { fontSize: 20, fontWeight: '700', color: '#666' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  location: { fontSize: 12, color: '#888', marginTop: 2 },
  reason: { fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' },
  button: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginLeft: 8 },
  buttonText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
