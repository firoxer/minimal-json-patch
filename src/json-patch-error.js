// TODO: Context
export class JsonPatchError extends Error {
  describe(description) {
    this.message = `${description}: ${this.message}`;
  }
}
