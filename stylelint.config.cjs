module.exports = {
  rules: {
    'selector-class-pattern': [
      '^(proto-home|btn|u-|is-|has-)[a-z0-9-]*$',
      { resolveNestedSelectors: true, message: 'Prototype CSS must be under .proto-home or use approved prefixes.' }
    ],
    'no-descending-specificity': null
  },
  overrides: [
    {
      files: ['experiments/**/*.css'],
      rules: {
        'selector-max-id': 0,
        'selector-max-type': 0
      }
    }
  ]
};
