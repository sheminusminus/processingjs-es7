import noop from "./Parser/noop";
import colorBindings from "./bindings/colorBindings";
import playBindings from "./bindings/playBindings";

let emptyhooks = {
  preSetup: noop,
  postSetup: noop,
  preDraw: noop,
  postDraw: noop,

  onFrameStart: noop,
  onFrameEnd: noop,
  onLoop: noop,
  onPause: noop
};

export default class SketchRunner {
  constructor(data) {
  	this.sketch = data.sketch;
  	this.target = data.target;
  	this.hooks = Object.assign({}, emptyhooks, data.hooks);
  	this.cache = {};

    // FIXME: TODO: this provisions a canvas for testing purposes. REMOVE LATER
    if (!this.target) {
      let canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      this.target = canvas;
    }

    // set up Processing API function bindings
    colorBindings(this.sketch, this.hooks);
    this.startLooping = playBindings(this.sketch, this.hooks);

    // set up a JIT-binding call so that when the sketch calls
    // size(), the correct context gets bound to the instance.
    this.sketch.$perform_initial_binding(this.target);
  }

  /**
   * start running a sketch
   */
  run() {
  	// setup
  	if (this.sketch.setup) {
      this.__pre_setup();
      this.sketch.setup();
      this.__post_setup();
    }
    // draw
    if (this.sketch.draw) {
	    this.__pre_draw();
      this.hooks.onFrameStart();
	    this.sketch.draw();
      this.hooks.onFrameEnd();
	    this.__post_draw();
	    // and then we either animate or we don't, depending on whether
      // the user called sketch.noLoop() before we reach this point.
      this.startLooping();
	  }
  }

  //  hook opportunity
  __pre_setup() {
  	this.hooks.preSetup();
  }

  // hook opportunity
  __post_setup() {
    this.hooks.postSetup();
  }

  // before we start drawing, some draw context needs
  // to be cached, as some context changes reset after
  // a frame has been drawn and draw() returns.
  __pre_draw() {
    this.hooks.preDraw(this.context)
  	this.cache.context = this.context;
  }

  // hook opportunity
  __post_draw() {
  	this.hooks.postDraw(this.context);
    this.context = this.cache.context;
  }
}
