import { StyleSheet, Text, View } from 'react-native';

export default function AnalyzeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.hint}>AI video analysis is coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { fontSize: 15, color: '#60646C', textAlign: 'center' },
});
