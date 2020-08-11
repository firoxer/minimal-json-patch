import { JsonPatchError } from './json-patch-error.js';
import { isArray, isObject } from './util.js';

function compareObject(object, value) {
  if (!isObject(value)) {
    throw new JsonPatchError('test target is an object but the value is not');
  }

  if (Object.keys(object).length !== Object.keys(value).length) {
    throw new JsonPatchError(
      'test target has a different number of keys than the compared value'
    );
  }

  for (const valueKey in value) {
    if (!(valueKey in object)) {
      throw new JsonPatchError(`test target lacks a key: ${valueKey}`);
    }
  }

  for (const key in object) {
    if (!(key in value)) {
      throw new JsonPatchError(`test target has an extra key: ${key}`);
    }
  }

  for (const valueKey in value) {
    compare(object[valueKey], value[valueKey]);
  }
}

function compareArray(array, value) {
  if (!isArray(value)) {
    throw new JsonPatchError('test target is an array but the value is not');
  }

  if (array.length !== value.length) {
    throw new JsonPatchError(
      'test target and value are arrays of differing length'
    );
  }

  for (let i = 0; i < array.length; ++i) {
    compare(array[i], value[i]);
  }
}

function comparePrimitive(primitive, value) {
  if (primitive !== value) {
    throw new JsonPatchError(
      `${primitive} is not equal to ${JSON.stringify(value)}`
    );
  }
}

export function compare(item, value) {
  if (isObject(item)) {
    compareObject(item, value);
  } else if (isArray(item)) {
    compareArray(item, value);
  } else {
    comparePrimitive(item, value);
  }
}
