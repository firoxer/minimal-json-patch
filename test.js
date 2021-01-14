import * as assert from 'assert';

import { apply, JsonPatchError } from './src/index.js';

// 1.  Introduction
//
// JavaScript Object Notation (JSON) [RFC4627] is a common format for
// the exchange and storage of structured data.  HTTP PATCH [RFC5789]
// extends the Hypertext Transfer Protocol (HTTP) [RFC2616] with a
// method to perform partial modifications to resources.
//
// JSON Patch is a format (identified by the media type "application/
// json-patch+json") for expressing a sequence of operations to apply to
// a target JSON document; it is suitable for use with the HTTP PATCH
// method.
//
// This format is also potentially useful in other cases in which it is
// necessary to make partial updates to a JSON document or to a data
// structure that has similar constraints (i.e., they can be serialized
// as an object or an array using the JSON grammar).
//
// 2.  Conventions
//
// The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
// "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this
// document are to be interpreted as described in RFC 2119 [RFC2119].
//
// 3.  Document Structure
//
// A JSON Patch document is a JSON [RFC4627] document that represents an
// array of objects.  Each object represents a single operation to be
// applied to the target JSON document.
//
// The following is an example JSON Patch document, transferred in an
// HTTP PATCH request:
//
// PATCH /my/data HTTP/1.1
// Host: example.org
// Content-Length: 326
// Content-Type: application/json-patch+json
// If-Match: "abc123"
//
// [
//   { "op": "test", "path": "/a/b/c", "value": "foo" },
//   { "op": "remove", "path": "/a/b/c" },
//   { "op": "add", "path": "/a/b/c", "value": [ "foo", "bar" ] },
//   { "op": "replace", "path": "/a/b/c", "value": 42 },
//   { "op": "move", "from": "/a/b/c", "path": "/a/b/d" },
//   { "op": "copy", "from": "/a/b/d", "path": "/a/b/e" }
// ]
//
// Evaluation of a JSON Patch document begins against a target JSON
// document.  Operations are applied sequentially in the order they
// appear in the array.  Each operation in the sequence is applied to
// the target document; the resulting document becomes the target of the
// next operation.  Evaluation continues until all operations are
// successfully applied or until an error condition is encountered.
{
  const original = { overwritten: 1, overwriter: 2 };

  const modified = apply(original, [
    { op: 'copy', from: '/overwritten', path: '/final' },
    { op: 'copy', from: '/overwriter', path: '/final' },
  ]);

  assert.deepStrictEqual(modified, { overwritten: 1, overwriter: 2, final: 2 });
}
//
// 4.  Operations
//
// Operation objects MUST have exactly one "op" member, whose value
// indicates the operation to perform.  Its value MUST be one of "add",
// "remove", "replace", "move", "copy", or "test"; other values are
// errors.  The semantics of each object is defined below.
assert.throws(() => {
  apply({}, [{ path: '/a', value: 1 }]);
}, new JsonPatchError('illegal op: should be add/copy/move/remove/replace/test, was undefined'));

assert.throws(() => {
  apply({}, [{ op: 'illegal', path: '/a', value: 1 }]);
}, new JsonPatchError('illegal op: should be add/copy/move/remove/replace/test, was "illegal"'));

assert.throws(() => {
  apply({}, [{ op: 123, path: '/a', value: 1 }]);
}, new JsonPatchError('illegal op: should be add/copy/move/remove/replace/test, was 123'));
//
// Additionally, operation objects MUST have exactly one "path" member.
// That member's value is a string containing a JSON-Pointer value
// [RFC6901] that references a location within the target document (the
// "target location") where the operation is performed.
assert.throws(() => {
  apply({}, [{ op: 'add', value: 1 }]);
}, new JsonPatchError('add failed: bad path: should be a string, was undefined'));

assert.throws(() => {
  apply({}, [{ op: 'add', path: 'invalid path', value: 1 }]);
}, new JsonPatchError('add failed: bad path: should be "" or start with "/"'));

assert.throws(() => {
  apply({}, [{ op: 'add', path: null, value: 1 }]);
}, new JsonPatchError('add failed: bad path: should be a string, was object'));

assert.throws(() => {
  apply({ a: { b: 1 } }, [{ op: 'add', path: '/nonexistent/path', value: 1 }]);
}, new JsonPatchError('add failed: pointer leads to an element that is neither an array nor an object but undefined'));
//
// The meanings of other operation object members are defined by
// operation (see the subsections below).  Members that are not
// explicitly defined for the operation in question MUST be ignored
// (i.e., the operation will complete as if the undefined member did not
// appear in the object).
assert.doesNotThrow(() => {
  const document = {};

  apply(document, [
    { op: 'add', path: '/valid-path', value: 1, from: '/superfluous' },
  ]);
});
//
// Note that the ordering of members in JSON objects is not significant;
// therefore, the following operation objects are equivalent:
//
// { "op": "add", "path": "/a/b/c", "value": "foo" }
// { "path": "/a/b/c", "op": "add", "value": "foo" }
// { "value": "foo", "path": "/a/b/c", "op": "add" }
{
  const original = { a: { b: {} } };

  const modified1 = apply(original, [
    { op: 'add', path: '/a/b/c', value: 'foo' },
  ]);
  const modified2 = apply(original, [
    { path: '/a/b/c', op: 'add', value: 'foo' },
  ]);
  const modified3 = apply(original, [
    { value: 'foo', path: '/a/b/c', op: 'add' },
  ]);

  assert.deepStrictEqual(modified1, modified2);
  assert.deepStrictEqual(modified2, modified3);
  assert.deepStrictEqual(modified3, modified1);
}
//
// Operations are applied to the data structures represented by a JSON
// document, i.e., after any unescaping (see [RFC4627], Section 2.5)
// takes place.
{
  const original = { '~': 'a' };

  const modified = apply(original, [{ op: 'add', path: '/~0', value: 'b' }]);

  assert.deepStrictEqual(modified, { '~': 'b' });
}
{
  const original = { '/': 'a' };

  const modified = apply(original, [{ op: 'add', path: '/~1', value: 'b' }]);

  assert.deepStrictEqual(modified, { '/': 'b' });
}
{
  const original = { '~/': 'a' };

  const modified = apply(original, [{ op: 'add', path: '/~0~1', value: 'b' }]);

  assert.deepStrictEqual(modified, { '~/': 'b' });
}
//
// 4.1.  add
//
// The "add" operation performs one of the following functions,
// depending upon what the target location references:
//
// o  If the target location specifies an array index, a new value is
//    inserted into the array at the specified index.
{
  const original = ['a', 'c'];

  const modified = apply(original, [{ op: 'add', path: '/1', value: 'b' }]);

  assert.deepStrictEqual(modified, ['a', 'b', 'c']);
}
//
// o  If the target location specifies an object member that does not
//    already exist, a new member is added to the object.
{
  const original = {};

  const modified = apply(original, [{ op: 'add', path: '/a', value: 1 }]);

  assert.deepStrictEqual(modified, { a: 1 });
}
//
// o  If the target location specifies an object member that does exist,
//    that member's value is replaced.
{
  const original = { a: 1 };

  const modified = apply(original, [{ op: 'add', path: '/a', value: 2 }]);

  assert.deepStrictEqual(modified, { a: 2 });
}
//
// The operation object MUST contain a "value" member whose content
// specifies the value to be added.
assert.throws(() => {
  apply({}, [{ op: 'add', path: '/a' }]);
}, new JsonPatchError('add failed: missing value'));
//
// For example:
//
// { "op": "add", "path": "/a/b/c", "value": [ "foo", "bar" ] }
//
// When the operation is applied, the target location MUST reference one
// of:
//
// o  The root of the target document - whereupon the specified value
//    becomes the entire content of the target document.
{
  const original = { a: 1 };

  const modified = apply(original, [{ op: 'add', path: '', value: { b: 2 } }]);

  assert.deepStrictEqual(modified, { b: 2 });
}
//
// o  A member to add to an existing object - whereupon the supplied
//    value is added to that object at the indicated location.  If the
//    member already exists, it is replaced by the specified value.
{
  // This already gets tested above
}
//
// o  An element to add to an existing array - whereupon the supplied
//    value is added to the array at the indicated location.  Any
//    elements at or above the specified index are shifted one position
//    to the right.  The specified index MUST NOT be greater than the
//    number of elements in the array.  If the "-" character is used to
//    index the end of the array (see [RFC6901]), this has the effect of
//    appending the value to the array.
assert.throws(() => {
  apply([1, 2], [{ op: 'add', path: '/4', value: 'd' }]);
}, new JsonPatchError('add failed: pointer points to an index that is out-of-bounds'));

{
  const original = [];

  const modified = apply(original, [{ op: 'add', path: '/-', value: 'a' }]);

  assert.deepStrictEqual(modified, ['a']);
}
{
  const original = ['a', 'b'];

  const modified = apply(original, [{ op: 'add', path: '/-', value: 'c' }]);

  assert.deepStrictEqual(modified, ['a', 'b', 'c']);
}
//
// Because this operation is designed to add to existing objects and
// arrays, its target location will often not exist.  Although the
// pointer's error handling algorithm will thus be invoked, this
// specification defines the error handling behavior for "add" pointers
// to ignore that error and add the value as specified.
//
// However, the object itself or an array containing it does need to
// exist, and it remains an error for that not to be the case.  For
// example, an "add" with a target location of "/a/b" starting with this
// document:
//
// { "a": { "foo": 1 } }
//
// is not an error, because "a" exists, and "b" will be added to its
// value.  It is an error in this document:
//
// { "q": { "bar": 2 } }
//
// because "a" does not exist.
assert.doesNotThrow(() => {
  const document = { a: { foo: 1 } };

  apply(document, [{ op: 'add', path: '/a/b', value: 2 }]);
});

assert.throws(() => {
  const document = { q: { bar: 2 } };

  apply(document, [{ op: 'add', path: '/a/b', value: 2 }]);
}, new JsonPatchError('add failed: pointer leads to an element that is neither an array nor an object but undefined'));
//
// 4.2.  remove
//
// The "remove" operation removes the value at the target location.
//
// The target location MUST exist for the operation to be successful.
assert.throws(() => {
  const document = { a: 1 };

  apply(document, [{ op: 'remove', path: '/b' }]);
}, new JsonPatchError('remove failed: pointer does not lead anywhere'));
//
// For example:
//
// { "op": "remove", "path": "/a/b/c" }
//
// If removing an element from an array, any elements above the
// specified index are shifted one position to the left.
{
  const original = ['a', 'b', 'x', 'c'];

  const modified = apply(original, [{ op: 'remove', path: '/2' }]);

  assert.deepStrictEqual(modified, ['a', 'b', 'c']);
}
//
// 4.3.  replace
//
// The "replace" operation replaces the value at the target location
// with a new value.  The operation object MUST contain a "value" member
// whose content specifies the replacement value.
assert.throws(() => {
  const document = { a: 1 };

  apply(document, [{ op: 'replace', path: '/a' }]);
}, new JsonPatchError('replace failed: missing value'));
//
// The target location MUST exist for the operation to be successful.
assert.throws(() => {
  const document = { a: 1 };

  apply(document, [{ op: 'replace', path: '/b', value: 2 }]);
}, new JsonPatchError('replace failed: pointer points to a nonexistent location'));
//
// For example:
//
// { "op": "replace", "path": "/a/b/c", "value": 42 }
//
// This operation is functionally identical to a "remove" operation for
// a value, followed immediately by an "add" operation at the same
// location with the replacement value.
{
  const original = { a: { b: { c: 41 } } };

  const modified1 = apply(original, [
    { op: 'replace', path: '/a/b/c', value: 42 },
  ]);
  const modified2 = apply(original, [
    { op: 'remove', path: '/a/b/c' },
    { op: 'add', path: '/a/b/c', value: 42 },
  ]);

  assert.deepStrictEqual(modified1, modified2);
}
//
// 4.4.  move
//
// The "move" operation removes the value at a specified location and
// adds it to the target location.
//
// The operation object MUST contain a "from" member, which is a string
// containing a JSON Pointer value that references the location in the
// target document to move the value from.
assert.throws(() => {
  const document = { a: 1 };

  apply(document, [{ op: 'move', path: '/a' }]);
}, new JsonPatchError('move failed: missing from'));
//
// The "from" location MUST exist for the operation to be successful.
assert.throws(() => {
  const document = { a: 1 };

  apply(document, [{ op: 'move', path: '/a', from: '/b' }]);
}, new JsonPatchError('move failed: pointer does not lead anywhere'));
//
// For example:
//
// { "op": "move", "from": "/a/b/c", "path": "/a/b/d" }
//
// This operation is functionally identical to a "remove" operation on
// the "from" location, followed immediately by an "add" operation at
// the target location with the value that was just removed.
{
  const original = { a: { b: { c: 123 } } };

  const modified1 = apply(original, [
    { op: 'move', from: '/a/b/c', path: '/a/b/d' },
  ]);
  const modified2 = apply(original, [
    { op: 'remove', path: '/a/b/c' },
    { op: 'add', path: '/a/b/d', value: 123 },
  ]);

  assert.deepStrictEqual(modified1, modified2);
}
//
// The "from" location MUST NOT be a proper prefix of the "path"
// location; i.e., a location cannot be moved into one of its children.
assert.throws(() => {
  const document = { a: { b: 1 } };

  apply(document, [{ op: 'move', from: '/a', path: '/a/b' }]);
}, new JsonPatchError('move failed: from pointer cannot be a prefix of path pointer'));
//
// 4.5.  copy
//
// The "copy" operation copies the value at a specified location to the
// target location.
//
// The operation object MUST contain a "from" member, which is a string
// containing a JSON Pointer value that references the location in the
// target document to copy the value from.
assert.throws(() => {
  const document = { a: 1 };

  apply(document, [{ op: 'copy', path: '/a' }]);
}, new JsonPatchError('copy failed: missing from'));
//
// The "from" location MUST exist for the operation to be successful.
assert.throws(() => {
  const document = { a: 1 };

  apply(document, [{ op: 'copy', path: '/a', from: '/b' }]);
}, new JsonPatchError('copy failed: pointer does not lead anywhere'));
//
// For example:
//
// { "op": "copy", "from": "/a/b/c", "path": "/a/b/e" }
//
// This operation is functionally identical to an "add" operation at the
// target location using the value specified in the "from" member.
{
  const original = { a: { b: { c: 123 } } };

  const modified1 = apply(original, [
    { op: 'copy', from: '/a/b/c', path: '/a/b/e' },
  ]);
  const modified2 = apply(original, [
    { op: 'add', path: '/a/b/e', value: 123 },
  ]);

  assert.deepStrictEqual(modified1, modified2);
}
//
// 4.6.  test
//
// The "test" operation tests that a value at the target location is
// equal to a specified value.
//
// The operation object MUST contain a "value" member that conveys the
// value to be compared to the target location's value.
assert.throws(() => {
  const document = { a: 1 };

  apply(document, [{ op: 'test', path: '/a' }]);
}, new JsonPatchError('test failed: missing value'));
//
// The target location MUST be equal to the "value" value for the
// operation to be considered successful.
//
// Here, "equal" means that the value at the target location and the
// value conveyed by "value" are of the same JSON type, and that they
// are considered equal by the following rules for that type:
//
// o  strings: are considered equal if they contain the same number of
//    Unicode characters and their code points are byte-by-byte equal.
assert.doesNotThrow(() => {
  apply({ a: 'abc' }, [{ op: 'test', path: '/a', value: 'abc' }]);
});
//
// o  numbers: are considered equal if their values are numerically
//    equal.
assert.doesNotThrow(() => {
  apply({ a: 123 }, [{ op: 'test', path: '/a', value: 123 }]);
});
//
// o  arrays: are considered equal if they contain the same number of
//    values, and if each value can be considered equal to the value at
//    the corresponding position in the other array, using this list of
//    type-specific rules.
assert.doesNotThrow(() => {
  apply({ a: [1, 'b', true] }, [
    { op: 'test', path: '/a', value: [1, 'b', true] },
  ]);
});
//
// o  objects: are considered equal if they contain the same number of
//    members, and if each member can be considered equal to a member in
//    the other object, by comparing their keys (as strings) and their
//    values (using this list of type-specific rules).
assert.doesNotThrow(() => {
  apply({ a: { b1: 1, b2: 'b', b3: true } }, [
    { op: 'test', path: '/a', value: { b1: 1, b2: 'b', b3: true } },
  ]);
});
//
// o  literals (false, true, and null): are considered equal if they are
//    the same.
assert.doesNotThrow(() => {
  apply({ a: false }, [{ op: 'test', path: '/a', value: false }]);
});
assert.doesNotThrow(() => {
  apply({ a: true }, [{ op: 'test', path: '/a', value: true }]);
});
assert.doesNotThrow(() => {
  apply({ a: null }, [{ op: 'test', path: '/a', value: null }]);
});
//
// Note that the comparison that is done is a logical comparison; e.g.,
// whitespace between the member values of an array is not significant.
//
// Also, note that ordering of the serialization of object members is
// not significant.
//
// For example:
//
// { "op": "test", "path": "/a/b/c", "value": "foo" }
//
// 5.  Error Handling
//
// If a normative requirement is violated by a JSON Patch document, or
// if an operation is not successful, evaluation of the JSON Patch
// document SHOULD terminate and application of the entire patch
// document SHALL NOT be deemed successful.
//
// See [RFC5789], Section 2.2 for considerations regarding handling
// errors when JSON Patch is used with the HTTP PATCH method, including
// suggested status codes to use to indicate various conditions.
//
// Note that the HTTP PATCH method is atomic, as per [RFC5789].
// Therefore, the following patch would result in no changes being made
// to the document at all (because the "test" operation results in an
// error):
//
// [
//   { "op": "replace", "path": "/a/b/c", "value": 42 },
//   { "op": "test", "path": "/a/b/c", "value": "C" }
// ]
{
  const original = { a: { b: { c: 41 } } };

  try {
    apply(original, [
      { op: 'replace', path: '/a/b/c', value: 42 },
      { op: 'test', path: '/a/b/c', value: 'C' },
    ]);
  } catch (e) {
    // ignore
  }

  assert.deepStrictEqual(original, { a: { b: { c: 41 } } });
}

console.debug('ok')