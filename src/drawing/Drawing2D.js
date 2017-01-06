import PImage from "../Processing Objects/PImage";
import DrawingShared from "./DrawingShared";

export default class Drawing2D extends DrawingShared {
	constructor(sketch, canvas, context) {
    super(sketch, canvas, context);
	}

  size(aWidth, aHeight, aMode) {
    if (this.curContext === undefined) {
      // size() was called without p.init() default context, i.e. p.createGraphics()
      this.curContext = curElement.getContext("2d");
//      this.userMatrixStack = new PMatrixStack();
//      this.userReverseMatrixStack = new PMatrixStack();
//      this.modelView = new PMatrix2D();
//      this.modelViewInv = new PMatrix2D();
    }

    super.size(aWidth, aHeight, aMode);
  }

  background(arg1, arg2, arg3, arg4) {
    if (arg1 !== undefined) {
      super.backgroundHelper(arg1, arg2, arg3, arg4);
    }

    let p = this.curSketch;
    let backgroundObj = this.backgroundObj;

    this.saveContext();

    if (backgroundObj instanceof PImage || backgroundObj.__isPImage) {
      this.curContext.setTransform(1, 0, 0, 1, 0, 0);
      p.image(backgroundObj, 0, 0);
    }

    else {
      this.curContext.setTransform(1, 0, 0, 1, 0, 0);
      // If the background is transparent
      if (p.alpha(backgroundObj) !== this.colorModeA) {
        this.curContext.clearRect(0,0, p.width, p.height);
      }
      this.curContext.fillStyle = p.color.toString(backgroundObj);
      this.curContext.fillRect(0, 0, p.width, p.height);
      this.isFillDirty = true;
    }
    this.restoreContext();
  }
}