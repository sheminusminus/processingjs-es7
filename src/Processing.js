import Parser from "./Parser";
import Sketch from "./Sketch";

import transformMain from "../src-temp/transform-main";
import processPredirectives from "../src-temp/process-predirectives";
import parseProcessing from "../src-temp/parse-processing";
import injectStrings from "../src-temp/inject-strings";

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
    return transformMain(sourceCode);
  },

  /**
   * convert an AST into sketch code
   */
  async convert(ast) {
    // convert AST to processing.js source code
    let pjsSourceCode = ast.toString();
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
  injectSketch(sketchSourceCode, document) {
    if (typeof document === "undefined") {
      throw new Error("The `document` namespace could not be found for injecting a sketch");
    }

    let id = staticSketchList.length;
    let old = document.querySelector(`#processing-sketch-${id}`);
    if (old) {
      return;
    }
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
   *
   */
  onSketchLoad(sketch) {
    let id = sketch.id;
    staticSketchList[id] = sketch;
    console.log("received Sketch");
    console.log(sketch);

    // ... code goes here ...
  },

  /**
   * start running a sketch
   */
  execute(sketch, target, hooks) {
    sketch.__pre__setup(hooks);
    sketch.setup();
    sketch.__post__setup();

    sketch.__pre_draw();
    sketch.draw();
    sketch.__post_draw();
  },

  /**
   * Effect a complete sketch load
   */
  run(urilist, target, hooks) {
   	if (!urilist) {
  		throw new Error("No source code supplied to build a sketch with.");
  	}

   	if (!target) {
  		throw new Error("No target element supplied for the sketch to run in.");
  	}

    Processing.load(urilist)
    .then( set => Processing.aggregate(set))
    .then( source => Processing.parse(source))
    .then( ast => Processing.convert(ast))
    .then( sketchSource => Processing.injectSketch(sketchSource))
    .catch( error => {
      if (hooks.onerror) {
        hooks.onerror(error);
      } else {
        throw error;
      }
    });
  }
};

Processing.Sketch = Sketch;

export default Processing;
