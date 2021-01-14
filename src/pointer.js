import { JsonPatchError } from './json-patch-error.js';
import { isArray, isObject } from './util.js';

function validatePath(path) {
  if (typeof path !== 'string') {
    throw new JsonPatchError(
      `bad path: should be a string, was ${typeof path}`
    );
  }

  if (path[0] !== '/' && path !== '') {
    throw new JsonPatchError('bad path: should be "" or start with "/"');
  }
}

function parseTokenString(tokenString, context) {
  if (isObject(context)) {
    const decodedTokenString =
      tokenString
        .replace('~1', '/')
        .replace('~0', '~');
    return decodedTokenString;
  } else if (isArray(context)) {
    if (tokenString === '-') {
      return context.length;
    }

    const tokenNumber = parseInt(tokenString, 10);

    if (isNaN(tokenNumber) || tokenNumber != tokenString) {
      throw new JsonPatchError(
        `path token is not a valid array index, was ${JSON.stringify(tokenString)}`
      );
    }

    return tokenNumber;
  } else {
    throw new JsonPatchError(
      `token context should either be an array or a string, was ${typeof context}`
    );
  }
}

export class Pointer {
  constructor(path) {
    validatePath(path);

    this.tokenStrings = path.split('/').slice(1);
    this.nextTokenIndex = 0;
  }

  isPrefixTo(anotherPointer) {
    if (!(anotherPointer instanceof Pointer)) {
      throw new JsonPatchError(
        `arg is not a pointer, was ${typeof anotherPointer}`
      );
    }

    for (const [index, tokenString] of this.tokenStrings.entries()) {
      if (tokenString !== anotherPointer.tokenStrings[index]) {
        return false;
      }
    }

    return true;
  }

  tokensLeft() {
    return this.tokenStrings.length - this.nextTokenIndex;
  }

  isFullyRead() {
    return this.tokensLeft() <= 0;
  }

  readNextTokenInContext(contextItem) {
    const tokenString = this.tokenStrings[this.nextTokenIndex];

    if (tokenString === undefined) {
      const validSection = this.tokenStrings
        .slice(0, this.nextTokenIndex - 1)
        .join('/');
      throw new JsonPatchError(
        `pointer is already fully read; valid section was "${validSection}"`
      );
    }

    ++this.nextTokenIndex;

    return parseTokenString(tokenString, contextItem);
  }

  rewind() {
    this.nextTokenIndex = 0;
  }
}
