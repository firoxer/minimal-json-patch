# minimal-json-patch

An implementation of [RFC 6902](https://tools.ietf.org/html/rfc6902) without bells or whistles.

## Usage

```javascript
import { applyPatch } from 'minimal-json-patch';

const originalDocument = {
  letters: ['a', 'b', 'd'],
};

const modifiedDocument = applyPatch(originalDocument, [
  { op: 'add', path: '/letters/2', value: 'c' },
]);

console.log(modifiedDocument.letters);
// [ 'a', 'b', 'c', 'd' ]
```

## To-Do

- Clearer error messages
- More consistent error messages
