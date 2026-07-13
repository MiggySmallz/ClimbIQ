import { StyleSheet } from 'react-native';

/** Shared styles for the auth + onboarding screens. */
export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#60646C',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D4DA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  primaryButton: {
    backgroundColor: '#208AEF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#D0D4DA',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1F24',
  },
  mutedText: {
    color: '#60646C',
  },
  footerLink: {
    textAlign: 'center',
    color: '#208AEF',
    marginTop: 16,
    fontSize: 15,
  },
});
