import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  searches: string[];
  onSelect: (query: string) => void;
}

export function RecentSearches({ searches, onSelect }: Props) {
  if (searches.length === 0) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Recent searches</Text>
      {searches.map((s, i) => (
        <TouchableOpacity key={i} onPress={() => onSelect(s)} style={styles.item}>
          <Text style={styles.itemText}>🕐 {s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24 },
  label: { fontSize: 13, color: '#999', marginBottom: 8, fontWeight: '600', textTransform: 'uppercase' },
  item: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemText: { fontSize: 15, color: '#333' },
});
