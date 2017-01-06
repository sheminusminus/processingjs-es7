import noop from "./Parser/noop";

const BaseValues = {
  name : 'Processing.js Instance', // Set Processing defaults / environment variables
  use3DContext : false, // default '2d' canvas context

  /**
   * Confirms if a Processing program is "focused", meaning that it is
   * active and will accept input from mouse or keyboard. This variable
   * is "true" if it is focused and "false" if not. This variable is
   * often used when you want to warn people they need to click on the
   * browser before it will work.
  */
  focused : false,
  breakShape : false,

  // Glyph path storage for textFonts
  glyphTable : {},

  // Global vars for tracking mouse position
  pmouseX : 0,
  pmouseY : 0,
  mouseX : 0,
  mouseY : 0,
  mouseButton : 0,
  mouseScroll : 0,

  // Undefined event handlers to be replaced by user when needed
  mouseClicked : undefined,
  mouseDragged : undefined,
  mouseMoved : undefined,
  mousePressed : undefined,
  mouseReleased : undefined,
  mouseScrolled : undefined,
  mouseOver : undefined,
  mouseOut : undefined,
  touchStart : undefined,
  touchEnd : undefined,
  touchMove : undefined,
  touchCancel : undefined,
  key : undefined,
  keyCode : undefined,
  keyPressed : noop, // needed to remove function checks
  keyReleased : noop,
  keyTyped : noop,
  draw : undefined,
  setup : undefined,

  // Remapped vars
  __mousePressed : false,
  __keyPressed : false,
  __frameRate : 60,

  // The current animation frame
  frameCount : 0,

  // The height/width of the canvas
  width : 100,
  height : 100
};

export default BaseValues;
