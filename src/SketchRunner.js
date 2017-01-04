import noop from "./Parser/noop";

let emptyhooks = {
  preSetup: noop,
  postSetup: noop,
  preDraw: noop,
  postDraw: noop
};

export default class SketchRunner {
  constructor(data) {
  	this.sketch = data.sketch;
  	this.target = data.target;
  	this.hooks = Object.assign({}, emptyhooks, data.hooks);
  	this.cache = {};
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
	    this.sketch.draw();
	    this.__post_draw();
	    // and then we either animate or we don't, depending on sketch.noLoop
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
