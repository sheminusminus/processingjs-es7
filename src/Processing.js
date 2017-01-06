import transformMain from "./Parser/transform-main";
import processPreDirectives from "./Parser/process-pre-directives";
import parseProcessing from "./Parser/parse-processing";
import injectStrings from "./Parser/inject-strings";
import generateDefaultScope from "./DefaultScope";
import SketchRunner from "./SketchRunner";

var staticSketchList = [];

/**
 * The master library object.
 */
var Processing = {

  /**
   * load a set of files that comprise a sketch
   */
  async load(urilist) {
    let set = {};
    urilist.forEach(k => set[k] = false);

    // return promise that resolves when all files have been loaded
    return new Promise(function(resolve, error) {
      // ...
    });
  },

  /**
   * aggregrate a set of resolved files into a single file
   */
  aggregate(sources) {
  	// return promise that resolves when all filedata has been aggregated
  },

  /**
   * run the conversion from source to AST
   */
  async parse(sourceCode) {
    let cleaned = processPreDirectives(sourceCode);
    return transformMain(cleaned);
  },

  /**
   * convert an AST into sketch code
   */
  async convert(ast, additionalScopes) {
    // convert AST to processing.js source code
    let pjsSourceCode = ast.toString(additionalScopes);
    let strings = ast.getSourceStrings();
    // remove empty extra lines with space
    pjsSourceCode = pjsSourceCode.replace(/\s*\n(?:[\t ]*\n)+/g, "\n\n");
    // convert character codes to characters
    pjsSourceCode = pjsSourceCode.replace(/__x([0-9A-F]{4})/g, function(all, hexCode) {
      return String.fromCharCode(parseInt(hexCode,16));
    });
    // inject string content
    return injectStrings(pjsSourceCode, strings);
  },

  /**
   * inject a sketch into the page
   */
  injectSketch(sketchSourceCode, target, additionalScopes, hooks) {
    let id = staticSketchList.length;

    staticSketchList[id] = {
      sketch: undefined,
      target,
      hooks
    };

    let old = document.querySelector(`#processing-sketch-${id}`);
    if (old) { return; }

    let script = document.createElement("script");
    script.id = `processing-sketch-${id}`;
    script.textContent = sketchSourceCode.replace("{{ SKETCH_ID_PLACEHOLDER }}", id);
    script.async = true;

    let head = document.querySelector("head");
    return head.appendChild(script);

    // =========================================================
    //
    //   This will inject the sketch, if the page permits that,
    //   which will create an object that bootstraps by calling
    //   Processing.onSketchLoad(), found below, to sort out
    //   the object and functions bindings.
    //
    // =========================================================
  },

  /**
   * Generate a default scope for a sketch
   */
  generateDefaultScope(options) {
    // this sorts out all the object and function bindings for a sketch
    return generateDefaultScope(options);
  },

  /**
   * called when a sketch's source script has been loaded by the browser
   */
  onSketchLoad(sketch) {
    // crosslink the sketch
    let id = sketch.id;
    let data = staticSketchList[id];
    data.sketch = sketch;
    // and execute the sketch, with its own call stack.
    let runner = new SketchRunner(data);
    setTimeout(() => runner.run(), 1);
  },

  /**
   * Effect a complete sketch load
   */
  run(urilist, target, additionalScopes, hooks) {
   	if (!urilist) {
  		throw new Error("No source code supplied to build a sketch with.");
  	}

   	if (!target) {
  		throw new Error("No target element supplied for the sketch to run in.");
  	}

    Processing.load(urilist)
    .then( set => Processing.aggregate(set))
    .then( source => Processing.parse(source))
    .then( ast => Processing.convert(ast, additionalScopes))
    .then( sketchSource => Processing.injectSketch(sketchSource, target, additionalScopes, hooks))
    .catch( error => {
      if (hooks && hooks.onerror) {
        hooks.onerror(error);
      } else {
        throw error;
      }
    });
  }
};

export default Processing;
