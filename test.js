function noop() {}

function createImageCache() {
  let isWindowPresent = (typeof window !== "undefined");
  let isDOMPresent = isWindowPresent && (typeof document !== "undefined");

  return {
    pending: 0,
    images: {},
    // Opera requires special administration for preloading
    operaCache: {},
    // Specify an optional img arg if the image is already loaded in the DOM,
    // otherwise href will get loaded.
    add: function(href, img) {
      // Prevent muliple loads for an image, in case it gets
      // preloaded more than once, or is added via JS and then preloaded.
      if (this.images[href]) {
        return;
      }

      if (!isDOMPresent) {
        this.images[href] = null;
      }

      // No image in the DOM, kick-off a background load
      if (!img) {
        img = new Image();
        img.onload = (function(owner) {
          return function() {
            owner.pending--;
          };
        }(this));
        this.pending++;
        img.src = href;
      }

      this.images[href] = img;

      // Opera will not load images until they are inserted into the DOM.
      if (isWindowPresent && window.opera) {
        var div = document.createElement("div");
        div.appendChild(img);
        // we can't use "display: none", since that makes it invisible, and thus not load
        div.style.position = "absolute";
        div.style.opacity = 0;
        div.style.width = "1px";
        div.style.height= "1px";
        if (!this.operaCache[href]) {
          document.body.appendChild(div);
          this.operaCache[href] = div;
        }
      }
    }
  };
}

/**
 * This is the object that acts as our version of PApplet.
 * This can be called as Processing.Sketch() or as
 * Processing.Sketch(function) in which case the function
 * must be an already-compiled-to-JS sketch function.
 */
class Sketch {
  constructor (attachFunction) {
    this.attachFunction = attachFunction;
    this.options = {
      pauseOnBlur: false,
      globalKeyEvents: false
    };
    this.params = {};
    this.imageCache = createImageCache();
    this.sourceCode = undefined;
    /* Optional Sketch event hooks:
     *   onLoad       - parsing/preloading is done, before sketch starts
     *   onSetup      - setup() has been called, before first draw()
     *   onPause      - noLoop() has been called, pausing draw loop
     *   onLoop       - loop() has been called, resuming draw loop
     *   onFrameStart - draw() loop about to begin
     *   onFrameEnd   - draw() loop finished
     *   onExit       - exit() done being called
     */
    this.onLoad = noop;
    this.onSetup = noop;
    this.onPause = noop;
    this.onLoop = noop;
    this.onFrameStart = noop;
    this.onFrameEnd = noop;
    this.onExit = noop;
  }

  /**
   * Have the sketch attach itself to Processing
   */
  attach(processing) {
    // either attachFunction or sourceCode must be present on attach
    if(typeof this.attachFunction === "function") {
      this.attachFunction(processing);
    } else if(this.sourceCode) {
      var func = ((new Function("return (" + this.sourceCode + ");"))());
      func(processing);
      this.attachFunction = func;
    } else {
      throw "Unable to attach sketch to the processing instance";
    }
  }

  /**
   * Mostly for debugging purposes
   */
  toString() {
    var i;
    var code = "((function(Sketch) {\n";
    code += "var sketch = new Sketch(\n" + this.sourceCode + ");\n";
    for(i in this.options) {
      if(this.options.hasOwnProperty(i)) {
        var value = this.options[i];
        code += "sketch.options." + i + " = " +
          (typeof value === 'string' ? '\"' + value + '\"' : "" + value) + ";\n";
      }
    }
    for(i in this.imageCache) {
      if(this.options.hasOwnProperty(i)) {
        code += "sketch.imageCache.add(\"" + i + "\");\n";
      }
    }
    // TODO serialize fonts
    code += "return sketch;\n})(Processing.Sketch))";
    return code;
  }
}

// L/RTrim, also removing any surrounding double quotes (e.g., just take string contents).
function clean(s) {
  return s.replace(/^\s*["']?/, '').replace(/["']?\s*$/, '');
}

/**
 * collect all @PJS pre-directives
 */
function processPreDirectives(aCode, sketch) {
  // Parse out @pjs directive, if any.
  let dm = new RegExp(/\/\*\s*@pjs\s+((?:[^\*]|\*+[^\*\/])*)\*\//g).exec(aCode);

  if (dm && dm.length === 2) {
    // masks contents of a JSON to be replaced later
    // to protect the contents from further parsing
    let jsonItems = [],
        directives = dm.splice(1, 2)[0].replace(/\{([\s\S]*?)\}/g, (function() {
          return function(all, item) {
            jsonItems.push(item);
            return "{" + (jsonItems.length-1) + "}";
          };
        }())).replace('\n', '').replace('\r', '').split(";");

    for (let i = 0, dl = directives.length; i < dl; i++) {
      let pair = directives[i].split('=');
      if (pair && pair.length === 2) {
        let key = clean(pair[0]),
            value = clean(pair[1]),
            list = [];
        // A few directives require work beyond storying key/value pairings
        if (key === "preload") {
          list = value.split(',');
          // All pre-loaded images will get put in imageCache, keyed on filename
          for (let j = 0, jl = list.length; j < jl; j++) {
            let imageName = clean(list[j]);
            sketch.imageCache.add(imageName);
          }
        // fonts can be declared as a string containing a url,
        // or a JSON object, containing a font name, and a url
        } else if (key === "font") {
          list = value.split(",");
          for (let x = 0, xl = list.length; x < xl; x++) {
            let fontName = clean(list[x]),
                index = /^\{(\d*?)\}$/.exec(fontName);
            // if index is not null, send JSON, otherwise, send string
            PFont.preloading.add(index ? JSON.parse("{" + jsonItems[index[1]] + "}") : fontName);
          }
        } else if (key === "pauseOnBlur") {
          sketch.options.pauseOnBlur = value === "true";
        } else if (key === "globalKeyEvents") {
          sketch.options.globalKeyEvents = value === "true";
        } else if (key.substring(0, 6) === "param-") {
          sketch.params[key.substring(6)] = value;
        } else {
          sketch.options[key] = value;
        }
      }
    }
  }

  return aCode;
}

// removes generics
function removeGenerics(codeWoStrings) {
	let genericsWereRemoved;
	let codeWoGenerics = codeWoStrings;

	let replaceFunc = function(all, before, types, after) {
	  if(!!before || !!after) {
	    return all;
	  }
	  genericsWereRemoved = true;
	  return "";
	};

  let regExp = /([<]?)<\s*((?:\?|[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)(?:\[\])*(?:\s+(?:extends|super)\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)?(?:\s*,\s*(?:\?|[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)(?:\[\])*(?:\s+(?:extends|super)\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)?)*)\s*>([=]?)/g;

	do {
	  genericsWereRemoved = false;
	  codeWoGenerics = codeWoGenerics.replace(regExp, replaceFunc);
	} while (genericsWereRemoved);

	return codeWoGenerics
}

// masks parentheses, brackets and braces with '"A5"'
// where A is the bracket type, and 5 is the index in an array containing all brackets split into atoms
// 'while(true){}' -> 'while"B1""A2"'
//
//  The mapping used is:
//
//    braces{} = A
//    parentheses() = B
//    brackets[] = C
//
function splitToAtoms(code) {
  var atoms = [];
  var items = code.split(/([\{\[\(\)\]\}])/);
  var result = items[0];

  var stack = [];
  for(var i=1; i < items.length; i += 2) {
    var item = items[i];
    if(item === '[' || item === '{' || item === '(') {
      stack.push(result); result = item;
    } else if(item === ']' || item === '}' || item === ')') {
      var kind = item === '}' ? 'A' : item === ')' ? 'B' : 'C';
      var index = atoms.length; atoms.push(result + item);
      result = stack.pop() + '"' + kind + (index + 1) + '"';
    }
    result += items[i + 1];
  }
  atoms.unshift(result);
  return atoms;
}

// trims off leading and trailing spaces
// returns an object. object.left, object.middle, object.right, object.untrim
function trimSpaces$1(string) {
  var m1 = /^\s*/.exec(string), result;
  if(m1[0].length === string.length) {
    result = {left: m1[0], middle: "", right: ""};
  } else {
    var m2 = /\s*$/.exec(string);
    result = {left: m1[0], middle: string.substring(m1[0].length, m2.index), right: m2[0]};
  }
  result.untrim = function(t) { return this.left + t + this.right; };
  return result;
}

// simple trim of leading and trailing spaces
function trim(string) {
  // FIXME: TODO: same as string.trim() ?
  return string.replace(/^\s+/,'').replace(/\s+$/,'');
}

function preExpressionTransform(transformer, expr) {
  let s = expr;
  let atoms = transformer.atoms;

  // new type[] {...} --> {...}
  let newTypeRegExp = /\bnew\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)(?:\s*"C\d+")+\s*("A\d+")/g;
  s = s.replace(newTypeRegExp, (all, type, init) => init);

  // new Runnable() {...} --> "F???"
  let newRunnableRegExp = /\bnew\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)(?:\s*"B\d+")\s*("A\d+")/g;
  s = s.replace(newRunnableRegExp, (all, type, init) => transformer.addAtom(all, 'F'));

  // function(...) { } --> "H???"
  s = s.replace(transformer.functionsRegex, all => transformer.addAtom(all, 'H'));

  // new type[?] --> createJavaArray('type', [?])
  let javaArrayRegExp = /\bnew\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)\s*("C\d+"(?:\s*"C\d+")*)/g;
  s = s.replace(javaArrayRegExp, (all, type, index) => {
    let args = index
      .replace(/"C(\d+)"/g, (all, j) => atoms[j] )
      .replace(/\[\s*\]/g, "[null]")
      .replace(/\s*\]\s*\[\s*/g, ", ");
    let arrayInitializer = "{" + args.substring(1, args.length - 1) + "}";
    let createArrayArgs = "('" + type + "', " + transformer.addAtom(arrayInitializer, 'A') + ")";
    return '$p.createJavaArray' + transformer.addAtom(createArrayArgs, 'B');
  });

  // .length() --> .length
  let lengthRegExp = /(\.\s*length)\s*"B\d+"/g;
  s = s.replace(lengthRegExp, "$1");

  // #000000 --> 0x000000
  let hexRegExp = /#([0-9A-Fa-f]{6})\b/g;
  s = s.replace(hexRegExp, (all, digits) => "0xFF" + digits );

  // delete (type)???, except (int)???
  let typeDeletionRegExp = /"B(\d+)"(\s*(?:[\w$']|"B))/g;
  s = s.replace(typeDeletionRegExp, (all, index, next) => {
    let atom = atoms[index];

    // FIXME: TODO: figure out this regexp and name it appropriately
    let unknownRegExp = /^\(\s*[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*\s*(?:"C\d+"\s*)*\)$/;
    if(!unknownRegExp.test(atom)) {
      return all;
    }

    let intTypeRegExp = /^\(\s*int\s*\)$/;
    if(intTypeRegExp.test(atom)) {
      return "(int)" + next;
    }

    let indexParts = atom.split(/"C(\d+)"/g);
    if(indexParts.length > 1) {
      // even items contains atom numbers, can check only first
      if(! /^\[\s*\]$/.test(atoms[indexParts[1]])) {
        return all; // fallback - not a cast
      }
    }
    return "" + next;
  });

  // (int)??? -> __int_cast(???)
  let intCastRegExp = /\(int\)([^,\]\)\}\?\:\*\+\-\/\^\|\%\&\~<\>\=]+)/g;
  s = s.replace(intCastRegExp, (all, arg) => {
    let trimmed = trimSpaces(arg);
    return trimmed.untrim("__int_cast(" + trimmed.middle + ")");
  });

  // super() -> $superCstr(), super. -> $super.;
  let superConstructorRegExp = /\bsuper(\s*"B\d+")/g;
  let superRegExp = /\bsuper(\s*\.)/g;
  s = s.replace(superConstructorRegExp, "$$superCstr$1").replace(superRegExp, "$$super$1");

  // 000.43->0.43 and 0010f->10, but not 0010
  let floatConversionRegExp = /\b0+((\d*)(?:\.[\d*])?(?:[eE][\-\+]?\d+)?[fF]?)\b/;
  s = s.replace(floatConversionRegExp, (all, numberWithout0, intPart) => {
    if( numberWithout0 === intPart) {
      return all;
    }
    return intPart === "" ? "0" + numberWithout0 : numberWithout0;
  });

  // 3.0f -> 3.0
  let floatFormatRegExp = /\b(\.?\d+\.?)[fF]\b/g;
  s = s.replace(floatFormatRegExp, "$1");

  // Weird (?) parsing errors with %
  let percRegExp = /([^\s])%([^=\s])/g;
  s = s.replace(percRegExp, "$1 % $2");

  // Since frameRate() and frameRate are different things,
  // we need to differentiate them somehow. So when we parse
  // the Processing.js source, replace frameRate so it isn't
  // confused with frameRate(), as well as keyPressed and mousePressed
  let namingConflictRegExp = /\b(frameRate|keyPressed|mousePressed)\b(?!\s*"B)/g;
  s = s.replace(namingConflictRegExp, "__$1");

  // "boolean", "byte", "int", etc. => "parseBoolean", "parseByte", "parseInt", etc.
  let primitivesRegExp = /\b(boolean|byte|char|float|int)\s*"B/g;
  s = s.replace(primitivesRegExp, (all, name) => "parse" + name.substring(0, 1).toUpperCase() + name.substring(1) + "\"B");

  // "pixels" replacements:
  //   pixels[i] = c => pixels.setPixel(i,c) | pixels[i] => pixels.getPixel(i)
  //   pixels.length => pixels.getLength()
  //   pixels = ar => pixels.set(ar) | pixels => pixels.toArray()
  let pixelsRegExp = /\bpixels\b\s*(("C(\d+)")|\.length)?(\s*=(?!=)([^,\]\)\}]+))?/g;
  s = s.replace(pixelsRegExp,
    (all, indexOrLength, index, atomIndex, equalsPart, rightSide) => {
      if(index) {
        let atom = atoms[atomIndex];
        if(equalsPart) {
          return "pixels.setPixel" + transformer.addAtom("(" +atom.substring(1, atom.length - 1) + "," + rightSide + ")", 'B');
        }
        return "pixels.getPixel" + transformer.addAtom("(" + atom.substring(1, atom.length - 1) + ")", 'B');
      }
      if(indexOrLength) {
        // length
        return "pixels.getLength" + transformer.addAtom("()", 'B');
      }
      if(equalsPart) {
        return "pixels.set" + transformer.addAtom("(" + rightSide + ")", 'B');
      }
      return "pixels.toArray" + transformer.addAtom("()", 'B');
    }
  );

  // Java method replacements for: replace, replaceAll, replaceFirst, equals, hashCode, etc.
  //   xxx.replace(yyy) -> __replace(xxx, yyy)
  //   "xx".replace(yyy) -> __replace("xx", yyy)
  let repeatJavaReplacement;

  function replacePrototypeMethods(all, subject, method, atomIndex) {
    let atom = atoms[atomIndex];
    repeatJavaReplacement = true;
    let trimmed = trimSpaces(atom.substring(1, atom.length - 1));
    return "__" + method  + (
      trimmed.middle === "" ?
        transformer.addAtom("(" + subject.replace(/\.\s*$/, "") + ")", 'B')
        :
        transformer.addAtom("(" + subject.replace(/\.\s*$/, "") + "," + trimmed.middle + ")", 'B')
    );
  }

  do {
    repeatJavaReplacement = false;
    let prototypeMethodRegExp = /((?:'\d+'|\b[A-Za-z_$][\w$]*\s*(?:"[BC]\d+")*)\s*\.\s*(?:[A-Za-z_$][\w$]*\s*(?:"[BC]\d+"\s*)*\.\s*)*)(replace|replaceAll|replaceFirst|contains|equals|equalsIgnoreCase|hashCode|toCharArray|printStackTrace|split|startsWith|endsWith|codePointAt|matches)\s*"B(\d+)"/g;
    s = s.replace(prototypeMethodRegExp, replacePrototypeMethods);
  } while (repeatJavaReplacement);

  // xxx instanceof yyy -> __instanceof(xxx, yyy)
  function replaceInstanceof(all, subject, type) {
    repeatJavaReplacement = true;
    return "__instanceof" + transformer.addAtom("(" + subject + ", " + type + ")", 'B');
  }
  do {
    repeatJavaReplacement = false;
    let instanceRegExp = /((?:'\d+'|\b[A-Za-z_$][\w$]*\s*(?:"[BC]\d+")*)\s*(?:\.\s*[A-Za-z_$][\w$]*\s*(?:"[BC]\d+"\s*)*)*)instanceof\s+([A-Za-z_$][\w$]*\s*(?:\.\s*[A-Za-z_$][\w$]*)*)/g;
    s = s.replace(instanceRegExp, replaceInstanceof);
  } while (repeatJavaReplacement);

  // this() -> $constr()
  let thisRegExp = /\bthis(\s*"B\d+")/g;
  s = s.replace(thisRegExp, "$$constr$1");

  return s;
}

function preStatementsTransform(statements) {
  let s = statements;
  // turns multiple catch blocks into one, because we have no way to properly get into them anyway.
  return s.replace(/\b(catch\s*"B\d+"\s*"A\d+")(\s*catch\s*"B\d+"\s*"A\d+")+/g, "$1");
}

// utility function for getting an atom's index.
// note that this cuts off the first 2, and last,
// character in the template string
function getAtomIndex(templ) {
  return templ.substring(2, templ.length - 1);
}

class AstCatchStatement {
  constructor(argument, misc) {
    this.argument = argument;
    this.misc = misc;
  }

  toString(replaceContext) {
    return this.misc.prefix + this.argument.toString();
  }
}

class AstClass {
  constructor(name, body) {
    this.name = name;
    this.body = body;
    body.owner = this;
  }

  toString(replaceContext) {
    return "var " + this.name + " = " + this.body.toString(replaceContext) + ";\n" +
      "$p." + this.name + " = " + this.name + ";\n";
  }
}

function sortByWeight$1(array) {
  array.sort((a,b) => b.weight - a.weight);
}

function contextMappedString(array, replaceContext, glue) {
  return array.map( e => e.toString(replaceContext)).join(glue);
}

class AstClassBody {
  constructor(name, baseClassName, interfacesNames, functions, methods, fields, cstrs, innerClasses, misc) {
    var i,l;
    this.name = name;
    this.baseClassName = baseClassName;
    this.interfacesNames = interfacesNames;
    this.functions = functions;
    this.methods = methods;
    this.fields = fields;
    this.cstrs = cstrs;
    this.innerClasses = innerClasses;
    this.misc = misc;
    for(i=0,l=fields.length; i<l; ++i) {
      fields[i].owner = this;
    }
  }

  getMembers(classFields, classMethods, classInners) {
    if(this.owner.base) {
      this.owner.base.body.getMembers(classFields, classMethods, classInners);
    }
    var i, j, l, m;
    for(i=0,l=this.fields.length;i<l;++i) {
      var fieldNames = this.fields[i].getNames();
      for(j=0,m=fieldNames.length;j<m;++j) {
        classFields[fieldNames[j]] = this.fields[i];
      }
    }
    for(i=0,l=this.methods.length;i<l;++i) {
      var method = this.methods[i];
      classMethods[method.name] = method;
    }
    for(i=0,l=this.innerClasses.length;i<l;++i) {
      var innerClass = this.innerClasses[i];
      classInners[innerClass.name] = innerClass;
    }
  }

  toString(replaceContext) {
    function getScopeLevel(p) {
      var i = 0;
      while(p) {
        ++i;
        p=p.scope;
      }
      return i;
    }

    var scopeLevel = getScopeLevel(this.owner);

    var selfId = "$this_" + scopeLevel;
    var className = this.name;
    var result = "var " + selfId + " = this;\n";
    var staticDefinitions = "";
    var metadata = "";

    var thisClassFields = {},
        thisClassMethods = {},
        thisClassInners = {};

    this.getMembers(thisClassFields, thisClassMethods, thisClassInners);

    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstClassBody.toString");
      console.trace();
    }

    replaceContext = function (subject) {
      var name = subject.name;
      if(name === "this") {
        // returns "$this_N.$self" pointer instead of "this" in cases:
        // "this()", "this.XXX()", "this", but not for "this.XXX"
        return subject.callSign || !subject.member ? selfId + ".$self" : selfId;
      }
      if(thisClassFields.hasOwnProperty(name)) {
        return thisClassFields[name].isStatic ? className + "." + name : selfId + "." + name;
      }
      if(thisClassInners.hasOwnProperty(name)) {
        return selfId + "." + name;
      }
      if(thisClassMethods.hasOwnProperty(name)) {
        return thisClassMethods[name].isStatic ? className + "." + name : selfId + ".$self." + name;
      }
      return oldContext(subject);
    };

    var resolvedBaseClassName;
    if (this.baseClassName) {
      resolvedBaseClassName = oldContext({name: this.baseClassName});
      result += "var $super = { $upcast: " + selfId + " };\n";
      result += "function $superCstr(){" + resolvedBaseClassName + ".apply($super,arguments);if(!('$self' in $super)) $p.extendClassChain($super)}\n";
      metadata += className + ".$base = " + resolvedBaseClassName + ";\n";
    } else {
      result += "function $superCstr(){$p.extendClassChain("+ selfId +")}\n";
    }

    if (this.owner.base) {
      // base class name can be present, but class is not
      staticDefinitions += "$p.extendStaticMembers(" + className + ", " + resolvedBaseClassName + ");\n";
    }

    var i, l, j, m;

    if (this.owner.interfaces) {
      // interface name can be present, but interface is not
      var resolvedInterfaces = [], resolvedInterface;
      for (i = 0, l = this.interfacesNames.length; i < l; ++i) {
        if (!this.owner.interfaces[i]) {
          continue;
        }
        resolvedInterface = oldContext({name: this.interfacesNames[i]});
        resolvedInterfaces.push(resolvedInterface);
        staticDefinitions += "$p.extendInterfaceMembers(" + className + ", " + resolvedInterface + ");\n";
      }
      metadata += className + ".$interfaces = [" + contextMappedString(resolvedInterfaces, replaceContext, ", ") + "];\n";
    }

    if (this.functions.length > 0) {
      result += contextMappedString(this.functions, replaceContext, '\n') + '\n';
    }

    sortByWeight$1(this.innerClasses);
    for (i = 0, l = this.innerClasses.length; i < l; ++i) {
      var innerClass = this.innerClasses[i];
      if (innerClass.isStatic) {
        staticDefinitions += className + "." + innerClass.name + " = " + innerClass + ";\n";
        result += selfId + "." + innerClass.name + " = " + className + "." + innerClass.name + ";\n";
      } else {
        result += selfId + "." + innerClass.name + " = " + innerClass + ";\n";
      }
    }

    for (i = 0, l = this.fields.length; i < l; ++i) {
      var field = this.fields[i];
      if (field.isStatic) {
        staticDefinitions += className + "." + contextMappedString(field.definitions, replaceContext, ";\n" + className + ".") + ";\n";
        for (j = 0, m = field.definitions.length; j < m; ++j) {
          var fieldName = field.definitions[j].name, staticName = className + "." + fieldName;
          result += "$p.defineProperty(" + selfId + ", '" + fieldName + "', {" +
            "get: function(){return " + staticName + "}, " +
            "set: function(val){" + staticName + " = val}});\n";
        }
      } else {
        result += selfId + "." + contextMappedString(field.definitions, replaceContext, ";\n" + selfId + ".") + ";\n";
      }
    }

    var methodOverloads = {};
    for (i = 0, l = this.methods.length; i < l; ++i) {
      var method = this.methods[i];
      var overload = methodOverloads[method.name];
      var methodId = method.name + "$" + method.params.params.length;
      var hasMethodArgs = !!method.params.methodArgsParam;
      if (overload) {
        ++overload;
        methodId += "_" + overload;
      } else {
        overload = 1;
      }
      method.methodId = methodId;
      methodOverloads[method.name] = overload;
      if (method.isStatic) {
        staticDefinitions += method.toString(replaceContext);
        staticDefinitions += "$p.addMethod(" + className + ", '" + method.name + "', " + methodId + ", " + hasMethodArgs + ");\n";
        result += "$p.addMethod(" + selfId + ", '" + method.name + "', " + methodId + ", " + hasMethodArgs + ");\n";
      } else {
        result += method.toString(replaceContext);
        result += "$p.addMethod(" + selfId + ", '" + method.name + "', " + methodId + ", " + hasMethodArgs + ");\n";
      }
    }
    result += trim(this.misc.tail);

    if (this.cstrs.length > 0) {
      result += contextMappedString(this.cstrs, replaceContext, '\n') + '\n';
    }

    result += "function $constr() {\n";

    var cstrsIfs = [];
    for (i = 0, l = this.cstrs.length; i < l; ++i) {
      var paramsLength = this.cstrs[i].params.params.length;
      var methodArgsPresent = !!this.cstrs[i].params.methodArgsParam;
      cstrsIfs.push("if(arguments.length " + (methodArgsPresent ? ">=" : "===") + " " + paramsLength + ") { " +
        "$constr_" + paramsLength + ".apply(" + selfId + ", arguments); }");
    }

    if(cstrsIfs.length > 0) {
      result += contextMappedString(cstrsIfs, replaceContext, " else ") + " else ";
    }

    // ??? add check if length is 0, otherwise fail
    result += "$superCstr();\n}\n";
    result += "$constr.apply(null, arguments);\n";

    return "(function() {\n" +
      "function " + className + "() {\n" + result + "}\n" +
      staticDefinitions +
      metadata +
      "return " + className + ";\n" +
      "})()";
  }
}

class AstClassField {
  constructor(definitions, fieldType, isStatic) {
    this.definitions = definitions;
    this.fieldType = fieldType;
    this.isStatic = isStatic;
  }

  getNames() {
    var names = [];
    for(var i=0,l=this.definitions.length;i<l;++i) {
      names.push(this.definitions[i].name);
    }
    return names;
  }

  toString(replaceContext) {
    var thisPrefix = replaceContext({ name: "[this]" });
    if(this.isStatic) {
      var className = this.owner.name;
      var staticDeclarations = [];
      for(var i=0,l=this.definitions.length;i<l;++i) {
        var definition = this.definitions[i];
        var name = definition.name;
        var staticName = className + "." + name;
        var declaration = "if(" + staticName + " === void(0)) {\n" +
          " " + staticName + " = " + definition.value + "; }\n" +
          "$p.defineProperty(" + thisPrefix + ", " +
          "'" + name + "', { get: function(){return " + staticName + ";}, " +
          "set: function(val){" + staticName + " = val;} });\n";
        staticDeclarations.push(declaration);
      }
      return contextMappedString(staticDeclarations, replaceContext, '');
    }
    return thisPrefix + "." + contextMappedString(this.definitions, replaceContext, "; " + thisPrefix + ".");
  }
}

// append a record to the lookup table
function appendToLookupTable$1(table, array) {
  for(var i=0,l=array.length;i<l;++i) {
    table[array[i]] = null;
  }
  return table;
}

class AstClassMethod {
  constructor(name, params, body, isStatic) {
    this.name = name;
    this.params = params;
    this.body = body;
    this.isStatic = isStatic;
  }

  toString(replaceContext) {
    var paramNames = appendToLookupTable$1({}, this.params.getNames());
    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstClassMethod.toString");
      console.trace();
    }

    replaceContext = function (subject) {
      return paramNames.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
    };

    var body = this.params.prependMethodArgs(this.body.toString(replaceContext));
    var result = "function " + this.methodId + this.params.toString(replaceContext) + " " + body +"\n";
    replaceContext = oldContext;
    return result;
  }
}

class AstConstructor {
  constructor(params, body) {
    this.params = params;
    this.body = body;
  }

  toString(replaceContext) {
    var paramNames = appendToLookupTable({}, this.params.getNames());

    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstConstructor.toString");
      console.trace();
    }

    replaceContext = function (subject) {
      return paramNames.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
    };

    var prefix = "function $constr_" + this.params.params.length + this.params.toString();
    var body = this.params.prependMethodArgs(this.body.toString());
    if(!/\$(superCstr|constr)\b/.test(body)) {
      body = "{\n$superCstr();\n" + body.substring(1);
    }
    replaceContext = oldContext;
    return prefix + body + "\n";
  }
}

function replaceContextInVars(expr, replaceContext) {
  let contextInVarsRegExp = /(\.\s*)?((?:\b[A-Za-z_]|\$)[\w$]*)(\s*\.\s*([A-Za-z_$][\w$]*)(\s*\()?)?/g;

  let handler = (all, memberAccessSign, identifier, suffix, subMember, callSign) => {
    if(memberAccessSign) {
      return all;
    }

    let subject = {
      name: identifier,
      member: subMember,
      callSign: !!callSign
    };

    try {
      return replaceContext(subject) + (suffix === undefined ? "" : suffix);
    } catch (e) {
      console.error(e);
      return "<<<CONTEXT REPLACEMENT FAILED>>>";
    }
  };

  return expr.replace(contextInVarsRegExp, handler);
}

class AstExpression {
  constructor(expr, transforms) {
    this.expr = expr;
    this.transforms = transforms;
  }

  toString(replaceContext) {
    var transforms = this.transforms;
    var expr = replaceContextInVars(this.expr, replaceContext);
    return expr.replace(/"!(\d+)"/g, (all, index) => transforms[index].toString(replaceContext));
  }
}

class AstForEachExpression {
  constructor(initStatement, container) {
    this.initStatement = initStatement;
    this.container = container;

  }

  toString(replaceContext) {
    var init = this.initStatement.toString();
    var iterator = "$it" + (AstForEachExpression.iteratorId++);
    var variableName = init.replace(/^\s*var\s*/, "").split("=")[0];
    var initIteratorAndVariable = "var " + iterator + " = new $p.ObjectIterator(" + this.container + "), " +
       variableName + " = void(0)";
    var nextIterationCondition = iterator + ".hasNext() && ((" +
       variableName + " = " + iterator + ".next()) || true)";
    return "(" + initIteratorAndVariable + "; " + nextIterationCondition + ";)";
  }
}

AstForEachExpression.iteratorId = 0;

class AstForExpression {
  constructor(initStatement, condition, step) {
    this.initStatement = initStatement;
    this.condition = condition;
    this.step = step;
  }

  toString(replaceContext) {
    return "(" + this.initStatement + "; " + this.condition + "; " + this.step + ")";
  }
}

class AstForInExpression {
  constructor(initStatement, container) {
    this.initStatement = initStatement;
    this.container = container;
  }

  toString(replaceContext) {
    var init = this.initStatement.toString();
    if(init.indexOf("=") >= 0) { // can be without var declaration
      init = init.substring(0, init.indexOf("="));
    }
    return "(" + init + " in " + this.container + ")";
  }
}

class AstForStatement {
  constructor(argument, misc) {
    this.argument = argument;
    this.misc = misc;
  }

  toString(replaceContext) {
    return this.misc.prefix + this.argument.toString();
  }
}

class AstFunction {
  constructor (name, params, body) {
    this.name = name;
    this.params = params;
    this.body = body;
  }

  toString(replaceContext) {
    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstFunction.toString");
      console.trace();
    }

    // saving "this." and parameters
    var names = appendToLookupTable({"this":null}, this.params.getNames());
    replaceContext = function (subject) {
      return names.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
    };
    var result = "function";
    if(this.name) {
      result += " " + this.name;
    }
    var body = this.params.prependMethodArgs(this.body.toString());
    result += this.params + " " + body;
    replaceContext = oldContext;
    return result;
  }
}

class AstInlineClass {
  constructor (baseInterfaceName, body) {
    this.baseInterfaceName = baseInterfaceName;
    this.body = body;
    body.owner = this;
  }

  toString(replaceContext) {
    return "new (" + this.body + ")";
  }
}

class AstInlineObject {
  constructor(members) {
    this.members = members;
  }

  toString(replaceContext) {
    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstInlineObject.toString");
      console.trace();
    }

    replaceContext = function (subject) {
        return subject.name === "this" ? "this" : oldContext(subject); // saving "this."
    };

    var result = "";
    for(var i=0,l=this.members.length;i<l;++i) {
      if(this.members[i].label) {
        result += this.members[i].label + ": ";
      }
      result += this.members[i].value.toString() + ", ";
    }
    replaceContext = oldContext;
    return result.substring(0, result.length - 2);
  }
}

class AstInnerClass {
  constructor(name, body, isStatic) {
    this.name = name;
    this.body = body;
    this.isStatic = isStatic;
    body.owner = this;
  }

  toString(replaceContext) {
    return "" + this.body;
  }
}

class AstInnerInterface {
  constructor (name, body, isStatic) {
    this.name = name;
    this.body = body;
    this.isStatic = isStatic;
    body.owner = this;
  }

  toString(replaceContext) {
    return "" + this.body;
  }
}

class AstInterface {
  constructor(name, body) {
    this.name = name;
    this.body = body;
    body.owner = this;
  }

  toString(replaceContext) {
    return "var " + this.name + " = " + this.body + ";\n" +
      "$p." + this.name + " = " + this.name + ";\n";
  }
}

class AstInterfaceBody {
  constructor(name, interfacesNames, methodsNames, fields, innerClasses, misc) {
    var i,l;
    this.name = name;
    this.interfacesNames = interfacesNames;
    this.methodsNames = methodsNames;
    this.fields = fields;
    this.innerClasses = innerClasses;
    this.misc = misc;
    for(i=0,l=fields.length; i<l; ++i) {
      fields[i].owner = this;
    }
  }

  getMembers(classFields, classMethods, classInners) {
    if(this.owner.base) {
      this.owner.base.body.getMembers(classFields, classMethods, classInners);
    }
    var i, j, l, m;
    for(i=0,l=this.fields.length;i<l;++i) {
      var fieldNames = this.fields[i].getNames();
      for(j=0,m=fieldNames.length;j<m;++j) {
        classFields[fieldNames[j]] = this.fields[i];
      }
    }
    for(i=0,l=this.methodsNames.length;i<l;++i) {
      var methodName = this.methodsNames[i];
      classMethods[methodName] = true;
    }
    for(i=0,l=this.innerClasses.length;i<l;++i) {
      var innerClass = this.innerClasses[i];
      classInners[innerClass.name] = innerClass;
    }
  }

  toString(replaceContext) {
    function getScopeLevel(p) {
      var i = 0;
      while(p) {
        ++i;
        p=p.scope;
      }
      return i;
    }

    var scopeLevel = getScopeLevel(this.owner);

    var className = this.name;
    var staticDefinitions = "";
    var metadata = "";

    var thisClassFields = {}, thisClassMethods = {}, thisClassInners = {};
    this.getMembers(thisClassFields, thisClassMethods, thisClassInners);

    var i, l, j, m;

    if (this.owner.interfaces) {
      // interface name can be present, but interface is not
      var resolvedInterfaces = [], resolvedInterface;
      for (i = 0, l = this.interfacesNames.length; i < l; ++i) {
        if (!this.owner.interfaces[i]) {
          continue;
        }
        resolvedInterface = replaceContext({name: this.interfacesNames[i]});
        resolvedInterfaces.push(resolvedInterface);
        staticDefinitions += "$p.extendInterfaceMembers(" + className + ", " + resolvedInterface + ");\n";
      }
      metadata += className + ".$interfaces = [" + contextMappedString(resolvedInterfaces, replaceContext, ', ') + "];\n";
    }
    metadata += className + ".$isInterface = true;\n";
    metadata += className + ".$methods = [\'" + contextMappedString(this.methodsNames, replaceContext, "\', \'") + "\'];\n";

    sortByWeight(this.innerClasses);
    for (i = 0, l = this.innerClasses.length; i < l; ++i) {
      var innerClass = this.innerClasses[i];
      if (innerClass.isStatic) {
        staticDefinitions += className + "." + innerClass.name + " = " + innerClass + ";\n";
      }
    }

    for (i = 0, l = this.fields.length; i < l; ++i) {
      var field = this.fields[i];
      if (field.isStatic) {
        staticDefinitions += className + "." + contextMappedString(field.definitions, replaceContext, ";\n" + className + ".") + ";\n";
      }
    }

    return "(function() {\n" +
      "function " + className + "() { throw \'Unable to create the interface\'; }\n" +
      staticDefinitions +
      metadata +
      "return " + className + ";\n" +
      "})()";
  }
}

class AstLabel {
  constructor(label) {
    this.label = label;
  }

  toString(replaceContext) {
    return this.label;
  }
}

class AstMethod {
  constructor(name, params, body) {
    this.name = name;
    this.params = params;
    this.body = body;
  }

  toString(replaceContext) {
    var paramNames = appendToLookupTable$1({}, this.params.getNames());
    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstMethod.toString");
      console.trace();
    }

    replaceContext = function (subject) {
      return paramNames.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
    };

    var body = this.params.prependMethodArgs(this.body.toString(replaceContext));

    return "function " + this.name + this.params + " " + body + "\n" +
                 "$p." + this.name + " = " + this.name + ";\n" +
                 this.name + " = " + this.name + ".bind($p);";
  }
}

// AstParam contains the name of a parameter inside a function declaration
class AstParam {
  constructor(name) {
    this.name = name;
  }

  toString(replaceContext) {
    return this.name;
  }
}

// AstParams contains an array of AstParam objects
class AstParams {
  constructor(params, methodArgsParam) {
    this.params = params;
    this.methodArgsParam = methodArgsParam;
  }

  getNames() {
    var names = [];
    for(var i=0,l=this.params.length;i<l;++i) {
      names.push(this.params[i].name);
    }
    return names;
  }

  prependMethodArgs(body) {
    if (!this.methodArgsParam) {
      return body;
    }
    return "{\nvar " + this.methodArgsParam.name +
      " = Array.prototype.slice.call(arguments, " +
      this.params.length + ");\n" + body.substring(1);
  }

  toString(replaceContext) {
    if(this.params.length === 0) {
      return "()";
    }
    var result = "(";
    for(var i=0,l=this.params.length;i<l;++i) {
      result += this.params[i] + ", ";
    }
    return result.substring(0, result.length - 2) + ")";
  }
}

class AstPrefixStatement {
  constructor(name, argument, misc) {
    this.name = name;
    this.argument = argument;
    this.misc = misc;
  }

  toString(replaceContext) {
    var result = this.misc.prefix;
    if(this.argument !== undefined) {
      result += this.argument.toString();
    }
    return result;
  }
}

class AstStatement {
  constructor(expression) {
    this.expression = expression;
  }

  toString(replaceContext) {
    return this.expression.toString(replaceContext);
  }
}

class AstVar {
  constructor(definitions, varType) {
    this.definitions = definitions;
    this.varType = varType;
  }

  getNames() {
    var names = [];
    for(var i=0,l=this.definitions.length;i<l;++i) {
      names.push(this.definitions[i].name);
    }
    return names;
  }

  toString(replaceContext) {
    return "var " + contextMappedString(this.definitions, replaceContext, ',');
  }
}

function getLocalNames(statements) {
  let localNames = [];
  for(let i=0,l=statements.length;i<l;++i) {
    let statement = statements[i];
    if(statement instanceof AstVar) {
      localNames = localNames.concat(statement.getNames());
    } else if(statement instanceof AstForStatement &&
      statement.argument.initStatement instanceof AstVar) {
      localNames = localNames.concat(statement.argument.initStatement.getNames());
    } else if(statement instanceof AstInnerInterface || statement instanceof AstInnerClass ||
      statement instanceof AstInterface || statement instanceof AstClass ||
      statement instanceof AstMethod || statement instanceof AstFunction) {
      localNames.push(statement.name);
    }
  }
  return appendToLookupTable$1({}, localNames);
}

// check to see if the lookup table has any entries,
// making sure to consider it empty even when it has
// inherited properties from supers.
function isLookupTableEmpty(table) {
  // FIXME: TODO: this can probably use Object.keys() instead
  for(var i in table) {
    if(table.hasOwnProperty(i)) {
      return false;
    }
  }
  return true;
}

class AstStatementsBlock {
  constructor(statements) {
    this.statements = statements;
  }

  toString(replaceContext) {
    var localNames = getLocalNames(this.statements);
    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstStatementsBlock.toString");
      console.trace();
    }

    // replacing context only when necessary
    if(!isLookupTableEmpty(localNames)) {
      replaceContext = function (subject) {
        return localNames.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
      };
    }

    return "{\n" + contextMappedString(this.statements, replaceContext, '') + "\n}";
  }
}

class AstSwitchCase {
  constructor(expr) {
    this.expr = expr;
  }

  toString(replaceContext) {
    return "case " + this.expr + ":";
  }
}

class AstVarDefinition {
  constructor (name, value, isDefault) {
    this.name = name;
    this.value = value;
    this.isDefault = isDefault;
  }

  toString(replaceContext) {
    return this.name + ' = ' + this.value.toString(replaceContext);
  }
}

/*
  This code is responsible for creating an Abstract Syntax Tree from
  Processing source, a Java-like type of code.

  It is an object tree. The root object is created from the AstRoot class,
  which contains statements.

  A statement object can be of type:

    AstForStatement
    AstCatchStatement
    AstPrefixStatement
    AstMethod
    AstClass,
    AstInterface
    AstFunction
    AstStatementBlock
    AstLabel

  Furthermore, an AstPrefixStatement can be a statement of type:

    if
    switch
    while
    with
    do
    else
    finally
    return
    throw
    try
    break
    continue

  All of these objects have a .toString() function that returns
  the JavaScript expression for the statement.

  Any processing calls need "processing." prepended to them.

  Similarly, calls from inside classes need "$this_1.", prepended to them,
  with 1 being the depth level for inner classes.
  This includes members passed down from inheritance.

*/

// =======================================================

class Transformer {
  constructor(atoms) {
    this.atoms = atoms;
    this.replaceContext;
    this.declaredClasses = {};
    this.currentClassId;
    this.classIdSeed = 0;
    this.classesRegex = /\b((?:(?:public|private|final|protected|static|abstract)\s+)*)(class|interface)\s+([A-Za-z_$][\w$]*\b)(\s+extends\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*,\s*[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*\b)*)?(\s+implements\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*,\s*[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*\b)*)?\s*("A\d+")/g;
    this.methodsRegex = /\b((?:(?:public|private|final|protected|static|abstract|synchronized)\s+)*)((?!(?:else|new|return|throw|function|public|private|protected)\b)[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*"C\d+")*)\s*([A-Za-z_$][\w$]*\b)\s*("B\d+")(\s*throws\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*,\s*[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)*)?\s*("A\d+"|;)/g;
    this.fieldTest = /^((?:(?:public|private|final|protected|static)\s+)*)((?!(?:else|new|return|throw)\b)[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*"C\d+")*)\s*([A-Za-z_$][\w$]*\b)\s*(?:"C\d+"\s*)*([=,]|$)/;
    this.cstrsRegex = /\b((?:(?:public|private|final|protected|static|abstract)\s+)*)((?!(?:new|return|throw)\b)[A-Za-z_$][\w$]*\b)\s*("B\d+")(\s*throws\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*,\s*[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)*)?\s*("A\d+")/g;
    this.attrAndTypeRegex = /^((?:(?:public|private|final|protected|static)\s+)*)((?!(?:new|return|throw)\b)[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*"C\d+")*)\s*/;
    this.functionsRegex = /\bfunction(?:\s+([A-Za-z_$][\w$]*))?\s*("B\d+")\s*("A\d+")/g;
  }

  addAtom(text, type) {
    let atoms = this.atoms;
    let lastIndex = atoms.length;
    atoms.push(text);
    return '"' + type + lastIndex + '"';
  }

  transformParams(params) {
    let paramsWithoutPars = trim(params.substring(1, params.length - 1));
    let result = [], methodArgsParam = null;
    if(paramsWithoutPars !== "") {
      let paramList = paramsWithoutPars.split(",");
      for(let i=0; i < paramList.length; ++i) {
        let param = /\b([A-Za-z_$][\w$]*\b)(\s*"[ABC][\d]*")*\s*$/.exec(paramList[i]);
        if (i === paramList.length - 1 && paramList[i].indexOf('...') >= 0) {
          methodArgsParam = new AstParam(param[1]);
          break;
        }
        result.push(new AstParam(param[1]));
      }
    }
    return new AstParams(result, methodArgsParam);
  }

  transformInlineClass(class_) {
    let m = new RegExp(/\bnew\s*([A-Za-z_$][\w$]*\s*(?:\.\s*[A-Za-z_$][\w$]*)*)\s*"B\d+"\s*"A(\d+)"/).exec(class_);
    let oldClassId = this.currentClassId;
    let newClassId = this.generateClassId();
    this.currentClassId = newClassId;
    let uniqueClassName = m[1] + "$" + newClassId;
    let inlineClass = new AstInlineClass(uniqueClassName, this.transformClassBody(atoms[m[2]], uniqueClassName, "", "implements " + m[1]));
    this.appendClass(inlineClass, newClassId, oldClassId);
    this.currentClassId = oldClassId;
    return inlineClass;
  }

  transformFunction(class_) {
    let m = new RegExp(/\b([A-Za-z_$][\w$]*)\s*"B(\d+)"\s*"A(\d+)"/).exec(class_);
    return new AstFunction( m[1] !== "function" ? m[1] : null,
      this.transformParams(atoms[m[2]]), this.transformStatementsBlock(atoms[m[3]]));
  }

  transformInlineObject(obj) {
    let members = obj.split(',');
    for(let i=0; i < members.length; ++i) {
      let label = members[i].indexOf(':');
      if(label < 0) {
        members[i] = { value: this.transformExpression(members[i]) };
      } else {
        members[i] = { label: trim(members[i].substring(0, label)),
          value: this.transformExpression( trim(members[i].substring(label + 1)) ) };
      }
    }
    return new AstInlineObject(members);
  }

  expandExpression(expr) {
    if(expr.charAt(0) === '(' || expr.charAt(0) === '[') {
      return expr.charAt(0) + this.expandExpression(expr.substring(1, expr.length - 1)) + expr.charAt(expr.length - 1);
    }
    if(expr.charAt(0) === '{') {
      if(/^\{\s*(?:[A-Za-z_$][\w$]*|'\d+')\s*:/.test(expr)) {
        return "{" + this.addAtom(expr.substring(1, expr.length - 1), 'I') + "}";
      }
      return "[" + this.expandExpression(expr.substring(1, expr.length - 1)) + "]";
    }
    let trimmed = trimSpaces$1(expr);
    let result = preExpressionTransform(this, trimmed.middle);
    let atoms = this.atoms;
    result = result.replace(/"[ABC](\d+)"/g, (all, index) => this.expandExpression(atoms[index]));
    return trimmed.untrim(result);
  }

  transformExpression(expr) {
    let transforms = [];
    let s = this.expandExpression(expr);
    s = s.replace(/"H(\d+)"/g, (all, index) => {
      transforms.push(this.transformFunction(atoms[index]));
      return '"!' + (transforms.length - 1) + '"';
    });
    s = s.replace(/"F(\d+)"/g, (all, index) => {
      transforms.push(this.transformInlineClass(atoms[index]));
      return '"!' + (transforms.length - 1) + '"';
    });
    s = s.replace(/"I(\d+)"/g, (all, index) => {
      transforms.push(this.transformInlineObject(atoms[index]));
      return '"!' + (transforms.length - 1) + '"';
    });

    return new AstExpression(s, transforms);
  };

  transformVarDefinition(def, defaultTypeValue) {
    let eqIndex = def.indexOf("=");
    let name, value, isDefault;
    if(eqIndex < 0) {
      name = def;
      value = defaultTypeValue;
      isDefault = true;
    } else {
      name = def.substring(0, eqIndex);
      value = this.transformExpression(def.substring(eqIndex + 1));
      isDefault = false;
    }
    return new AstVarDefinition( trim(name.replace(/(\s*"C\d+")+/g, "")), value, isDefault);
  }

  getDefaultValueForType(type) {
    if(type === "int" || type === "float") {
      return "0";
    }
    if(type === "boolean") {
      return "false";
    }
    if(type === "color") {
      return "0x00000000";
    }
    return "null";
  }

  transformStatement(statement) {
    if(this.fieldTest.test(statement)) {
      let attrAndType = this.attrAndTypeRegex.exec(statement);
      let definitions = statement.substring(attrAndType[0].length).split(",");
      let defaultTypeValue = this.getDefaultValueForType(attrAndType[2]);
      for(let i=0; i < definitions.length; ++i) {
        definitions[i] = this.transformVarDefinition(definitions[i], defaultTypeValue);
      }
      return new AstVar(definitions, attrAndType[2]);
    }
    return new AstStatement(this.transformExpression(statement));
  }

  transformForExpression(expr) {
    let content;
    if (/\bin\b/.test(expr)) {
      content = expr.substring(1, expr.length - 1).split(/\bin\b/g);
      return new AstForInExpression( this.transformStatement(trim(content[0])),
        this.transformExpression(content[1]));
    }
    if (expr.indexOf(":") >= 0 && expr.indexOf(";") < 0) {
      content = expr.substring(1, expr.length - 1).split(":");
      return new AstForEachExpression( this.transformStatement(trim(content[0])),
        this.transformExpression(content[1]));
    }
    content = expr.substring(1, expr.length - 1).split(";");
    return new AstForExpression( this.transformStatement(trim(content[0])),
      this.transformExpression(content[1]), this.transformExpression(content[2]));
  }

  transformInnerClass(class_) {
    let m = this.classesRegex.exec(class_); // 1 - attr, 2 - class|int, 3 - name, 4 - extends, 5 - implements, 6 - body
    this.classesRegex.lastIndex = 0;
    let isStatic = m[1].indexOf("static") >= 0;
    let body = atoms[getAtomIndex(m[6])], innerClass;
    let oldClassId = this.currentClassId;
    let newClassId = this.generateClassId();
    this.currentClassId = newClassId;
    if(m[2] === "interface") {
      innerClass = new AstInnerInterface(m[3], this.transformInterfaceBody(body, m[3], m[4]), isStatic);
    } else {
      innerClass = new AstInnerClass(m[3], this.transformClassBody(body, m[3], m[4], m[5]), isStatic);
    }
    this.appendClass(innerClass, newClassId, oldClassId);
    this.currentClassId = oldClassId;
    return innerClass;
  }

  transformClassMethod(method) {
    let atoms = this.atoms;
    let m = this.methodsRegex.exec(method);
    this.methodsRegex.lastIndex = 0;
    let isStatic = m[1].indexOf("static") >= 0;
    let body = m[6] !== ';' ? atoms[getAtomIndex(m[6])] : "{}";
    return new AstClassMethod(m[3], this.transformParams(atoms[getAtomIndex(m[4])]),
      this.transformStatementsBlock(body), isStatic );
  }

  transformClassField(statement) {
    let attrAndType = this.attrAndTypeRegex.exec(statement);
    let isStatic = attrAndType[1].indexOf("static") >= 0;
    let definitions = statement.substring(attrAndType[0].length).split(/,\s*/g);
    let defaultTypeValue = this.getDefaultValueForType(attrAndType[2]);
    for(let i=0; i < definitions.length; ++i) {
      definitions[i] = this.transformVarDefinition(definitions[i], defaultTypeValue);
    }
    return new AstClassField(definitions, attrAndType[2], isStatic);
  }

  transformConstructor(cstr) {
    let m = new RegExp(/"B(\d+)"\s*"A(\d+)"/).exec(cstr);
    let params = this.transformParams(atoms[m[1]]);

    return new AstConstructor(params, this.transformStatementsBlock(atoms[m[2]]));
  }

  // This converts constructors into atoms, and adds them to the atoms array.
  // constructors = G
  extractConstructors(code, className) {
    let result = code.replace(this.cstrsRegex, (all, attr, name, params, throws_, body) => {
      if(name !== className) {
        return all;
      }
      return this.addAtom(all, 'G');
    });
    return result;
  }

  // This converts classes, methods and functions into atoms, and adds them to the atoms array.
  // classes = E, methods = D and functions = H
  extractClassesAndMethods(code) {
    let s = code;
    s = s.replace(this.classesRegex, all => this.addAtom(all, 'E'));
    s = s.replace(this.methodsRegex, all => this.addAtom(all, 'D'));
    s = s.replace(this.functionsRegex, all => this.addAtom(all, 'H'));
    return s;
  }

  transformInterfaceBody(body, name, baseInterfaces) {
    let declarations = body.substring(1, body.length - 1);
    declarations = this.extractClassesAndMethods(declarations);
    declarations = this.extractConstructors(declarations, name);
    let methodsNames = [], classes = [];
    declarations = declarations.replace(/"([DE])(\d+)"/g, (all, type, index) => {
      if(type === 'D') { methodsNames.push(index); }
      else if(type === 'E') { classes.push(index); }
      return '';
    });
    let fields = declarations.split(/;(?:\s*;)*/g);
    let baseInterfaceNames;
    let i, l;

    if(baseInterfaces !== undefined) {
      let baseInterfaceRegExp = /^\s*extends\s+(.+?)\s*$/g;
      baseInterfaceNames = baseInterfaces.replace(baseInterfaceRegExp, "$1").split(/\s*,\s*/g);
    }

    for(i = 0, l = methodsNames.length; i < l; ++i) {
      let method = this.transformClassMethod(atoms[methodsNames[i]]);
      methodsNames[i] = method.name;
    }
    for(i = 0, l = fields.length - 1; i < l; ++i) {
      let field = trimSpaces$1(fields[i]);
      fields[i] = this.transformClassField(field.middle);
    }
    let tail = fields.pop();
    for(i = 0, l = classes.length; i < l; ++i) {
      classes[i] = this.transformInnerClass(atoms[classes[i]]);
    }

    return new AstInterfaceBody(name, baseInterfaceNames, methodsNames, fields, classes, { tail: tail });
  };

  transformClassBody(body, name, baseName, interfaces) {
    let atoms = this.atoms;
    let declarations = body.substring(1, body.length - 1);
    declarations = this.extractClassesAndMethods(declarations);
    declarations = this.extractConstructors(declarations, name);
    let methods = [], classes = [], cstrs = [], functions = [];
    let declarationRegExp = /"([DEGH])(\d+)"/g;
    declarations = declarations.replace(declarationRegExp, (all, type, index) => {
      if(type === 'D') { methods.push(index); }
      else if(type === 'E') { classes.push(index); }
      else if(type === 'H') { functions.push(index); }
      else { cstrs.push(index); }
      return '';
    });
    let fields = declarations.replace(/^(?:\s*;)+/, "").split(/;(?:\s*;)*/g);
    let baseClassName, interfacesNames;
    let i;

    if(baseName !== undefined) {
      baseClassName = baseName.replace(/^\s*extends\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)\s*$/g, "$1");
    }

    if(interfaces !== undefined) {
      interfacesNames = interfaces.replace(/^\s*implements\s+(.+?)\s*$/g, "$1").split(/\s*,\s*/g);
    }

    for(i = 0; i < functions.length; ++i) {
      functions[i] = this.transformFunction(atoms[functions[i]]);
    }
    for(i = 0; i < methods.length; ++i) {
      methods[i] = this.transformClassMethod(atoms[methods[i]]);
    }
    for(i = 0; i < fields.length - 1; ++i) {
      let field = trimSpaces$1(fields[i]);
      fields[i] = this.transformClassField(field.middle);
    }
    let tail = fields.pop();
    for(i = 0; i < cstrs.length; ++i) {
      cstrs[i] = this.transformConstructor(atoms[cstrs[i]]);
    }
    for(i = 0; i < classes.length; ++i) {
      classes[i] = this.transformInnerClass(atoms[classes[i]]);
    }

    return new AstClassBody(name, baseClassName, interfacesNames, functions, methods, fields, cstrs,
      classes, { tail: tail });
  };

  generateClassId() {
    return "class" + (++this.classIdSeed);
  }

  appendClass(class_, classId, scopeId) {
    class_.classId = classId;
    class_.scopeId = scopeId;
    this.declaredClasses[classId] = class_;
  }

  transformGlobalClass(class_) {
    let m = this.classesRegex.exec(class_); // 1 - attr, 2 - class|int, 3 - name, 4 - extends, 5 - implements, 6 - body
    this.classesRegex.lastIndex = 0;
    let body = this.atoms[getAtomIndex(m[6])];
    let oldClassId = this.currentClassId;
    let newClassId = this.generateClassId();
    this.currentClassId = newClassId;
    let globalClass;
    if(m[2] === "interface") {
      globalClass = new AstInterface(m[3], this.transformInterfaceBody(body, m[3], m[4]) );
    } else {
      globalClass = new AstClass(m[3], this.transformClassBody(body, m[3], m[4], m[5]) );
    }
    this.appendClass(globalClass, newClassId, oldClassId);
    this.currentClassId = oldClassId;
    return globalClass;
  }

  transformGlobalMethod(method) {
    let atoms = this.atoms;
    let m = this.methodsRegex.exec(method);
    let result =
    this.methodsRegex.lastIndex = 0;
    return new AstMethod(m[3], this.transformParams(atoms[getAtomIndex(m[4])]),
      this.transformStatementsBlock(atoms[getAtomIndex(m[6])]));
  }

  transformStatements(statements) {
    let nextStatement = new RegExp(/\b(catch|for|if|switch|while|with)\s*"B(\d+)"|\b(do|else|finally|return|throw|try|break|continue)\b|("[ADEH](\d+)")|\b(case)\s+([^:]+):|\b([A-Za-z_$][\w$]*\s*:)|(;)/g);
    let atoms = this.atoms;
    let res = [];
    statements = preStatementsTransform(statements);
    let lastIndex = 0, m, space;
    // m contains the matches from the nextStatement regexp, null if there are no matches.
    // nextStatement.exec starts searching at nextStatement.lastIndex.
    while((m = nextStatement.exec(statements)) !== null) {
      if(m[1] !== undefined) { // catch, for ...
        let i = statements.lastIndexOf('"B', nextStatement.lastIndex);
        let statementsPrefix = statements.substring(lastIndex, i);
        if(m[1] === "for") {
          res.push(new AstForStatement(this.transformForExpression(atoms[m[2]]),
            { prefix: statementsPrefix }) );
        } else if(m[1] === "catch") {
          res.push(new AstCatchStatement(this.transformParams(atoms[m[2]]),
            { prefix: statementsPrefix }) );
        } else {
          res.push(new AstPrefixStatement(m[1], this.transformExpression(atoms[m[2]]),
            { prefix: statementsPrefix }) );
        }
      } else if(m[3] !== undefined) { // do, else, ...
          res.push(new AstPrefixStatement(m[3], undefined,
            { prefix: statements.substring(lastIndex, nextStatement.lastIndex) }) );
      } else if(m[4] !== undefined) { // block, class and methods
        space = statements.substring(lastIndex, nextStatement.lastIndex - m[4].length);
        if(trim(space).length !== 0) { continue; } // avoiding new type[] {} construct
        res.push(space);
        let kind = m[4].charAt(1), atomIndex = m[5];
        if(kind === 'D') {
          res.push(this.transformGlobalMethod(atoms[atomIndex]));
        } else if(kind === 'E') {
          res.push(this.transformGlobalClass(atoms[atomIndex]));
        } else if(kind === 'H') {
          res.push(this.transformFunction(atoms[atomIndex]));
        } else {
          res.push(this.transformStatementsBlock(atoms[atomIndex]));
        }
      } else if(m[6] !== undefined) { // switch case
        res.push(new AstSwitchCase(this.transformExpression(trim(m[7]))));
      } else if(m[8] !== undefined) { // label
        space = statements.substring(lastIndex, nextStatement.lastIndex - m[8].length);
        if(trim(space).length !== 0) { continue; } // avoiding ?: construct
        res.push(new AstLabel(statements.substring(lastIndex, nextStatement.lastIndex)) );
      } else { // semicolon
        let statement = trimSpaces$1(statements.substring(lastIndex, nextStatement.lastIndex - 1));
        res.push(statement.left);
        res.push(this.transformStatement(statement.middle));
        res.push(statement.right + ";");
      }
      lastIndex = nextStatement.lastIndex;
    }
    let statementsTail = trimSpaces$1(statements.substring(lastIndex));
    res.push(statementsTail.left);
    if(statementsTail.middle !== "") {
      res.push(this.transformStatement(statementsTail.middle));
      res.push(";" + statementsTail.right);
    }
    return res;
  }

  transformStatementsBlock(block) {
    let content = trimSpaces$1(block.substring(1, block.length - 1));
    return new AstStatementsBlock(this.transformStatements(content.middle));
  }
}

function generateMetadata(declaredClasses) {
  let id, class_;
  let globalScope = {};

  Object.keys(declaredClasses).forEach(id => {
    class_ = declaredClasses[id];
    let scopeId = class_.scopeId, name = class_.name;
    if(scopeId) {
      let scope = declaredClasses[scopeId];
      class_.scope = scope;
      if(scope.inScope === undefined) {
        scope.inScope = {};
      }
      scope.inScope[name] = class_;
    } else {
      globalScope[name] = class_;
    }
  });

  function findInScopes(class_, name) {
    let parts = name.split('.');
    let currentScope = class_.scope, found;
    while(currentScope) {
      if(currentScope.hasOwnProperty(parts[0])) {
        found = currentScope[parts[0]]; break;
      }
      currentScope = currentScope.scope;
    }
    if(found === undefined) {
      found = globalScope[parts[0]];
    }
    for(let i=1,l=parts.length;i<l && found;++i) {
      found = found.inScope[parts[i]];
    }
    return found;
  }

  for(id in declaredClasses) {
    if(declaredClasses.hasOwnProperty(id)) {
      class_ = declaredClasses[id];
      let baseClassName = class_.body.baseClassName;
      if(baseClassName) {
        let parent = findInScopes(class_, baseClassName);
        if (parent) {
          class_.base = parent;
          if (!parent.derived) {
            parent.derived = [];
          }
          parent.derived.push(class_);
        }
      }
      let interfacesNames = class_.body.interfacesNames,
        interfaces = [], i, l;
      if (interfacesNames && interfacesNames.length > 0) {
        for (i = 0, l = interfacesNames.length; i < l; ++i) {
          let interface_ = findInScopes(class_, interfacesNames[i]);
          interfaces.push(interface_);
          if (!interface_) {
            continue;
          }
          if (!interface_.derived) {
            interface_.derived = [];
          }
          interface_.derived.push(class_);
        }
        if (interfaces.length > 0) {
          class_.interfaces = interfaces;
        }
      }
    }
  }
}

function setWeight(declaredClasses) {
  let queue = [], tocheck = {};
  let id, scopeId, class_;
  // queue most inner and non-inherited
  for (id in declaredClasses) {
    if (declaredClasses.hasOwnProperty(id)) {
      class_ = declaredClasses[id];
      if (!class_.inScope && !class_.derived) {
        queue.push(id);
        class_.weight = 0;
      } else {
        let dependsOn = [];
        if (class_.inScope) {
          for (scopeId in class_.inScope) {
            if (class_.inScope.hasOwnProperty(scopeId)) {
              dependsOn.push(class_.inScope[scopeId]);
            }
          }
        }
        if (class_.derived) {
          dependsOn = dependsOn.concat(class_.derived);
        }
        tocheck[id] = dependsOn;
      }
    }
  }
  function removeDependentAndCheck(targetId, from) {
    let dependsOn = tocheck[targetId];
    if (!dependsOn) {
      return false; // no need to process
    }
    let i = dependsOn.indexOf(from);
    if (i < 0) {
      return false;
    }
    dependsOn.splice(i, 1);
    if (dependsOn.length > 0) {
      return false;
    }
    delete tocheck[targetId];
    return true;
  }
  while (queue.length > 0) {
    id = queue.shift();
    class_ = declaredClasses[id];
    if (class_.scopeId && removeDependentAndCheck(class_.scopeId, class_)) {
      queue.push(class_.scopeId);
      declaredClasses[class_.scopeId].weight = class_.weight + 1;
    }
    if (class_.base && removeDependentAndCheck(class_.base.classId, class_)) {
      queue.push(class_.base.classId);
      class_.base.weight = class_.weight + 1;
    }
    if (class_.interfaces) {
      let i, l;
      for (i = 0, l = class_.interfaces.length; i < l; ++i) {
        if (!class_.interfaces[i] ||
            !removeDependentAndCheck(class_.interfaces[i].classId, class_)) {
          continue;
        }
        queue.push(class_.interfaces[i].classId);
        class_.interfaces[i].weight = class_.weight + 1;
      }
    }
  }
}

/**
 * The list of official Processing API keywords as defined by the official
 * Processing reference over on https://processing.org/reference
 */

var names = [
    "abs",
    "acos",
    "alpha",
    "ambient",
    "ambientLight",
    "append",
    "applyMatrix",
    "arc",
    "arrayCopy",
    "asin",
    "atan",
    "atan2",
    "background",
    "beginCamera",
    "beginDraw",
    "beginShape",
    "bezier",
    "bezierDetail",
    "bezierPoint",
    "bezierTangent",
    "bezierVertex",
    "binary",
    "blend",
    "blendColor",
    "blit_resize",
    "blue",
    "box",
    "breakShape",
    "brightness",
    "camera",
    "ceil",
    "Character",
    "color",
    "colorMode",
    "concat",
    "constrain",
    "copy",
    "cos",
    "createFont",
    "createGraphics",
    "createImage",
    "cursor",
    "curve",
    "curveDetail",
    "curvePoint",
    "curveTangent",
    "curveTightness",
    "curveVertex",
    "day",
    "degrees",
    "directionalLight",
    "disableContextMenu",
    "dist",
    "draw",
    "ellipse",
    "ellipseMode",
    "emissive",
    "enableContextMenu",
    "endCamera",
    "endDraw",
    "endShape",
    "exit",
    "exp",
    "expand",
    "externals",
    "fill",
    "filter",
    "floor",
    "focused",
    "frameCount",
    "frameRate",
    "frustum",
    "get",
    "glyphLook",
    "glyphTable",
    "green",
    "height",
    "hex",
    "hint",
    "hour",
    "hue",
    "image",
    "imageMode",
    "intersect",
    "join",
    "key",
    "keyCode",
    "keyPressed",
    "keyReleased",
    "keyTyped",
    "lerp",
    "lerpColor",
    "lightFalloff",
    "lights",
    "lightSpecular",
    "line",
    "link",
    "loadBytes",
    "loadFont",
    "loadGlyphs",
    "loadImage",
    "loadPixels",
    "loadShape",
    "loadXML",
    "loadStrings",
    "log",
    "loop",
    "mag",
    "map",
    "match",
    "matchAll",
    "max",
    "millis",
    "min",
    "minute",
    "mix",
    "modelX",
    "modelY",
    "modelZ",
    "modes",
    "month",
    "mouseButton",
    "mouseClicked",
    "mouseDragged",
    "mouseMoved",
    "mouseOut",
    "mouseOver",
    "mousePressed",
    "mouseReleased",
    "mouseScroll",
    "mouseScrolled",
    "mouseX",
    "mouseY",
    "name",
    "nf",
    "nfc",
    "nfp",
    "nfs",
    "noCursor",
    "noFill",
    "noise",
    "noiseDetail",
    "noiseSeed",
    "noLights",
    "noLoop",
    "norm",
    "normal",
    "noSmooth",
    "noStroke",
    "noTint",
    "ortho",
    "param",
    "parseBoolean",
    "parseByte",
    "parseChar",
    "parseFloat",
    "parseInt",
    "parseXML",
    "peg",
    "perspective",
    "PImage",
    "pixels",
    "PMatrix2D",
    "PMatrix3D",
    "PMatrixStack",
    "pmouseX",
    "pmouseY",
    "point",
    "pointLight",
    "popMatrix",
    "popStyle",
    "pow",
    "print",
    "printCamera",
    "println",
    "printMatrix",
    "printProjection",
    "PShape",
    "PShapeSVG",
    "pushMatrix",
    "pushStyle",
    "quad",
    "radians",
    "random",
    "randomGaussian",
    "randomSeed",
    "rect",
    "rectMode",
    "red",
    "redraw",
    "requestImage",
    "resetMatrix",
    "reverse",
    "rotate",
    "rotateX",
    "rotateY",
    "rotateZ",
    "round",
    "saturation",
    "save",
    "saveFrame",
    "saveStrings",
    "scale",
    "screenX",
    "screenY",
    "screenZ",
    "second",
    "set",
    "setup",
    "shape",
    "shapeMode",
    "shared",
    "shearX",
    "shearY",
    "shininess",
    "shorten",
    "sin",
    "size",
    "smooth",
    "sort",
    "specular",
    "sphere",
    "sphereDetail",
    "splice",
    "split",
    "splitTokens",
    "spotLight",
    "sq",
    "sqrt",
    "status",
    "str",
    "stroke",
    "strokeCap",
    "strokeJoin",
    "strokeWeight",
    "subset",
    "tan",
    "text",
    "textAlign",
    "textAscent",
    "textDescent",
    "textFont",
    "textLeading",
    "textMode",
    "textSize",
    "texture",
    "textureMode",
    "textWidth",
    "tint",
    "toImageData",
    "touchCancel",
    "touchEnd",
    "touchMove",
    "touchStart",
    "translate",
    "transform",
    "triangle",
    "trim",
    "unbinary",
    "unhex",
    "updatePixels",
    "use3DContext",
    "vertex",
    "width",
    "XMLElement",
    "XML",
    "year",
    // special gobal names used during conversion
    "__contains",
    "__equals",
    "__equalsIgnoreCase",
    "__frameRate",
    "__hashCode",
    "__int_cast",
    "__instanceof",
    "__keyPressed",
    "__mousePressed",
    "__printStackTrace",
    "__replace",
    "__replaceAll",
    "__replaceFirst",
    "__toCharArray",
    "__split",
    "__codePointAt",
    "__startsWith",
    "__endsWith",
    "__matches"
];

// // custom functions and properties are added here
// if(aFunctions) {
//   Object.keys(aFunctions).forEach(function(name) {
//     names.push(name);
//   });
// }

// custom libraries that were attached to Processing
var globalNames = {};
var i;
var l;
for (i = 0, l = names.length; i < l ; ++i) {
    globalNames[names[i]] = null;
}

var PConstants = {
  PI: Math.PI,
  TAU: 2 * Math.PI
};

var PConstants$1 = { PConstants };

var DefaultScope = {
	undef: undefined
};

var defaultScope = { DefaultScope };

/**
 * Root of a Processing AST
 */

class Ast {
  constructor(declaredClasses, strings, astNodes) {
    this.declaredClasses = declaredClasses;
    this.sourceStrings = strings;
    this.astNodes = astNodes;
  }

  getSourceStrings() {
    return this.sourceStrings;
  }

  generateMetadata() {
    generateMetadata(this.declaredClasses);
  }

  setWeight() {
    setWeight(this.declaredClasses);
  }

  replaceContext(localNames) {
    return (subject) => {
      let name = subject.name;
      if(localNames.hasOwnProperty(name)) {
        return name;
      }
      if(globalNames.hasOwnProperty(name) ||
         PConstants$1.hasOwnProperty(name) ||
         defaultScope.hasOwnProperty(name)) {
        return "$p." + name;
      }
      return name;
    };
  }

  toString() {
    let classes = [],
        otherStatements = [],
        statement;
    for (let i = 0, len = this.astNodes.length; i < len; ++i) {
      statement = this.astNodes[i];
      if (statement instanceof AstClass || statement instanceof AstInterface) {
        classes.push(statement);
      } else {
        otherStatements.push(statement);
      }
    }

    sortByWeight$1(classes);

    let localNames = getLocalNames(this.astNodes);
    let replaceContext = this.replaceContext(localNames);

    let result = [
      '// this code was autogenerated from PJS',
      '(function($p) {',
      contextMappedString(classes, replaceContext, ''),
      contextMappedString(otherStatements, replaceContext, ''),
      '})'
    ].join('\n');

    return result;
  }
}

// helper function:
//
//   masks strings and regexs with "'5'", where 5 is the index in an array
//   containing all strings and regexs also removes all comments.
//
function removeStrings(strings) {
  return function(all, quoted, aposed, regexCtx, prefix, regex, singleComment, comment) {
    let index;
    if(quoted || aposed) { // replace strings
      index = strings.length;
      strings.push(all);
      return "'" + index + "'";
    }
    if(regexCtx) { // replace RegExps
      index = strings.length;
      strings.push(regex);
      return prefix + "'" + index + "'";
    }
    // kill comments
    return comment !== "" ? " " : "\n";
  };
}

// helper function
//
//   protects $ and _ in source code during AST transformation
//
function hexProtector(all, hexCode) {
  // $ = __x0024
  // _ = __x005F
  // this protects existing character codes from conversion
  // __x0024 = __x005F_x0024
  return "__x005F_x" + hexCode;
}

// ...
function transformMain(code) {
	// remove carriage returns "\r"
	let codeWithoutExtraCr = code.replace(/\r\n?|\n\r/g, "\n");

  // unzip code as string heap and stringless source code.
	let strings = [];
  let replaceFn = removeStrings(strings);
	let codeWithoutStrings = codeWithoutExtraCr.replace(/("(?:[^"\\\n]|\\.)*")|('(?:[^'\\\n]|\\.)*')|(([\[\(=|&!\^:?]\s*)(\/(?![*\/])(?:[^\/\\\n]|\\.)*\/[gim]*)\b)|(\/\/[^\n]*\n)|(\/\*(?:(?!\*\/)(?:.|\n))*\*\/)/g, replaceFn);

	// protect character codes from namespace collision
	codeWithoutStrings = codeWithoutStrings.replace(/__x([0-9A-F]{4})/g, hexProtector);

	// convert dollar sign to character code
	codeWithoutStrings = codeWithoutStrings.replace(/\$/g, "__x0024");

	// Remove newlines after return statements
	codeWithoutStrings = codeWithoutStrings.replace(/return\s*[\n\r]+/g, "return ");

	// Remove generics
	let codeWithoutGenerics = removeGenerics(codeWithoutStrings);

	// Split code into atoms
	let atoms = splitToAtoms(codeWithoutGenerics);
  let transformer = new Transformer(atoms);

  // Remove java import statements from the source
  //
  // FIXME: TODO: now that ES6 has class import functionality, we
  //              should be able to leave these in, and then during
  //              execution let the browser deal with errors.
  let statements = transformer.extractClassesAndMethods(atoms[0]);
  statements = statements.replace(/\bimport\s+[^;]+;/g, "");

  // transform code into an AST nodeSet
  let nodeSet = transformer.transformStatements(statements);
  let declaredClasses = transformer.declaredClasses;

  // bind transform as AST
  let ast = new Ast(declaredClasses, strings, nodeSet);
  ast.generateMetadata();
  ast.setWeight();

  // and we're done
  return ast;
}

// replaces strings and regexs keyed by index with an array of strings
function injectStrings(code, strings) {
  return code.replace(/'(\d+)'/g, function(all, index) {
    var val = strings[index];
    if(val.charAt(0) === "/") {
      return val;
    }
    return (/^'((?:[^'\\\n])|(?:\\.[0-9A-Fa-f]*))'$/).test(val) ? "(new $p.Character(" + val + "))" : val;
  });
}

function parseProcessing(code) {
  // run the conversion from source to AST
  let ast = transformMain(code);

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
  pjsSourceCode = injectStrings(pjsSourceCode, strings);

  return pjsSourceCode;
}

// ==================================================================
//
//  Syntax converter for Processing syntax (java-like) to JavaScript
//
// ==================================================================

function convert(processingSourceCode) {
  let sketch = new Sketch();
  let pureSourceCode = processPreDirectives(processingSourceCode, sketch);
  let javaScriptSourceCode = parseProcessing(pureSourceCode);
  sketch.sourceCode = javaScriptSourceCode;
  return sketch;
}

// SIMPLE CODE TEST

var converted = convert(`
  import test.something; \
\
  class Cake { \
    int a = 0; \
    boolean test(boolean okay) { \
      return true; \
    } \
    static boolean test2(boolean okay) { \
      return false; \
    } \
  } \
\
  void setup() { \
    Cake c = new Cake(); \
    noLoop(); \
  } \
\
  void draw() { \
    background(255); \
  } \
`);

console.log(converted.sourceCode);
