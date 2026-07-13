import { StyleSheet, Text, View } from 'react-native';

export default function ClimbsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.hint}>Your climb journal is coming next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { fontSize: 15, color: '#60646C', textAlign: 'center' },
});
