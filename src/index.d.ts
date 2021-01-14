type JsonValue =
  | number
  | string
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue }
  | {}
  | null;

interface AddOperation {
  op: 'add';
  path: string;
  value: JsonValue;
}

interface CopyOperation {
  op: 'copy';
  from: string;
  path: string;
}

interface MoveOperation {
  op: 'move';
  from: string;
  path: string;
}

interface RemoveOperation {
  op: 'remove';
  path: string;
}

interface ReplaceOperation {
  op: 'replace';
  path: string;
  value: JsonValue;
}

interface TestOperation {
  op: 'test';
  path: string;
  value: JsonValue;
}

type Operation =
  | AddOperation
  | CopyOperation
  | MoveOperation
  | RemoveOperation
  | ReplaceOperation
  | TestOperation;

export function applyPatch(document: JsonValue, patch: Operation[]): JsonValue;

export class JsonPatchError extends Error {}
