/**
 * @private
 * The matrix stack stores the transformations and translations that occur within the space.
 */
export default class PMatrixStack {
  constructor(Drawing2Dor3D) {
    this.stackType = Drawing2Dor3D;
    this.matrixStack = [];
  }

  load() {
    let tmpMatrix = this.stackType.$newPMatrix();

    if (arguments.length === 1) {
      tmpMatrix.set(arguments[0]);
    } else {
      tmpMatrix.set(arguments);
    }
    this.matrixStack.push(tmpMatrix);
  }
}