'use strict';

/**
 * Parser to turn string data into an AST
 */
var Parser = {
  // promise(source -> AST)
  parse(source) {
    // this can run in a service worker
    return new Promise();
  }
};

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

/**
 * The master library class.
 */
var Processing = {
  // load a set of files that comprise a sketch
  load(urilist) {
    // return promise that resolves when all files have been loaded
    return new Promise(function(resolve, error) {

    });
  },

  // aggregrate a set of resolved files into a single file
  aggregate(sources) {
  	// return promise that resolves when all filedata has been aggregated
  },
  
  // parse an (aggregated) source as AST
  parse(source) {
  	// this should be able to run in a service worker rather than the main thread
  	return Parser.parse(source);
  },

  // convert an AST into a sketch object
  convert(ast) {
  	// this should be able to run in a service worker rather than the main thread
  	return Converter.convert(ast);
  },

  // start running a sketch
  execute(sketch, target, hooks) {
    sketch.__pre__setup(hooks);
    sketch.setup();
    sketch.__post__setup();

    sketch.__pre_draw();
    sketch.draw();
    sketch.__post_draw();
  },

  // Effecet a complete sketch load
  run(urilist, target, hooks) {
   	if (!urilist) {
  		throw new Error("No source code supplied to build a sketch with.");
  	}

   	if (!target) {
  		throw new Error("No target element supplied for the sketch to run in.");
  	}

    Processing.load(urilist)
    .then( set => {
      return Processing.aggregate(set);
    })
    .then( source => {
      return Processing.parse(source);
    })
    .then( ast => {
      return Processing.convert(ast);
    })
    .then (sketch => {
      return Processing.execute(sketch, target, hooks);
    })
    .catch( error => {
      if (hooks.onerror) {
        hooks.onerror(error);
      } else {
        throw error;
      }
    });
  }
};

module.exports = Processing;
