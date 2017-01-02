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
  constructor(id, $p) {
    super();
    this.id = id;
    setTimeout( () => {
      $p.onSketchLoad(this);
    }, 1);
  }

  __pre_setup(hooks) {
  	this.hooks = Object.assign({}, emptyhooks, hooks);
  	this.hooks.presetup();
  }

  __post_setup() {
    this.hooks.postsetup();
  }

  __pre_draw() {
    this.hooks.predraw(this.context)
  	this.cache.context = this.context;
  }

  __post_draw() {
  	this.hooks.postdraw(this.context);
  }
}
