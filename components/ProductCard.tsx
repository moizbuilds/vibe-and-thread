import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Product } from '../types';

interface Props { product: Product; }

export function ProductCard({ product }: Props) {
  const openLink = () => {
    Linking.openURL(product.productUrl).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: product.imageUrl }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.body}>
        <Text style={styles.store}>{product.store.toUpperCase()}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.footer}>
          <Text style={styles.price}>QAR {product.price}</Text>
          <TouchableOpacity style={styles.viewBtn} onPress={openLink} activeOpacity={0.85}>
            <Text style={styles.viewBtnText}>View →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#eeede6',
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  image: {
    width: 110,
    height: 130,
    backgroundColor: '#d8d3c8',
  },
  body: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  store: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#8a847a',
    fontWeight: '600',
    marginBottom: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#191817',
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#191817',
  },
  viewBtn: {
    backgroundColor: '#c96442',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  viewBtnText: {
    color: '#f4f3ee',
    fontSize: 13,
    fontWeight: '600',
  },
});
