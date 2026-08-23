## Contributing to ScopeKit

Thank you for considering contributing! Please read the following guidelines:

### How to contribute

1. **Fork the repo** and clone locally
2. **Install dependencies** — none (zero-dependency project)
3. **Make your change** — follow the existing code style
4. **Run tests**: `node --test tests/`
5. **Commit** with a clear message
6. **Push** and open a Pull Request

### Development setup

- Edit source files in `js/`, `css/`, `locales/`
- Add new locale strings keyed the same way in both `locales/en.json` and `locales/pt-BR.json`
- Run `node --test tests/engine.test.js` to verify
- Lint is embedded in the test runner

### Report bugs

Open an issue on GitHub with a clear title and reproduction steps. Include the browser/OS if relevant.

### Feature requests

Open an issue with the label `feature request` and describe the use case.