import { compare } from './compare.js';
import { JsonPatchError } from './json-patch-error.js';
import { Pointer } from './pointer.js';
import { isArray, isObject } from './util.js';

export { JsonPatchError };

function has(element, pointer) {
  if (pointer.isFullyRead()) {
    return true;
  }

  const index = pointer.readNextTokenInContext(element);

  if (element[index] === undefined) {
    return false;
  }

  return has(element[index], pointer);
}

function get(element, pointer) {
  if (pointer.isFullyRead()) {
    return element;
  }

  const index = pointer.readNextTokenInContext(element);

  if (element[index] === undefined) {
    throw new JsonPatchError(`path does not lead anywhere`);
  }

  return get(element[index], pointer);
}

function add(element, pointer, value) {
  const index = pointer.readNextTokenInContext(element);

  let modifiedMember;
  if (pointer.isFullyRead()) {
    modifiedMember = value;
  } else {
    const deeperElement = element[index];

    if (!isArray(deeperElement) && !isObject(deeperElement)) {
      throw new JsonPatchError(
        `path leads to an element that is neither an array nor an object but ${typeof deeperElement}`
      );
    }

    modifiedMember = add(deeperElement, pointer, value);
  }

  if (isArray(element)) {
    if (index > element.length) {
      throw new JsonPatchError(`path points to an index that is out-of-bounds`);
    }

    const newElement = [...element];
    newElement.splice(index, 0, modifiedMember);
    return newElement;
  } else {
    const newElement = { ...element };
    newElement[index] = modifiedMember;
    return newElement;
  }
}

function replace(element, pointer, value) {
  const index = pointer.readNextTokenInContext(element);

  let modifiedMember;
  if (pointer.isFullyRead()) {
    modifiedMember = value;
  } else {
    const deeperElement = element[index];

    if (!isArray(deeperElement) && !isObject(deeperElement)) {
      throw new JsonPatchError(
        `path leads to an element that is neither an array nor an object but ${typeof deeperElement}`
      );
    }

    modifiedMember = replace(deeperElement, pointer, value);
  }

  if (isArray(element)) {
    const newElement = [...element];
    newElement.splice(index, 1, modifiedMember);
    return newElement;
  } else {
    const newElement = { ...element };
    newElement[index] = modifiedMember;
    return newElement;
  }
}

function remove(element, pointer) {
  const index = pointer.readNextTokenInContext(element);

  if (pointer.isFullyRead()) {
    if (element[index] === undefined) {
      throw new JsonPatchError(`path does not lead anywhere`);
    }

    if (isArray(element)) {
      const newElement = [...element];
      newElement.splice(index, 1);
      return newElement;
    } else {
      const newElement = { ...element };
      delete newElement[index];
      return newElement;
    }
  }

  const deeperElement = element[index];

  if (!isArray(deeperElement) && !isObject(deeperElement)) {
    throw new JsonPatchError(
      `path leads to an element that is neither an array nor an object but ${typeof deeperElement}`
    );
  }

  const modifiedMember = remove(deeperElement, pointer);

  if (isArray(element)) {
    const newElement = [...element];
    newElement.splice(index, 1, modifiedMember);
    return newElement;
  } else {
    const newElement = { ...element };
    newElement[index] = modifiedMember;
    return newElement;
  }
}

export function apply(document, patch) {
  if (!Array.isArray(patch)) {
    throw new JsonPatchError('bad patch: should be an array of operations');
  }

  // Wrapping the processed document and prefixing operations' paths with `/document`
  // lets us work with far fewer ifs and elses
  let wrappedDocument = { document };

  for (const operation of patch) {
    const createPathPointer = () => new Pointer(operation.path, '/document');
    const createFromPointer = () =>
      'from' in operation ? new Pointer(operation.from, '/document') : null;

    switch (operation.op) {
      case 'add':
        try {
          if (!('value' in operation)) {
            throw new JsonPatchError('missing value');
          }

          wrappedDocument = add(
            wrappedDocument,
            createPathPointer(),
            operation.value
          );
        } catch (e) {
          e.describe('add failed');
          throw e;
        }
        break;

      case 'copy':
        try {
          if (!('from' in operation)) {
            throw new JsonPatchError('missing from');
          }

          const value = get(wrappedDocument, createFromPointer());
          wrappedDocument = replace(
            wrappedDocument,
            createPathPointer(),
            value
          );
        } catch (e) {
          e.describe('copy failed');
          throw e;
        }
        break;

      case 'move':
        try {
          if (!('from' in operation)) {
            throw new JsonPatchError('missing from');
          }

          if (createFromPointer().isPrefixOf(createPathPointer())) {
            throw new JsonPatchError(
              'from pointer cannot be a prefix of path pointer'
            );
          }

          const value = get(wrappedDocument, createFromPointer());
          wrappedDocument = replace(
            wrappedDocument,
            createPathPointer(),
            value
          );
          wrappedDocument = remove(wrappedDocument, createFromPointer());
        } catch (e) {
          e.describe('move failed');
          throw e;
        }
        break;

      case 'remove':
        try {
          wrappedDocument = remove(wrappedDocument, createPathPointer());
        } catch (e) {
          e.describe('remove failed');
          throw e;
        }
        break;

      case 'replace':
        try {
          if (!('value' in operation)) {
            throw new JsonPatchError('missing value');
          }

          if (!has(wrappedDocument, createPathPointer())) {
            throw new JsonPatchError('path points to a nonexistent location');
          }

          wrappedDocument = replace(
            wrappedDocument,
            createPathPointer(),
            operation.value
          );
        } catch (e) {
          e.describe('replace failed');
          throw e;
        }
        break;

      case 'test':
        try {
          if (!('value' in operation)) {
            throw new JsonPatchError('missing value');
          }

          compare(operation.value, get(wrappedDocument, createPathPointer()));
        } catch (e) {
          e.describe('test failed');
          throw e;
        }
        break;

      default:
        throw new JsonPatchError(
          `illegal op: should be add/copy/move/remove/replace/test, was ${JSON.stringify(operation.op)}`
        );
    }
  }

  return wrappedDocument.document;
}
