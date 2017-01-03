import JavaBaseClass from "./JavaBaseClass";

var noop = () => {};

var emptyhooks = {
  presetup: noop,
  postsetup: noop,
  predraw: noop,
  postdraw: noop,
}

/**
 * The actual sketch classs
 */
export default class Sketch extends JavaBaseClass {
  // This sets up our object and then asks Processing
  // to set up all the necessary API bindings.
  constructor(id, Processing) {
    super();
    this.id = id;
    this.hooks = emptyhooks;
    this.context = new Context();
    setTimeout(()=>Processing.onSketchLoad(this), 1);
  }

  // The pre-setup call allows the sketch to be handed
  // a set of event handlers that hook into the sketch
  // execution at various points in its lifecycle.
  __pre_setup(hooks) {
  	this.hooks = Object.assign({}, emptyhooks, hooks);
  	this.hooks.presetup();
  }

  // hook opportunity
  __post_setup() {
    this.hooks.postsetup();
  }

  // before we start drawing, some draw context needs
  // to be cached, as some context changes reset after
  // a frame has been drawn and draw() returns.
  __pre_draw() {
    this.hooks.predraw(this.context)
  	this.cache.context = this.context;
  }

  // hook opportunity
  __post_draw() {
    this.context = this.cache.context;
  	this.hooks.postdraw(this.context);
  }
}
