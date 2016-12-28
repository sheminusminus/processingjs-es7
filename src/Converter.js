import Sketch from "./Sketch"

/**
 * Converter that turns ASTs into a Sketch object
 */
var Converter = {
  // promise(AST -> Sketch object)
  convert(ast) {
    // this can run in a service worker
    return new Promise();
  }
};

export default Converter;
