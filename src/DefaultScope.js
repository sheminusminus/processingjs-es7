import Drawing2D from "./drawing/2d/Drawing2D";

import PConstants from "./PConstants";
import BaseValues from "./BaseValues";
import ArrayList from "./Processing Objects/ArrayList"
import Char from "./Processing Objects/Char"
import HashMap from "./Processing Objects/HashMap/HashMap"
import PFont from "./Processing Objects/PFont/PFont"
import ProcessingMath from "./Processing Objects/Math/ProcessingMath";
import JavaProxies from "./JavaProxies"



// import PMatrix2D from "./Processing Objects/PMatrix2D"
// import PMatrix3D from "./Processing Objects/PMatrix3D"
// import PShape from "./Processing Objects/PShape"
// import PShapeSVG from "./Processing Objects/PShapeSVG"
// import PVector from "./Processing Objects/PVector"
// import webcolors from "./Processing Objects/webcolors"
// import XMLAttribute from "./Processing Objects/XMLAttribute"
// import XMLElement from "./Processing Objects/XMLElement"

/**
 * This function effectively generates "a sketch" without any
 * user defined code loaded into it yet, hence acting as
 * the default global sketch scope until we inject the user's
 * own functions and classes into it.
 *
 * This code works together with the AST code to "fake" several
 * ways in which Java does things differently from JavaScript.
 */
export default function generateDefaultScope(additionalScopes) {

  // FIXME: TODO: determine the use3d value

  /**
   * The "default scope" is effectively the Processing API, which is then
   * extended with a user's own sketch code. However, because we're going
   * to dynamically update its Prototype, we define it inline, so that updates
   * to the DefaultScope prototype only affects individual sketches, not all
   * sketches built off of the same prototype.
   */
  let DefaultScope = function DefaultScope() {};

  DefaultScope.prototype = Object.assign(
    {},

    // Processing constants and independent functions:
    PConstants,
    BaseValues,
    Math,
    ProcessingMath,

    // Java constants and independent functions:
    JavaProxies,

    // Processing objects:
    {
      ArrayList,
      Char,
      Character: Char,
      HashMap,
      PFont
    }
  );

  // bootstrap a default scope instance
  let defaultScope = new DefaultScope();

  // and tack on any additional scopes that might be necessary
  // based on the user's needs. This allows for things like
  // imports, which don't work, being made to work anyway by
  // adding similar API'd objects as additional scope.
  if (additionalScopes) {
    Object.keys(additionalScopes).forEach(prop => {
      defaultScope[prop] = scopes[prop]
    });
  }

  // FIXME: TODO: testing size() calls
  defaultScope.__setup_drawing_context = function(canvas, context) {
    let dContext = new Drawing2D(defaultScope, canvas, context);
    defaultScope.context = dContext;
  }


// =================================================================================
//
//    BELOW THIS POINT IS STILL ALL THE OLD CODE FROM THE ORIGINAL PROCESSING-JS
//
// =================================================================================


  ////////////////////////////////////////////////////////////////////////////
  // Class inheritance helper methods
  ////////////////////////////////////////////////////////////////////////////

  defaultScope.defineProperty = function(obj, name, desc) {
    if("defineProperty" in Object) {
      Object.defineProperty(obj, name, desc);
    } else {
      if (desc.hasOwnProperty("get")) {
        obj.__defineGetter__(name, desc.get);
      }
      if (desc.hasOwnProperty("set")) {
        obj.__defineSetter__(name, desc.set);
      }
    }
  };

  /**
   * class overloading, part 1
   */
  function overloadBaseClassFunction(object, name, basefn) {
    if (!object.hasOwnProperty(name) || typeof object[name] !== 'function') {
      // object method is not a function or just inherited from Object.prototype
      object[name] = basefn;
      return;
    }
    var fn = object[name];
    if ("$overloads" in fn) {
      // the object method already overloaded (see defaultScope.addMethod)
      // let's just change a fallback method
      fn.$defaultOverload = basefn;
      return;
    }
    if (!("$overloads" in basefn) && fn.length === basefn.length) {
      // special case when we just overriding the method
      return;
    }
    var overloads, defaultOverload;
    if ("$overloads" in basefn) {
      // let's inherit base class overloads to speed up things
      overloads = basefn.$overloads.slice(0);
      overloads[fn.length] = fn;
      defaultOverload = basefn.$defaultOverload;
    } else {
      overloads = [];
      overloads[basefn.length] = basefn;
      overloads[fn.length] = fn;
      defaultOverload = fn;
    }
    var hubfn = function() {
      var fn = hubfn.$overloads[arguments.length] ||
               ("$methodArgsIndex" in hubfn && arguments.length > hubfn.$methodArgsIndex ?
               hubfn.$overloads[hubfn.$methodArgsIndex] : null) ||
               hubfn.$defaultOverload;
      return fn.apply(this, arguments);
    };
    hubfn.$overloads = overloads;
    if ("$methodArgsIndex" in basefn) {
      hubfn.$methodArgsIndex = basefn.$methodArgsIndex;
    }
    hubfn.$defaultOverload = defaultOverload;
    hubfn.name = name;
    object[name] = hubfn;
  }

  /**
   * class overloading, part 2
   */
  function extendClass(subClass, baseClass) {
    function extendGetterSetter(propertyName) {
      defaultScope.defineProperty(subClass, propertyName, {
        get: function() {
          return baseClass[propertyName];
        },
        set: function(v) {
          baseClass[propertyName]=v;
        },
        enumerable: true
      });
    }

    var properties = [];
    for (var propertyName in baseClass) {
      if (typeof baseClass[propertyName] === 'function') {
        overloadBaseClassFunction(subClass, propertyName, baseClass[propertyName]);
      } else if(propertyName.charAt(0) !== "$" && !(propertyName in subClass)) {
        // Delaying the properties extension due to the IE9 bug (see #918).
        properties.push(propertyName);
      }
    }
    while (properties.length > 0) {
      extendGetterSetter(properties.shift());
    }

    subClass.$super = baseClass;
  }

  /**
   * class overloading, part 3
   */
  defaultScope.extendClassChain = function(base) {
    var path = [base];
    for (var self = base.$upcast; self; self = self.$upcast) {
      extendClass(self, base);
      path.push(self);
      base = self;
    }
    while (path.length > 0) {
      path.pop().$self=base;
    }
  };

  // static
  defaultScope.extendStaticMembers = function(derived, base) {
    extendClass(derived, base);
  };

  // interface
  defaultScope.extendInterfaceMembers = function(derived, base) {
    extendClass(derived, base);
  };

  /**
   * Java methods and JavaScript functions differ enough that
   * we need a special function to make sure it all links up
   * as classical hierarchical class chains.
   */
  defaultScope.addMethod = function(object, name, fn, hasMethodArgs) {
    var existingfn = object[name];
    if (existingfn || hasMethodArgs) {
      var args = fn.length;
      // builds the overload methods table
      if ("$overloads" in existingfn) {
        existingfn.$overloads[args] = fn;
      } else {
        var hubfn = function() {
          var fn = hubfn.$overloads[arguments.length] ||
                   ("$methodArgsIndex" in hubfn && arguments.length > hubfn.$methodArgsIndex ?
                   hubfn.$overloads[hubfn.$methodArgsIndex] : null) ||
                   hubfn.$defaultOverload;
          return fn.apply(this, arguments);
        };
        var overloads = [];
        if (existingfn) {
          overloads[existingfn.length] = existingfn;
        }
        overloads[args] = fn;
        hubfn.$overloads = overloads;
        hubfn.$defaultOverload = existingfn || fn;
        if (hasMethodArgs) {
          hubfn.$methodArgsIndex = args;
        }
        hubfn.name = name;
        object[name] = hubfn;
      }
    } else {
      object[name] = fn;
    }
  };

  // internal helper function
  function isNumericalJavaType(type) {
    if (typeof type !== "string") {
      return false;
    }
    return ["byte", "int", "char", "color", "float", "long", "double"].indexOf(type) !== -1;
  }

  /**
   * Java's arrays are pre-filled when declared with
   * an initial size, but no content. JS arrays are not.
   */
  defaultScope.createJavaArray = function(type, bounds) {
    var result = null,
        defaultValue = null;
    if (typeof type === "string") {
      if (type === "boolean") {
        defaultValue = false;
      } else if (isNumericalJavaType(type)) {
        defaultValue = 0;
      }
    }
    if (typeof bounds[0] === 'number') {
      var itemsCount = 0 | bounds[0];
      if (bounds.length <= 1) {
        result = [];
        result.length = itemsCount;
        for (var i = 0; i < itemsCount; ++i) {
          result[i] = defaultValue;
        }
      } else {
        result = [];
        var newBounds = bounds.slice(1);
        for (var j = 0; j < itemsCount; ++j) {
          result.push(defaultScope.createJavaArray(type, newBounds));
        }
      }
    }
    return result;
  };

  // screenWidth and screenHeight are shared by all instances.
  // and return the width/height of the browser's viewport.
  defaultScope.defineProperty(defaultScope, 'screenWidth',
    { get: function() { return window.innerWidth; } });

  defaultScope.defineProperty(defaultScope, 'screenHeight',
    { get: function() { return window.innerHeight; } });

  return defaultScope;
};
