import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Store } from '../types';

interface Props { store: Store; }

export function StoreCard({ store }: Props) {
  const openDirections = () => {
    if (store.mapsUrl) Linking.openURL(store.mapsUrl).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <View style={styles.logoWrap}>
        {store.logoUrl ? (
          <Image source={{ uri: store.logoUrl }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.logoFallback}>
            <Text style={styles.logoInitial}>{store.name.charAt(0)}</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{store.name}</Text>
        {store.mallLocation && (
          <Text style={styles.location}>📍 {store.mallLocation}</Text>
        )}
        <Text style={styles.reason} numberOfLines={2}>{store.matchReason}</Text>
      </View>
      {store.mapsUrl && (
        <TouchableOpacity style={styles.dirBtn} onPress={openDirections} activeOpacity={0.85}>
          <Text style={styles.dirBtnText}>Directions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#eeede6',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f4f3ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#d8d3c8',
    overflow: 'hidden',
  },
  logo: { width: 36, height: 36 },
  logoFallback: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  logoInitial: { fontSize: 18, fontWeight: '700', color: '#5a554e' },
  body: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#191817', marginBottom: 2 },
  location: { fontSize: 12, color: '#5a554e', marginBottom: 4 },
  reason: { fontSize: 12, color: '#8a847a', lineHeight: 16 },
  dirBtn: {
    backgroundColor: '#191817',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 12,
  },
  dirBtnText: { color: '#f4f3ee', fontSize: 12, fontWeight: '600' },
});
