import drawFunctions from "./drawFunctions";
import PConstants from "../PConstants";
import PFont from "../Processing Objects/PFont/PFont";
import PImage from "../Processing Objects/PImage";

export default class DrawingShared {
  constructor(sketch, canvas, context) {
    this.curSketch = sketch;
    this.curElement = canvas;
    this.curContext = context;

    this.drawing, // hold a Drawing2D or Drawing3D object
    this.doFill = true;
    this.fillStyle = [1.0, 1.0, 1.0, 1.0];
    this.currentFillColor = 0xFFFFFFFF;
    this.isFillDirty = true;
    this.doStroke = true;
    this.strokeStyle = [0.0, 0.0, 0.0, 1.0];
    this.currentStrokeColor = 0xFF000000;
    this.isStrokeDirty = true;
    this.lineWidth = 1;
    this.loopStarted = false;
    this.renderSmooth = false;
    this.doLoop = true;
    this.looping = 0;
    this.curRectMode = PConstants.CORNER;
    this.curEllipseMode = PConstants.CENTER;
    this.normalX = 0;
    this.normalY = 0;
    this.normalZ = 0;
    this.normalMode = PConstants.NORMAL_MODE_AUTO;
    this.curFrameRate = 60;
    this.curMsPerFrame = 1000/this.curFrameRate;
    this.curCursor = PConstants.ARROW;
    this.oldCursor = this.curElement.style.cursor;
    this.curShape = PConstants.POLYGON;
    this.curShapeCount = 0;
    this.curvePoints = [];
    this.curTightness = 0;
    this.curveDet = 20;
    this.curveInited = false;
    this.backgroundObj = -3355444, // rgb(204, 204, 204) is the default gray background colour
    this.bezDetail = 20;
    this.colorModeA = 255;
    this.colorModeX = 255;
    this.colorModeY = 255;
    this.colorModeZ = 255;
    this.pathOpen = false;
    this.mouseDragging = false;
    this.pmouseXLastFrame = 0;
    this.pmouseYLastFrame = 0;
    this.curColorMode = PConstants.RGB;
    this.curTint = null;
    this.curTint3d = null;
    this.getLoaded = false;
    this.start = Date.now();
    this.timeSinceLastFPS = this.start;
    this.framesSinceLastFPS = 0;
    this.textcanvas = undefined;
    this.curveBasisMatrix = undefined;
    this.curveToBezierMatrix = undefined;
    this.curveDrawMatrix = undefined;
    this.bezierDrawMatrix = undefined;
    this.bezierBasisInverse = undefined;
    this.bezierBasisMatrix = undefined;
    this.curContextCache = {
      attributes: {},
      locations: {}
    };

    // Shaders
    this.programObject3D = undefined;
    this.programObject2D = undefined;
    this.programObjectUnlitShape = undefined;
    this.boxBuffer = undefined;
    this.boxNormBuffer = undefined;
    this.boxOutlineBuffer = undefined;
    this.rectBuffer = undefined;
    this.rectNormBuffer = undefined;
    this.sphereBuffer = undefined;
    this.lineBuffer = undefined;
    this.fillBuffer = undefined;
    this.fillColorBuffer = undefined;
    this.strokeColorBuffer = undefined;
    this.pointBuffer = undefined;
    this.shapeTexVBO = undefined;
    this.canTex,   // texture for createGraphics
    this.textTex,   // texture for 3d tex
    this.curTexture = {width:0,height:0};
    this.curTextureMode = PConstants.IMAGE;
    this.usingTexture = false;
    this.textBuffer = undefined;
    this.textureBuffer = undefined;
    this.indexBuffer = undefined;

    // Text alignment
    this.horizontalTextAlignment = PConstants.LEFT;
    this.verticalTextAlignment = PConstants.BASELINE;
    this.textMode = PConstants.MODEL;

    // Font state
    this.curFontName = "Arial";
    this.curTextSize = 12;
    this.curTextAscent = 9;
    this.curTextDescent = 2;
    this.curTextLeading = 14;
    this.curTextFont = PFont.get(this.curFontName, this.curTextSize);

    // Pixels cache
    this.originalContext = undefined;
    this.proxyContext = null;
    this.isContextReplaced = false;
    this.setPixelsCached = undefined;
    this.maxPixelsCached = 1000;
    this.pressedKeysMap = [];
    this.lastPressedKeyCode = null;
    this.codedKeys = [ PConstants.SHIFT, PConstants.CONTROL, PConstants.ALT, PConstants.CAPSLK, PConstants.PGUP, PConstants.PGDN,
                      PConstants.END, PConstants.HOME, PConstants.LEFT, PConstants.UP, PConstants.RIGHT, PConstants.DOWN, PConstants.NUMLK,
                      PConstants.INSERT, PConstants.F1, PConstants.F2, PConstants.F3, PConstants.F4, PConstants.F5, PConstants.F6, PConstants.F7,
                      PConstants.F8, PConstants.F9, PConstants.F10, PConstants.F11, PConstants.F12, PConstants.META ];

    // User can only have MAX_LIGHTS lights
    this.lightCount = 0;

    //sphere stuff
    this.sphereDetailV = 0;
    this.sphereDetailU = 0;
    this.sphereX = [];
    this.sphereY = [];
    this.sphereZ = [];
    this.sinLUT = new Float32Array(PConstants.SINCOS_LENGTH);
    this.cosLUT = new Float32Array(PConstants.SINCOS_LENGTH);
    this.sphereVerts = undefined;
    this.sphereNorms;

    // Camera defaults and settings
    this.cam = undefined;
    this.cameraInv = undefined;
    this.modelView = undefined;
    this.modelViewInv = undefined;
    this.userMatrixStack = undefined;
    this.userReverseMatrixStack = undefined;
    this.inverseCopy = undefined;
    this.projection = undefined;
    this.manipulatingCamera = false;
    this.frustumMode = false;
    this.cameraFOV = 60 * (Math.PI / 180);
    this.cameraX = sketch.width / 2;
    this.cameraY = sketch.height / 2;
    this.cameraZ = this.cameraY / Math.tan(this.cameraFOV / 2);
    this.cameraNear = this.cameraZ / 10;
    this.cameraFar = this.cameraZ * 10;
    this.cameraAspect = sketch.width / sketch.height;

    this.vertArray = [];
    this.curveVertArray = [];
    this.curveVertCount = 0;
    this.isCurve = false;
    this.isBezier = false;
    this.firstVert = true;

    // PShape stuff
    this.curShapeMode = PConstants.CORNER;

    // Stores states for pushStyle() and popStyle().
    this.styleArray = [];

    // The vertices for the box cannot be specified using a triangle strip since each
    // side of the cube must have its own set of normals.
    // Vertices are specified in a counter-clockwise order.
    // Triangles are in this order: back, front, right, bottom, left, top.
    this.boxVerts = new Float32Array([
       0.5,  0.5, -0.5,  0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,
       0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5,
       0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5,
       0.5, -0.5, -0.5,  0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,
      -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5, -0.5, -0.5, -0.5,
       0.5,  0.5,  0.5,  0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5]);

    this.boxOutlineVerts = new Float32Array([
       0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5, -0.5,  0.5, -0.5, -0.5,
      -0.5,  0.5, -0.5, -0.5, -0.5, -0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5,
       0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5, -0.5,
      -0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5,
       0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5, -0.5, -0.5, -0.5,
      -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5]);

    this.boxNorms = new Float32Array([
       0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,
       0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,
       1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,
       0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,
      -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0,
       0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0]);

    // These verts are used for the fill and stroke using TRIANGLE_FAN and LINE_LOOP.
    this.rectVerts = new Float32Array([0,0,0, 0,1,0, 1,1,0, 1,0,0]);
    this.rectNorms = new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1]);

    // set up sketch function biundings
    this.bindSketchFNames(sketch);
  }

  bindSketchFNames(p) {
    drawFunctions.forEach(fn => {
      p[fn] = this[fn].bind(this);
    });
  }

  a3DOnlyFunction() {
    // noop
  }

  $ensureContext() {
    return this.curContext;
  }

  saveContext() {
    this.curContext.save();
  }

  restoreContext() {
    this.curContext.restore();
    this.isStrokeDirty = true;
    this.isFillDirty = true;
  }

  /**
  * Multiplies the current matrix by the one specified through the parameters. This is very slow because it will
  * try to calculate the inverse of the transform, so avoid it whenever possible. The equivalent function
  * in OpenGL is glMultMatrix().
  *
  * @param {int|float} n00-n15      numbers which define the 4x4 matrix to be multiplied
  *
  * @returns none
  *
  * @see popMatrix
  * @see pushMatrix
  * @see resetMatrix
  * @see printMatrix
  */
  applyMatrix() {
    var a = arguments;
    this.modelView.apply(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15]);
    this.modelViewInv.invApply(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15]);
  }

  /**
  * Defines the dimension of the display window in units of pixels. The size() function must
  * be the first line in setup(). If size() is not called, the default size of the window is
  * 100x100 pixels. The system variables width and height are set by the parameters passed to
  * the size() function.
  *
  * @param {int} aWidth     width of the display window in units of pixels
  * @param {int} aHeight    height of the display window in units of pixels
  * @param {MODE} aMode     Either P2D, P3D, JAVA2D, or OPENGL
  *
  * @see createGraphics
  * @see screen
  */
  size(aWidth, aHeight, aMode) {
    if (this.doStroke) {
      this.curSketch.stroke(0);
    }

    if (this.doFill) {
      this.curSketch.fill(255);
    }

    let curContext = this.curContext;
    let curElement = this.curElement;
    let curTextFont= this.curTextFont;

    // The default 2d context has already been created in the p.init() stage if
    // a 3d context was not specified. This is so that a 2d context will be
    // available if size() was not called.
    let savedProperties = {
      fillStyle: curContext.fillStyle,
      strokeStyle: curContext.strokeStyle,
      lineCap: curContext.lineCap,
      lineJoin: curContext.lineJoin
    };

    // remove the style width and height properties to ensure that the canvas gets set to
    // aWidth and aHeight coming in
    if (curElement.style.length > 0 ) {
      curElement.style.removeProperty("width");
      curElement.style.removeProperty("height");
    }

    this.curElement.width = this.curSketch.width = aWidth || 100;
    this.curElement.height = this.curSketch.height = aHeight || 100;

    for (var prop in savedProperties) {
      if (savedProperties.hasOwnProperty(prop)) {
        this.curContext[prop] = savedProperties[prop];
      }
    }

    // make sure to set the default font the first time round.
    this.curSketch.textFont(curTextFont);

    // Set the background to whatever it was called last as if background() was called before size()
    // If background() hasn't been called before, set background() to a light gray
    this.curSketch.background();

    // set 5% for pixels to cache (or 1000)
    this.maxPixelsCached = Math.max(1000, aWidth * aHeight * 0.05);

//
// FIXME: TODO: do we still need this with the rewrite?
//
//    // Externalize the context
//    this.curSketch.externals.context = curContext;

    for (let i = 0; i < PConstants.SINCOS_LENGTH; i++) {
      this.sinLUT[i] = Math.sin(i * (Math.PI / 180) * 0.5);
      this.cosLUT[i] = Math.cos(i * (Math.PI / 180) * 0.5);
    }
  }

  redraw() {
    let p = this.curSketch;
    p.$redrawHelper();
    this.curContext.lineWidth = this.lineWidth;
    // var pmouseXLastEvent = p.pmouseX,
    //     pmouseYLastEvent = p.pmouseY;
    // p.pmouseX = pmouseXLastFrame;
    // p.pmouseY = pmouseYLastFrame;
    this.saveContext();
    p.draw();
    this.restoreContext();
    // pmouseXLastFrame = p.mouseX;
    // pmouseYLastFrame = p.mouseY;
    // p.pmouseX = pmouseXLastEvent;
    // p.pmouseY = pmouseYLastEvent;
  };

  /**
   * The fill() function sets the color used to fill shapes. For example, if you run <b>fill(204, 102, 0)</b>, all subsequent shapes will be filled with orange.
   * This color is either specified in terms of the RGB or HSB color depending on the current <b>colorMode()</b>
   *(the default color space is RGB, with each value in the range from 0 to 255).
   * <br><br>When using hexadecimal notation to specify a color, use "#" or "0x" before the values (e.g. #CCFFAA, 0xFFCCFFAA).
   * The # syntax uses six digits to specify a color (the way colors are specified in HTML and CSS). When using the hexadecimal notation starting with "0x";
   * the hexadecimal value must be specified with eight characters; the first two characters define the alpha component and the remainder the red, green, and blue components.
   * <br><br>The value for the parameter "gray" must be less than or equal to the current maximum value as specified by <b>colorMode()</b>. The default maximum value is 255.
   * <br><br>To change the color of an image (or a texture), use tint().
   *
   * @param {int|float} gray    number specifying value between white and black
   * @param {int|float} value1  red or hue value
   * @param {int|float} value2  green or saturation value
   * @param {int|float} value3  blue or brightness value
   * @param {int|float} alpha   opacity of the fill
   * @param {Color} color       any value of the color datatype
   * @param {int} hex           color value in hexadecimal notation (i.e. #FFCC00 or 0xFFFFCC00)
   *
   * @see #noFill()
   * @see #stroke()
   * @see #tint()
   * @see #background()
   * @see #colorMode()
   */
  fill(...channels) {
    let color = this.curSketch.color(...channels);
    if(color === this.currentFillColor && this.doFill) {
      return;
    }
    this.doFill = true;
    this.currentFillColor = color;
  }

  /**
   * The stroke() function sets the color used to draw lines and borders around shapes. This color
   * is either specified in terms of the RGB or HSB color depending on the
   * current <b>colorMode()</b> (the default color space is RGB, with each
   * value in the range from 0 to 255).
   * <br><br>When using hexadecimal notation to specify a color, use "#" or
   * "0x" before the values (e.g. #CCFFAA, 0xFFCCFFAA). The # syntax uses six
   * digits to specify a color (the way colors are specified in HTML and CSS).
   * When using the hexadecimal notation starting with "0x", the hexadecimal
   * value must be specified with eight characters; the first two characters
   * define the alpha component and the remainder the red, green, and blue
   * components.
   * <br><br>The value for the parameter "gray" must be less than or equal
   * to the current maximum value as specified by <b>colorMode()</b>.
   * The default maximum value is 255.
   *
   * @param {int|float} gray    number specifying value between white and black
   * @param {int|float} value1  red or hue value
   * @param {int|float} value2  green or saturation value
   * @param {int|float} value3  blue or brightness value
   * @param {int|float} alpha   opacity of the stroke
   * @param {Color} color       any value of the color datatype
   * @param {int} hex           color value in hexadecimal notation (i.e. #FFCC00 or 0xFFFFCC00)
   *
   * @see #fill()
   * @see #noStroke()
   * @see #tint()
   * @see #background()
   * @see #colorMode()
   */
  stroke(...channels) {
    let color = this.curSketch.color(...channels);
    if(color === this.currentStrokeColor && this.doStroke) {
      return;
    }
    this.doStroke = true;
    this.currentStrokeColor = color;
  }

  /**
   * The strokeWeight() function sets the width of the stroke used for lines, points, and the border around shapes.
   * All widths are set in units of pixels.
   *
   * @param {int|float} w the weight (in pixels) of the stroke
   */
  strokeWeight(w) {
    this.lineWidth = w;
  }

  backgroundHelper(arg1, arg2, arg3, arg4) {
    let obj = undefined;
    let p = this.curSketch;

    if (arg1 instanceof PImage || arg1.__isPImage) {
      obj = arg1;
      if (!obj.loaded) {
        throw "Error using image in background(): PImage not loaded.";
      }
      if(obj.width !== p.width || obj.height !== p.height){
        throw "Background image must be the same dimensions as the canvas.";
      }
    } else {
      obj = p.color(arg1, arg2, arg3, arg4);
    }
    this.backgroundObj = obj;
  }

  alpha(aColor) {
    return ((aColor & PConstants.ALPHA_MASK) >>> 24) / 255 * this.colorModeA;
  }

  executeContextStroke() {
    if(this.doStroke) {
      if(this.isStrokeDirty) {
        this.curContext.strokeStyle = this.curSketch.color.toString(this.currentStrokeColor);
        this.isStrokeDirty = false;
      }
      this.curContext.stroke();
    }
  }

  textFont(pfont, size) {
    if (size !== undefined) {
      // If we're using an SVG glyph font, don't load from cache
      if (!pfont.glyph) {
        pfont = PFont.get(pfont.name, size);
      }
      this.curTextSize = size;
    }

    let curTextFont = this.curTextFont = pfont;
    this.curFontName = curTextFont.name;
    this.curTextAscent = curTextFont.ascent;
    this.curTextDescent = curTextFont.descent;
    this.curTextLeading = curTextFont.leading;
    this.curContext.font = curTextFont.css;
  }
};
