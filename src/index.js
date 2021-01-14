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
    throw new JsonPatchError('pointer does not lead anywhere');
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
        `pointer leads to an element that is neither an array nor an object but ${typeof deeperElement}`
      );
    }

    modifiedMember = add(deeperElement, pointer, value);
  }

  if (isArray(element)) {
    if (index > element.length) {
      throw new JsonPatchError(`pointer points to an index that is out-of-bounds`);
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
        `pointer leads to an element that is neither an array nor an object but ${typeof deeperElement}`
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
      throw new JsonPatchError(`pointer does not lead anywhere`);
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
      `pointer leads to an element that is neither an array nor an object but ${typeof deeperElement}`
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

function applyOperation(document, operation) {
  switch (operation.op) {
    case 'add':
      try {
        if (!('value' in operation)) {
          throw new JsonPatchError('missing value');
        }

        if (operation.path === '') {
          // Since the destination of the addition is root itself, we can just
          // return the operation value directly
          return operation.value;
        }

        return add(document, new Pointer(operation.path), operation.value);
      } catch (e) {
        if (e instanceof JsonPatchError) {
          e.describe('add failed');
        }
        throw e;
      }

    case 'copy':
      try {
        if (!('from' in operation)) {
          throw new JsonPatchError('missing from');
        }

        const value = get(document, new Pointer(operation.from));

        if (operation.path === '') {
          // Since the destination of the copy is root itself, we can just
          // return the source of the copy directly
          return value;
        }

        return add(document, new Pointer(operation.path), value);
      } catch (e) {
        if (e instanceof JsonPatchError) {
          e.describe('copy failed');
        }
        throw e;
      }

    case 'move':
      try {
        if (!('from' in operation)) {
          throw new JsonPatchError('missing from');
        }

        if (operation.from === operation.path) {
          // No-op
          return document;
        }

        const fromPointer = new Pointer(operation.from);
        const pathPointer = new Pointer(operation.path);

        if (fromPointer.isPrefixTo(pathPointer)) {
          throw new JsonPatchError(
            'from pointer cannot be a prefix of path pointer'
          );
        }

        const value = get(document, fromPointer);

        if (operation.path === '') {
          // Since the destination of the move is root itself, we can just
          // return the source of the move directly
          return value;
        }

        document = replace(document, pathPointer, value);

        if (pathPointer.isPrefixTo(fromPointer)) {
          // No need to remove anything since the "from" element has already
          // taken the place of the "path" element
          return document;
        }

        fromPointer.rewind();
        return remove(document, fromPointer);
      } catch (e) {
        if (e instanceof JsonPatchError) {
          e.describe('move failed');
        }
        throw e;
      }

    case 'remove':
      try {
        if (operation.path === '') {
          // When deleting the root of the document, the outcome is undefined,
          // so let's return `null` and hope that's good enough
          return null;
        }

        return remove(document, new Pointer(operation.path));
      } catch (e) {
        if (e instanceof JsonPatchError) {
          e.describe('remove failed');
        }
        throw e;
      }

    case 'replace':
      try {
        if (!('value' in operation)) {
          throw new JsonPatchError('missing value');
        }

        if (operation.path === '') {
          // Since the destination of the replacement is root itself, we can
          // just return the intended replacement value directly
          return operation.value;
        }

        const pathPointer = new Pointer(operation.path);

        if (!has(document, pathPointer)) {
          throw new JsonPatchError('pointer points to a nonexistent location');
        }

        pathPointer.rewind();

        return replace(document, pathPointer, operation.value);
      } catch (e) {
        if (e instanceof JsonPatchError) {
          e.describe('replace failed');
        }
        throw e;
      }

    case 'test':
      try {
        if (!('value' in operation)) {
          throw new JsonPatchError('missing value');
        }

        compare(operation.value, get(document, new Pointer(operation.path)));

        return document; // Unchanged as it should
      } catch (e) {
        if (e instanceof JsonPatchError) {
          e.describe('test failed');
        }
        throw e;
      }

    default:
      throw new JsonPatchError(
        `illegal op: should be add/copy/move/remove/replace/test, was ${JSON.stringify(operation.op)}`
      );
  }
}

export function applyPatch(document, patch) {
  if (!Array.isArray(patch)) {
    throw new JsonPatchError('bad patch: should be an array of operations');
  }

  for (const operation of patch) {
    document = applyOperation(document, operation);
  }

  return document;
}
