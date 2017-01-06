import PMatrix2D from "./PMatrix2D";
import PMatrixStack from "../PMatrixStack";
import PImage from "../../Processing Objects/PImage";
import DrawingShared from "../DrawingShared";

export default class Drawing2D extends DrawingShared {
	constructor(sketch, canvas, context) {
    super(sketch, canvas, context);
	}

  $newPMatrix() {
    return new PMatrix2D();
  }

  size(aWidth, aHeight, aMode) {
    this.curContext = this.curElement.getContext("2d");
    this.userMatrixStack = new PMatrixStack();
    this.userReverseMatrixStack = new PMatrixStack();
    this.modelView = new PMatrix2D();
    this.modelViewInv = new PMatrix2D();
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

  stroke(...colors) {
    super.stroke(...colors);
    this.isStrokeDirty = true;
  }


  fill(...colors) {
    super.fill(...colors);
    this.isFillDirty = true;
  }

  /**
   * Draws a line (a direct path between two points) to the screen. The version of line() with four parameters
   * draws the line in 2D. To color a line, use the stroke() function. A line cannot be filled, therefore the
   * fill()  method will not affect the color of a line. 2D lines are drawn with a width of one pixel by default,
   * but this can be changed with the strokeWeight()  function. The version with six parameters allows the line
   * to be placed anywhere within XYZ space. Drawing this shape in 3D using the z parameter requires the P3D or
   * OPENGL parameter in combination with size.
   *
   * @param {int|float} x1       x-coordinate of the first point
   * @param {int|float} y1       y-coordinate of the first point
   * @param {int|float} z1       z-coordinate of the first point
   * @param {int|float} x2       x-coordinate of the second point
   * @param {int|float} y2       y-coordinate of the second point
   * @param {int|float} z2       z-coordinate of the second point
   *
   * @see strokeWeight
   * @see strokeJoin
   * @see strokeCap
   * @see beginShape
   */
  line(x1, y1, x2, y2) {
    if (!this.doStroke) {
      return;
    }

    if (!this.renderSmooth) {
      x1 = Math.round(x1);
      x2 = Math.round(x2);
      y1 = Math.round(y1);
      y2 = Math.round(y2);
    }

    // A line is only defined if it has different start and end coordinates.
    // If they are the same, we call point instead.
    if (x1 === x2 && y1 === y2) {
      return this.curSketch.point(x1, y1);
    }

    let context = this.curContext,
        lineCap = undefined,
        lineWidth = this.lineWidth,
        drawCrisp = true,
        currentModelView = this.modelView.array(),
        identityMatrix = [1, 0, 0, 0, 1, 0];

    // Test if any transformations have been applied to the sketch
    for (let i = 0; i < 6 && drawCrisp; i++) {
      drawCrisp = currentModelView[i] === identityMatrix[i];
    }

    /* Draw crisp lines if the line is vertical or horizontal with the following method
     * If any transformations have been applied to the sketch, don't make the line crisp
     * If the line is directed up or to the left, reverse it by swapping x1/x2 or y1/y2
     * Make the line 1 pixel longer to work around cross-platform canvas implementations
     * If the lineWidth is odd, translate the line by 0.5 in the perpendicular direction
     * Even lineWidths do not need to be translated because the canvas will draw them on pixel boundaries
     * Change the cap to butt-end to work around cross-platform canvas implementations
     * Reverse the translate and lineCap canvas state changes after drawing the line
     */
    if (drawCrisp) {
      let swap;
      if (x1 === x2) {
        if (y1 > y2) {
          swap = y1;
          y1 = y2;
          y2 = swap;
        }
        y2++;
        if (lineWidth % 2 === 1) {
          context.translate(0.5, 0.0);
        }
      } else if (y1 === y2) {
        if (x1 > x2) {
          swap = x1;
          x1 = x2;
          x2 = swap;
        }
        x2++;
        if (lineWidth % 2 === 1) {
          context.translate(0.0, 0.5);
        }
      }
      if (lineWidth === 1) {
        lineCap = context.lineCap;
        context.lineCap = 'butt';
      }
    }

    context.beginPath();
    context.moveTo(x1 || 0, y1 || 0);
    context.lineTo(x2 || 0, y2 || 0);
    this.executeContextStroke();

    if (drawCrisp) {
      if (x1 === x2 && lineWidth % 2 === 1) {
        context.translate(-0.5, 0.0);
      } else if (y1 === y2 && lineWidth % 2 === 1) {
        context.translate(0.0, -0.5);
      }
      if (lineWidth === 1) {
        context.lineCap = lineCap;
      }
    }
  }

  /**
   * Rotates a shape the amount specified by the angle parameter. Angles should be specified in radians
   * (values from 0 to TWO_PI) or converted to radians with the radians() function. Objects are always
   * rotated around their relative position to the origin and positive numbers rotate objects in a
   * clockwise direction. Transformations apply to everything that happens after and subsequent calls
   * to the function accumulates the effect. For example, calling rotate(HALF_PI) and then rotate(HALF_PI)
   * is the same as rotate(PI). All tranformations are reset when draw() begins again. Technically,
   * rotate() multiplies the current transformation matrix by a rotation matrix. This function can be
   * further controlled by the pushMatrix() and popMatrix().
   *
   * @param {int|float} angleInRadians     angle of rotation specified in radians
   *
   * @returns none
   *
   * @see rotateX
   * @see rotateY
   * @see rotateZ
   * @see rotate
   * @see translate
   * @see scale
   * @see popMatrix
   * @see pushMatrix
   */
  rotate(angleInRadians) {
    this.modelView.rotateZ(angleInRadians);
    this.modelViewInv.invRotateZ(angleInRadians);
    this.curContext.rotate(angleInRadians);
  }

  /**
   * Specifies an amount to displace objects within the display window. The x parameter specifies left/right translation,
   * the y parameter specifies up/down translation, and the z parameter specifies translations toward/away from the screen.
   * Using this function with the z  parameter requires using the P3D or OPENGL parameter in combination with size as shown
   * in the above example. Transformations apply to everything that happens after and subsequent calls to the function
   * accumulates the effect. For example, calling translate(50, 0) and then translate(20, 0) is the same as translate(70, 0).
   * If translate() is called within draw(), the transformation is reset when the loop begins again.
   * This function can be further controlled by the pushMatrix() and popMatrix().
   *
   * @param {int|float} x        left/right translation
   * @param {int|float} y        up/down translation
   * @param {int|float} z        forward/back translation
   *
   * @returns none
   *
   * @see pushMatrix
   * @see popMatrix
   * @see scale
   * @see rotate
   * @see rotateX
   * @see rotateY
   * @see rotateZ
  */
  translate(x, y) {
    this.modelView.translate(x, y);
    this.modelViewInv.invTranslate(x, y);
    this.curContext.translate(x, y);
  }

};
