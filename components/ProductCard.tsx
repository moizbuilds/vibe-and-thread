import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Product } from '../types';

interface Props { product: Product; }

export function ProductCard({ product }: Props) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: product.imageUrl }} style={styles.image} defaultSource={require('../assets/placeholder.png')} />
      <View style={styles.info}>
        <Text style={styles.store}>{product.store.toUpperCase()}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.price}>QAR {product.price}</Text>
        {product.inStoreLocation && (
          <Text style={styles.location}>📍 {product.inStoreLocation}</Text>
        )}
      </View>
      <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(product.productUrl)}>
        <Text style={styles.buttonText}>View</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', padding: 12, borderRadius: 12, backgroundColor: '#fff', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  image: { width: 80, height: 100, borderRadius: 8, backgroundColor: '#f0f0f0' },
  info: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  store: { fontSize: 10, color: '#999', fontWeight: '700', letterSpacing: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginTop: 4 },
  price: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginTop: 4 },
  location: { fontSize: 11, color: '#888', marginTop: 2 },
  button: { backgroundColor: '#1a1a1a', borderRadius: 8, padding: 8, alignSelf: 'center', marginLeft: 8 },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
