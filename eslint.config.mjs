// Shared flat config for /backend and /shared (M0.3). /mobile has its own
// eslint-config-expo setup and is ignored here — `expo lint` finds
// mobile/eslint.config.js first because it runs with cwd=mobile.
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['mobile/**', '**/node_modules/**', '**/dist/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
);
