import noop from "./noop";
import createImageCache from "./create-image-cache";

/**
 * This is the object that acts as our version of PApplet.
 * This can be called as Processing.Sketch() or as
 * Processing.Sketch(function) in which case the function
 * must be an already-compiled-to-JS sketch function.
 */
export default class Sketch {
  constructor (attachFunction) {
    this.attachFunction = attachFunction;
    this.options = {
      pauseOnBlur: false,
      globalKeyEvents: false
    };
    this.params = {};
    this.imageCache = createImageCache();
    this.sourceCode = undefined;
    /* Optional Sketch event hooks:
     *   onLoad       - parsing/preloading is done, before sketch starts
     *   onSetup      - setup() has been called, before first draw()
     *   onPause      - noLoop() has been called, pausing draw loop
     *   onLoop       - loop() has been called, resuming draw loop
     *   onFrameStart - draw() loop about to begin
     *   onFrameEnd   - draw() loop finished
     *   onExit       - exit() done being called
     */
    this.onLoad = noop;
    this.onSetup = noop;
    this.onPause = noop;
    this.onLoop = noop;
    this.onFrameStart = noop;
    this.onFrameEnd = noop;
    this.onExit = noop;
  }

  /**
   * Have the sketch attach itself to Processing
   */
  attach(processing) {
    // either attachFunction or sourceCode must be present on attach
    if(typeof this.attachFunction === "function") {
      this.attachFunction(processing);
    } else if(this.sourceCode) {
      var func = ((new Function("return (" + this.sourceCode + ");"))());
      func(processing);
      this.attachFunction = func;
    } else {
      throw "Unable to attach sketch to the processing instance";
    }
  }

  /**
   * Mostly for debugging purposes
   */
  toString() {
    var i;
    var code = "((function(Sketch) {\n";
    code += "var sketch = new Sketch(\n" + this.sourceCode + ");\n";
    for(i in this.options) {
      if(this.options.hasOwnProperty(i)) {
        var value = this.options[i];
        code += "sketch.options." + i + " = " +
          (typeof value === 'string' ? '\"' + value + '\"' : "" + value) + ";\n";
      }
    }
    for(i in this.imageCache) {
      if(this.options.hasOwnProperty(i)) {
        code += "sketch.imageCache.add(\"" + i + "\");\n";
      }
    }
    // TODO serialize fonts
    code += "return sketch;\n})(Processing.Sketch))";
    return code;
  }
};
