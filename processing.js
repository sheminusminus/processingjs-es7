(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Processing = factory());
}(this, (function () { 'use strict';

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

/**
 * masks parentheses, brackets and braces with '"A5"' where A is the bracket type,
 * and 5 is the index in an array containing all brackets split into atoms:
 *
 *   'while(true){}' -> 'while"B1""A2"'
 *
 * The mapping used is:
 *
 *   braces{} = A
 *   parentheses() = B
 *   brackets[] = C
 */
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
function trimSpaces(string) {
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
    return this.misc.prefix + this.argument.toString(replaceContext);
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

/**
 * convenience module
 */
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
      result += this.members[i].value.toString(replaceContext) + ", ";
    }
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

    var body = this.body.toString(replaceContext);
    body = this.params.prependMethodArgs(body);

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
      result += this.argument.toString(replaceContext);
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
    return "case " + this.expr.toString(replaceContext) + ":";
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

 /**
   * ...
   */
  generateClassId() {
    return "class" + (++this.classIdSeed);
  }

  /**
   * ...
   */
  appendClass(class_, classId, scopeId) {
    class_.classId = classId;
    class_.scopeId = scopeId;
    this.declaredClasses[classId] = class_;
  }

  /**
   * ...
   */
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

  /**
   * ...
   */
  addAtom(text, type) {
    let atoms = this.atoms;
    let lastIndex = atoms.length;
    atoms.push(text);
    return '"' + type + lastIndex + '"';
  }

  /**
   * ...
   */
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

  /**
   * ...
   */
  transformInlineClass(class_) {
    let inlineClassRegExp = /\bnew\s*([A-Za-z_$][\w$]*\s*(?:\.\s*[A-Za-z_$][\w$]*)*)\s*"B\d+"\s*"A(\d+)"/;
    let m = new RegExp(inlineClassRegExp).exec(class_);
    let oldClassId = this.currentClassId;
    let newClassId = this.generateClassId();
    this.currentClassId = newClassId;
    let uniqueClassName = m[1] + "$" + newClassId;
    let inlineClass = new AstInlineClass(uniqueClassName, this.transformClassBody(atoms[m[2]], uniqueClassName, "", "implements " + m[1]));
    this.appendClass(inlineClass, newClassId, oldClassId);
    this.currentClassId = oldClassId;
    return inlineClass;
  }

  /**
   * ...
   */
  transformFunction(class_) {
    let functionRegExp = /\b([A-Za-z_$][\w$]*)\s*"B(\d+)"\s*"A(\d+)"/;
    let m = new RegExp(functionRegExp).exec(class_);
    let atoms = this.atoms;
    return new AstFunction( m[1] !== "function" ? m[1] : null,
      this.transformParams(atoms[m[2]]), this.transformStatementsBlock(atoms[m[3]]));
  }

  /**
   * ...
   */
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

  /**
   * ...
   */
  expandExpression(expr) {
    if(expr.charAt(0) === '(' || expr.charAt(0) === '[') {
      return expr.charAt(0) + this.expandExpression(expr.substring(1, expr.length - 1)) + expr.charAt(expr.length - 1);
    }
    if(expr.charAt(0) === '{') {
      // FIXME: TODO: figure out what the proper name for this regexp is
      if(/^\{\s*(?:[A-Za-z_$][\w$]*|'\d+')\s*:/.test(expr)) {
        return "{" + this.addAtom(expr.substring(1, expr.length - 1), 'I') + "}";
      }
      return "[" + this.expandExpression(expr.substring(1, expr.length - 1)) + "]";
    }
    let trimmed = trimSpaces(expr);
    let result = preExpressionTransform(this, trimmed.middle);
    let atoms = this.atoms;
    result = result.replace(/"[ABC](\d+)"/g, (all, index) => this.expandExpression(atoms[index]));
    return trimmed.untrim(result);
  }

  /**
   * ...
   */
  transformExpression(expr) {
    let transforms = [];
    let atoms = this.atoms;
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

  /**
   * ...
   */
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

  /**
   * ...
   */
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

  /**
   * ...
   */
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

  /**
   * ...
   */
  transformInnerClass(class_) {
    let atoms = this.atoms;
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

  /**
   * ...
   */
  transformClassMethod(method) {
    let atoms = this.atoms;
    let m = this.methodsRegex.exec(method);
    this.methodsRegex.lastIndex = 0;
    let isStatic = m[1].indexOf("static") >= 0;
    let body = m[6] !== ';' ? atoms[getAtomIndex(m[6])] : "{}";
    return new AstClassMethod(m[3], this.transformParams(atoms[getAtomIndex(m[4])]),
      this.transformStatementsBlock(body), isStatic );
  }

  /**
   * ...
   */
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

  /**
   * This converts constructors into atoms, and adds them to the atoms array.
   * constructors = G
   */
  extractConstructors(code, className) {
    let result = code.replace(this.cstrsRegex, (all, attr, name, params, throws_, body) => {
      if(name !== className) {
        return all;
      }
      return this.addAtom(all, 'G');
    });
    return result;
  }

  /**
   * ...
   */
  transformConstructor(cstr) {
    let atoms = this.atoms;
    let m = new RegExp(/"B(\d+)"\s*"A(\d+)"/).exec(cstr);
    let params = this.transformParams(atoms[m[1]]);

    return new AstConstructor(params, this.transformStatementsBlock(atoms[m[2]]));
  }

  /**
   * This converts classes, methods and functions into atoms, and adds them to the atoms array.
   * classes = E, methods = D and functions = H
   */
  extractClassesAndMethods(code) {
    let s = code;
    s = s.replace(this.classesRegex, all => this.addAtom(all, 'E'));
    s = s.replace(this.methodsRegex, all => this.addAtom(all, 'D'));
    s = s.replace(this.functionsRegex, all => this.addAtom(all, 'H'));
    return s;
  }

  /**
   * ...
   */
  transformInterfaceBody(body, name, baseInterfaces) {
    let atoms = this.atoms;
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
      let field = trimSpaces(fields[i]);
      fields[i] = this.transformClassField(field.middle);
    }
    let tail = fields.pop();
    for(i = 0, l = classes.length; i < l; ++i) {
      classes[i] = this.transformInnerClass(atoms[classes[i]]);
    }

    return new AstInterfaceBody(name, baseInterfaceNames, methodsNames, fields, classes, { tail: tail });
  }

  /**
   * ...
   */
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
      // FIXME: TODO: figure out the proper name for this regexp
      baseClassName = baseName.replace(/^\s*extends\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)\s*$/g, "$1");
    }

    if(interfaces !== undefined) {
      // FIXME: TODO: figure out the proper name for this regexp
      interfacesNames = interfaces.replace(/^\s*implements\s+(.+?)\s*$/g, "$1").split(/\s*,\s*/g);
    }

    for(i = 0; i < functions.length; ++i) {
      functions[i] = this.transformFunction(atoms[functions[i]]);
    }
    for(i = 0; i < methods.length; ++i) {
      methods[i] = this.transformClassMethod(atoms[methods[i]]);
    }
    for(i = 0; i < fields.length - 1; ++i) {
      let field = trimSpaces(fields[i]);
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
  }

  /**
   * ...
   */
  transformGlobalClass(class_) {
    let m = this.classesRegex.exec(class_); // 1 - attr, 2 - class|int, 3 - name, 4 - extends, 5 - implements, 6 - body
    this.classesRegex.lastIndex = 0;
    let atoms = this.atoms;
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

  /**
   * ...
   */
  transformGlobalMethod(method) {
    let atoms = this.atoms;
    let m = this.methodsRegex.exec(method);
    let result =
    this.methodsRegex.lastIndex = 0;
    return new AstMethod(m[3], this.transformParams(atoms[getAtomIndex(m[4])]),
      this.transformStatementsBlock(atoms[getAtomIndex(m[6])]));
  }

  /**
   * ...
   */
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
        let statement = trimSpaces(statements.substring(lastIndex, nextStatement.lastIndex - 1));
        res.push(statement.left);
        res.push(this.transformStatement(statement.middle));
        res.push(statement.right + ";");
      }
      lastIndex = nextStatement.lastIndex;
    }
    let statementsTail = trimSpaces(statements.substring(lastIndex));
    res.push(statementsTail.left);
    if(statementsTail.middle !== "") {
      res.push(this.transformStatement(statementsTail.middle));
      res.push(";" + statementsTail.right);
    }
    return res;
  }

  /**
   * ...
   */
  transformStatementsBlock(block) {
    let content = trimSpaces(block.substring(1, block.length - 1));
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

// helper function
function removeDependentAndCheck(tocheck, targetId, from) {
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

/**
 * ...documentation goes here...
 */
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

  while (queue.length > 0) {
    id = queue.shift();
    class_ = declaredClasses[id];
    if (class_.scopeId && removeDependentAndCheck(tocheck, class_.scopeId, class_)) {
      queue.push(class_.scopeId);
      declaredClasses[class_.scopeId].weight = class_.weight + 1;
    }
    if (class_.base && removeDependentAndCheck(tocheck, class_.base.classId, class_)) {
      queue.push(class_.base.classId);
      class_.base.weight = class_.weight + 1;
    }
    if (class_.interfaces) {
      let i, l;
      for (i = 0, l = class_.interfaces.length; i < l; ++i) {
        if (!class_.interfaces[i] ||
            !removeDependentAndCheck(tocheck, class_.interfaces[i].classId, class_)) {
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

/**
 * Processing.js environment constants
 */
const PConstants$1 = {
    X: 0,
    Y: 1,
    Z: 2,

    R: 3,
    G: 4,
    B: 5,
    A: 6,

    U: 7,
    V: 8,

    NX: 9,
    NY: 10,
    NZ: 11,

    EDGE: 12,

    // Stroke
    SR: 13,
    SG: 14,
    SB: 15,
    SA: 16,

    SW: 17,

    // Transformations (2D and 3D)
    TX: 18,
    TY: 19,
    TZ: 20,

    VX: 21,
    VY: 22,
    VZ: 23,
    VW: 24,

    // Material properties
    AR: 25,
    AG: 26,
    AB: 27,

    DR: 3,
    DG: 4,
    DB: 5,
    DA: 6,

    SPR: 28,
    SPG: 29,
    SPB: 30,

    SHINE: 31,

    ER: 32,
    EG: 33,
    EB: 34,

    BEEN_LIT: 35,

    VERTEX_FIELD_COUNT: 36,

    // Renderers
    P2D:    1,
    JAVA2D: 1,
    WEBGL:  2,
    P3D:    2,
    OPENGL: 2,
    PDF:    0,
    DXF:    0,

    // Platform IDs
    OTHER:   0,
    WINDOWS: 1,
    MAXOSX:  2,
    LINUX:   3,

    EPSILON: 0.0001,

    MAX_FLOAT:  3.4028235e+38,
    MIN_FLOAT: -3.4028235e+38,
    MAX_INT:    2147483647,
    MIN_INT:   -2147483648,

    PI:         Math.PI,
    TWO_PI:     2 * Math.PI,
    TAU:        2 * Math.PI,
    HALF_PI:    Math.PI / 2,
    THIRD_PI:   Math.PI / 3,
    QUARTER_PI: Math.PI / 4,

    DEG_TO_RAD: Math.PI / 180,
    RAD_TO_DEG: 180 / Math.PI,

    WHITESPACE: " \t\n\r\f\u00A0",

    // Color modes
    RGB:   1,
    ARGB:  2,
    HSB:   3,
    ALPHA: 4,
    CMYK:  5,

    // Image file types
    TIFF:  0,
    TARGA: 1,
    JPEG:  2,
    GIF:   3,

    // Filter/convert types
    BLUR:      11,
    GRAY:      12,
    INVERT:    13,
    OPAQUE:    14,
    POSTERIZE: 15,
    THRESHOLD: 16,
    ERODE:     17,
    DILATE:    18,

    // Blend modes
    REPLACE:    0,
    BLEND:      1 << 0,
    ADD:        1 << 1,
    SUBTRACT:   1 << 2,
    LIGHTEST:   1 << 3,
    DARKEST:    1 << 4,
    DIFFERENCE: 1 << 5,
    EXCLUSION:  1 << 6,
    MULTIPLY:   1 << 7,
    SCREEN:     1 << 8,
    OVERLAY:    1 << 9,
    HARD_LIGHT: 1 << 10,
    SOFT_LIGHT: 1 << 11,
    DODGE:      1 << 12,
    BURN:       1 << 13,

    // Color component bit masks
    ALPHA_MASK: 0xff000000,
    RED_MASK:   0x00ff0000,
    GREEN_MASK: 0x0000ff00,
    BLUE_MASK:  0x000000ff,

    // Projection matrices
    CUSTOM:       0,
    ORTHOGRAPHIC: 2,
    PERSPECTIVE:  3,

    // Shapes
    POINT:          2,
    POINTS:         2,
    LINE:           4,
    LINES:          4,
    TRIANGLE:       8,
    TRIANGLES:      9,
    TRIANGLE_STRIP: 10,
    TRIANGLE_FAN:   11,
    QUAD:           16,
    QUADS:          16,
    QUAD_STRIP:     17,
    POLYGON:        20,
    PATH:           21,
    RECT:           30,
    ELLIPSE:        31,
    ARC:            32,
    SPHERE:         40,
    BOX:            41,

    // Arc drawing modes
    //OPEN:          1, // shared with Shape closing modes
    CHORD:           2,
    PIE:             3,


    GROUP:          0,
    PRIMITIVE:      1,
    //PATH:         21, // shared with Shape PATH
    GEOMETRY:       3,

    // Shape Vertex
    VERTEX:        0,
    BEZIER_VERTEX: 1,
    CURVE_VERTEX:  2,
    BREAK:         3,
    CLOSESHAPE:    4,

    // Shape closing modes
    OPEN:  1,
    CLOSE: 2,

    // Shape drawing modes
    CORNER:          0, // Draw mode convention to use (x, y) to (width, height)
    CORNERS:         1, // Draw mode convention to use (x1, y1) to (x2, y2) coordinates
    RADIUS:          2, // Draw mode from the center, and using the radius
    CENTER_RADIUS:   2, // Deprecated! Use RADIUS instead
    CENTER:          3, // Draw from the center, using second pair of values as the diameter
    DIAMETER:        3, // Synonym for the CENTER constant. Draw from the center
    CENTER_DIAMETER: 3, // Deprecated! Use DIAMETER instead

    // Text vertical alignment modes
    BASELINE: 0,   // Default vertical alignment for text placement
    TOP:      101, // Align text to the top
    BOTTOM:   102, // Align text from the bottom, using the baseline

    // UV Texture coordinate modes
    NORMAL:     1,
    NORMALIZED: 1,
    IMAGE:      2,

    // Text placement modes
    MODEL: 4,
    SHAPE: 5,

    // Stroke modes
    SQUARE:  'butt',
    ROUND:   'round',
    PROJECT: 'square',
    MITER:   'miter',
    BEVEL:   'bevel',

    // Lighting modes
    AMBIENT:     0,
    DIRECTIONAL: 1,
    //POINT:     2, Shared with Shape constant
    SPOT:        3,

    // Key constants

    // Both key and keyCode will be equal to these values
    BACKSPACE: 8,
    TAB:       9,
    ENTER:     10,
    RETURN:    13,
    ESC:       27,
    DELETE:    127,
    CODED:     0xffff,

    // p.key will be CODED and p.keyCode will be this value
    SHIFT:     16,
    CONTROL:   17,
    ALT:       18,
    CAPSLK:    20,
    PGUP:      33,
    PGDN:      34,
    END:       35,
    HOME:      36,
    LEFT:      37,
    UP:        38,
    RIGHT:     39,
    DOWN:      40,
    F1:        112,
    F2:        113,
    F3:        114,
    F4:        115,
    F5:        116,
    F6:        117,
    F7:        118,
    F8:        119,
    F9:        120,
    F10:       121,
    F11:       122,
    F12:       123,
    NUMLK:     144,
    META:      157,
    INSERT:    155,

    // Cursor types
    ARROW:    'default',
    CROSS:    'crosshair',
    HAND:     'pointer',
    MOVE:     'move',
    TEXT:     'text',
    WAIT:     'wait',
    NOCURSOR: "url('data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='), auto",

    // Hints
    DISABLE_OPENGL_2X_SMOOTH:     1,
    ENABLE_OPENGL_2X_SMOOTH:     -1,
    ENABLE_OPENGL_4X_SMOOTH:      2,
    ENABLE_NATIVE_FONTS:          3,
    DISABLE_DEPTH_TEST:           4,
    ENABLE_DEPTH_TEST:           -4,
    ENABLE_DEPTH_SORT:            5,
    DISABLE_DEPTH_SORT:          -5,
    DISABLE_OPENGL_ERROR_REPORT:  6,
    ENABLE_OPENGL_ERROR_REPORT:  -6,
    ENABLE_ACCURATE_TEXTURES:     7,
    DISABLE_ACCURATE_TEXTURES:   -7,
    HINT_COUNT:                  10,

    // PJS defined constants
    SINCOS_LENGTH:      720,       // every half degree
    PRECISIONB:         15,        // fixed point precision is limited to 15 bits!!
    PRECISIONF:         1 << 15,
    PREC_MAXVAL:        (1 << 15) - 1,
    PREC_ALPHA_SHIFT:   24 - 15,
    PREC_RED_SHIFT:     16 - 15,
    NORMAL_MODE_AUTO:   0,
    NORMAL_MODE_SHAPE:  1,
    NORMAL_MODE_VERTEX: 2,
    MAX_LIGHTS:         8
};

/**
* Datatype for storing images. Processing can display .gif, .jpg, .tga, and .png images. Images may be
* displayed in 2D and 3D space. Before an image is used, it must be loaded with the loadImage() function.
* The PImage object contains fields for the width and height of the image, as well as an array called
* pixels[]  which contains the values for every pixel in the image. A group of methods, described below,
* allow easy access to the image's pixels and alpha channel and simplify the process of compositing.
* Before using the pixels[] array, be sure to use the loadPixels() method on the image to make sure that the
* pixel data is properly loaded. To create a new image, use the createImage() function (do not use new PImage()).
*
* @param {int} width                image width
* @param {int} height               image height
* @param {MODE} format              Either RGB, ARGB, ALPHA (grayscale alpha channel)
*
* @returns {PImage}
*
* @see loadImage
* @see imageMode
* @see createImage
*/
class PImage {
  constructor(p, aWidth, aHeight, aFormat) {
    this.p = p;

    // Keep track of whether or not the cached imageData has been touched.
    this.__isDirty = false;

    if (aWidth instanceof HTMLImageElement) {
      // convert an <img> to a PImage
      this.fromHTMLImageData(aWidth);
    } else if (aHeight || aFormat) {
      this.width = aWidth || 1;
      this.height = aHeight || 1;

      // Stuff a canvas into sourceImg so image() calls can use drawImage like an <img>
      var canvas = this.sourceImg = document.createElement("canvas");
      canvas.width = this.width;
      canvas.height = this.height;

      var imageData = this.imageData = canvas.getContext('2d').createImageData(this.width, this.height);
      this.format = (aFormat === PConstants.ARGB || aFormat === PConstants.ALPHA) ? aFormat : PConstants.RGB;
      if (this.format === PConstants.RGB) {
        // Set the alpha channel of an RGB image to opaque.
        for (var i = 3, data = this.imageData.data, len = data.length; i < len; i += 4) {
          data[i] = 255;
        }
      }

      this.__isDirty = true;
      this.updatePixels();
    } else {
      this.width = 0;
      this.height = 0;
      this.imageData = utilityContext2d.createImageData(1, 1);
      this.format = PConstants.ARGB;
    }

    this.pixels = buildPixelsObject(this);
    this.__isPImage = true;
  }

  /**
  * @member PImage
  * Updates the image with the data in its pixels[] array. Use in conjunction with loadPixels(). If
  * you're only reading pixels from the array, there's no need to call updatePixels().
  * Certain renderers may or may not seem to require loadPixels() or updatePixels(). However, the rule
  * is that any time you want to manipulate the pixels[] array, you must first call loadPixels(), and
  * after changes have been made, call updatePixels(). Even if the renderer may not seem to use this
  * function in the current Processing release, this will always be subject to change.
  * Currently, none of the renderers use the additional parameters to updatePixels().
  */
  updatePixels() {
    var canvas = this.sourceImg;
    if (canvas && canvas instanceof HTMLCanvasElement && this.__isDirty) {
      canvas.getContext('2d').putImageData(this.imageData, 0, 0);
    }
    this.__isDirty = false;
  }

  fromHTMLImageData(htmlImg) {
    // convert an <img> to a PImage
    var canvasData = getCanvasData(htmlImg);
    try {
      var imageData = canvasData.context.getImageData(0, 0, htmlImg.width, htmlImg.height);
      this.fromImageData(imageData);
    } catch(e) {
      if (htmlImg.width && htmlImg.height) {
        this.isRemote = true;
        this.width = htmlImg.width;
        this.height = htmlImg.height;
      }
    }
    this.sourceImg = htmlImg;
  }

  get(x, y, w, h) {
    if (!arguments.length) {
      return this.p.get(this);
    }
    if (arguments.length === 2) {
      return this.p.get(x, y, this);
    }
    if (arguments.length === 4) {
      return this.p.get(x, y, w, h, this);
    }
  }

  /**
  * @member PImage
  * Changes the color of any pixel or writes an image directly into the image. The x and y parameter
  * specify the pixel or the upper-left corner of the image. The color parameter specifies the color value.
  * Setting the color of a single pixel with set(x, y) is easy, but not as fast as putting the data
  * directly into pixels[]. The equivalent statement to "set(x, y, #000000)" using pixels[] is
  * "pixels[y*width+x] = #000000". Processing requires calling loadPixels() to load the display window
  * data into the pixels[] array before getting the values and calling updatePixels() to update the window.
  *
  * @param {int} x        x-coordinate of the pixel or upper-left corner of the image
  * @param {int} y        y-coordinate of the pixel or upper-left corner of the image
  * @param {color} color  any value of the color datatype
  *
  * @see get
  * @see pixels[]
  * @see copy
  */
  set(x, y, c) {
    this.p.set(x, y, c, this);
    this.__isDirty = true;
  }

  /**
  * @member PImage
  * Blends a region of pixels into the image specified by the img parameter. These copies utilize full
  * alpha channel support and a choice of the following modes to blend the colors of source pixels (A)
  * with the ones of pixels in the destination image (B):
  * BLEND - linear interpolation of colours: C = A*factor + B
  * ADD - additive blending with white clip: C = min(A*factor + B, 255)
  * SUBTRACT - subtractive blending with black clip: C = max(B - A*factor, 0)
  * DARKEST - only the darkest colour succeeds: C = min(A*factor, B)
  * LIGHTEST - only the lightest colour succeeds: C = max(A*factor, B)
  * DIFFERENCE - subtract colors from underlying image.
  * EXCLUSION - similar to DIFFERENCE, but less extreme.
  * MULTIPLY - Multiply the colors, result will always be darker.
  * SCREEN - Opposite multiply, uses inverse values of the colors.
  * OVERLAY - A mix of MULTIPLY and SCREEN. Multiplies dark values, and screens light values.
  * HARD_LIGHT - SCREEN when greater than 50% gray, MULTIPLY when lower.
  * SOFT_LIGHT - Mix of DARKEST and LIGHTEST. Works like OVERLAY, but not as harsh.
  * DODGE - Lightens light tones and increases contrast, ignores darks. Called "Color Dodge" in Illustrator and Photoshop.
  * BURN - Darker areas are applied, increasing contrast, ignores lights. Called "Color Burn" in Illustrator and Photoshop.
  * All modes use the alpha information (highest byte) of source image pixels as the blending factor.
  * If the source and destination regions are different sizes, the image will be automatically resized to
  * match the destination size. If the srcImg parameter is not used, the display window is used as the source image.
  * This function ignores imageMode().
  *
  * @param {int} x              X coordinate of the source's upper left corner
  * @param {int} y              Y coordinate of the source's upper left corner
  * @param {int} width          source image width
  * @param {int} height         source image height
  * @param {int} dx             X coordinate of the destinations's upper left corner
  * @param {int} dy             Y coordinate of the destinations's upper left corner
  * @param {int} dwidth         destination image width
  * @param {int} dheight        destination image height
  * @param {PImage} srcImg      an image variable referring to the source image
  * @param {MODE} MODE          Either BLEND, ADD, SUBTRACT, LIGHTEST, DARKEST, DIFFERENCE, EXCLUSION,
  * MULTIPLY, SCREEN, OVERLAY, HARD_LIGHT, SOFT_LIGHT, DODGE, BURN
  *
  * @see alpha
  * @see copy
  */
  blend(srcImg, x, y, width, height, dx, dy, dwidth, dheight, MODE) {
    if (arguments.length === 9) {
      this.p.blend(this, srcImg, x, y, width, height, dx, dy, dwidth, dheight, this);
    } else if (arguments.length === 10) {
      this.p.blend(srcImg, x, y, width, height, dx, dy, dwidth, dheight, MODE, this);
    }
    delete this.sourceImg;
  }

  /**
  * @member PImage
  * Copies a region of pixels from one image into another. If the source and destination regions
  * aren't the same size, it will automatically resize source pixels to fit the specified target region.
  * No alpha information is used in the process, however if the source image has an alpha channel set,
  * it will be copied as well. This function ignores imageMode().
  *
  * @param {int} sx             X coordinate of the source's upper left corner
  * @param {int} sy             Y coordinate of the source's upper left corner
  * @param {int} swidth         source image width
  * @param {int} sheight        source image height
  * @param {int} dx             X coordinate of the destinations's upper left corner
  * @param {int} dy             Y coordinate of the destinations's upper left corner
  * @param {int} dwidth         destination image width
  * @param {int} dheight        destination image height
  * @param {PImage} srcImg      an image variable referring to the source image
  *
  * @see alpha
  * @see blend
  */
  copy(srcImg, sx, sy, swidth, sheight, dx, dy, dwidth, dheight) {
    if (arguments.length === 8) {
      this.p.blend(this, srcImg, sx, sy, swidth, sheight, dx, dy, dwidth, PConstants.REPLACE, this);
    } else if (arguments.length === 9) {
      this.p.blend(srcImg, sx, sy, swidth, sheight, dx, dy, dwidth, dheight, PConstants.REPLACE, this);
    }
    delete this.sourceImg;
  }

  /**
  * @member PImage
  * Filters an image as defined by one of the following modes:
  * THRESHOLD - converts the image to black and white pixels depending if they are above or below
  * the threshold defined by the level parameter. The level must be between 0.0 (black) and 1.0(white).
  * If no level is specified, 0.5 is used.
  * GRAY - converts any colors in the image to grayscale equivalents
  * INVERT - sets each pixel to its inverse value
  * POSTERIZE - limits each channel of the image to the number of colors specified as the level parameter
  * BLUR - executes a Guassian blur with the level parameter specifying the extent of the blurring.
  * If no level parameter is used, the blur is equivalent to Guassian blur of radius 1.
  * OPAQUE - sets the alpha channel to entirely opaque.
  * ERODE - reduces the light areas with the amount defined by the level parameter.
  * DILATE - increases the light areas with the amount defined by the level parameter
  *
  * @param {MODE} MODE        Either THRESHOLD, GRAY, INVERT, POSTERIZE, BLUR, OPAQUE, ERODE, or DILATE
  * @param {int|float} param  in the range from 0 to 1
  */
  filter(mode, param) {
    if (arguments.length === 2) {
      this.p.filter(mode, param, this);
    } else if (arguments.length === 1) {
      // no param specified, send null to show its invalid
      this.p.filter(mode, null, this);
    }
    delete this.sourceImg;
  }

  /**
  * @member PImage
  * Saves the image into a file. Images are saved in TIFF, TARGA, JPEG, and PNG format depending on
  * the extension within the filename  parameter. For example, "image.tif" will have a TIFF image and
  * "image.png" will save a PNG image. If no extension is included in the filename, the image will save
  * in TIFF format and .tif will be added to the name. These files are saved to the sketch's folder,
  * which may be opened by selecting "Show sketch folder" from the "Sketch" menu. It is not possible to
  * use save() while running the program in a web browser.
  * To save an image created within the code, rather than through loading, it's necessary to make the
  * image with the createImage() function so it is aware of the location of the program and can therefore
  * save the file to the right place. See the createImage() reference for more information.
  *
  * @param {String} filename        a sequence of letters and numbers
  */
  save(file) {
    this.p.save(file,this);
  }

  /**
  * @member PImage
  * Resize the image to a new width and height. To make the image scale proportionally, use 0 as the
  * value for the wide or high parameter.
  *
  * @param {int} wide         the resized image width
  * @param {int} high         the resized image height
  *
  * @see get
  */
  resize(w, h) {
    if (this.isRemote) { // Remote images cannot access imageData
      throw "Image is loaded remotely. Cannot resize.";
    }
    if (this.width !== 0 || this.height !== 0) {
      // make aspect ratio if w or h is 0
      if (w === 0 && h !== 0) {
        w = Math.floor(this.width / this.height * h);
      } else if (h === 0 && w !== 0) {
        h = Math.floor(this.height / this.width * w);
      }
      // put 'this.imageData' into a new canvas
      var canvas = getCanvasData(this.imageData).canvas;
      // pull imageData object out of canvas into ImageData object
      var imageData = getCanvasData(canvas, w, h).context.getImageData(0, 0, w, h);
      // set this as new pimage
      this.fromImageData(imageData);
    }
  }

  /**
  * @member PImage
  * Masks part of an image from displaying by loading another image and using it as an alpha channel.
  * This mask image should only contain grayscale data, but only the blue color channel is used. The
  * mask image needs to be the same size as the image to which it is applied.
  * In addition to using a mask image, an integer array containing the alpha channel data can be
  * specified directly. This method is useful for creating dynamically generated alpha masks. This
  * array must be of the same length as the target image's pixels array and should contain only grayscale
  * data of values between 0-255.
  *
  * @param {PImage} maskImg         any PImage object used as the alpha channel for "img", needs to be same
  *                                 size as "img"
  * @param {int[]} maskArray        any array of Integer numbers used as the alpha channel, needs to be same
  *                                 length as the image's pixel array
  */
  mask(mask) {
    var obj = this.toImageData(),
        i,
        size;

    if (mask instanceof PImage || mask.__isPImage) {
      if (mask.width === this.width && mask.height === this.height) {
        mask = mask.toImageData();

        for (i = 2, size = this.width * this.height * 4; i < size; i += 4) {
          // using it as an alpha channel
          obj.data[i + 1] = mask.data[i];
          // but only the blue color channel
        }
      } else {
        throw "mask must have the same dimensions as PImage.";
      }
    } else if (mask instanceof Array) {
      if (this.width * this.height === mask.length) {
        for (i = 0, size = mask.length; i < size; ++i) {
          obj.data[i * 4 + 3] = mask[i];
        }
      } else {
        throw "mask array must be the same length as PImage pixels array.";
      }
    }

    this.fromImageData(obj);
  }

  // These are intentionally left blank for PImages, we work live with pixels and draw as necessary
  /**
  * @member PImage
  * Loads the pixel data for the image into its pixels[] array. This function must always be called
  * before reading from or writing to pixels[].
  * Certain renderers may or may not seem to require loadPixels() or updatePixels(). However, the
  * rule is that any time you want to manipulate the pixels[] array, you must first call loadPixels(),
  * and after changes have been made, call updatePixels(). Even if the renderer may not seem to use
  * this function in the current Processing release, this will always be subject to change.
  */
  loadPixels() {
    // noop
  }

  toImageData() {
    if (this.isRemote) {
      return this.sourceImg;
    }

    if (!this.__isDirty) {
      return this.imageData;
    }

    var canvasData = getCanvasData(this.sourceImg);
    return canvasData.context.getImageData(0, 0, this.width, this.height);
  }

  toDataURL() {
    if (this.isRemote) { // Remote images cannot access imageData
      throw "Image is loaded remotely. Cannot create dataURI.";
    }
    var canvasData = getCanvasData(this.imageData);
    return canvasData.canvas.toDataURL();
  }

  fromImageData(canvasImg) {
    var w = canvasImg.width,
      h = canvasImg.height,
      canvas = document.createElement('canvas'),
      ctx = canvas.getContext('2d');

    this.width = canvas.width = w;
    this.height = canvas.height = h;

    ctx.putImageData(canvasImg, 0, 0);

    // changed for 0.9
    this.format = PConstants.ARGB;

    this.imageData = canvasImg;
    this.sourceImg = canvas;
  }
}

function noop() {}

/**
* [internal function] computeFontMetrics() calculates various metrics for text
* placement. Currently this function computes the ascent, descent and leading
* (from "lead", used for vertical space) values for the currently active font.
*/
function computeFontMetrics(pfont) {
  var emQuad = 250,
      correctionFactor = pfont.size / emQuad,
      canvas = document.createElement("canvas");
  canvas.width = 2*emQuad;
  canvas.height = 2*emQuad;
  canvas.style.opacity = 0;
  var cfmFont = pfont.getCSSDefinition(emQuad+"px", "normal"),
      ctx = canvas.getContext("2d");
  ctx.font = cfmFont;

  // Size the canvas using a string with common max-ascent and max-descent letters.
  // Changing the canvas dimensions resets the context, so we must reset the font.
  var protrusions = "dbflkhyjqpg";
  canvas.width = ctx.measureText(protrusions).width;
  ctx.font = cfmFont;

  // for text lead values, we meaure a multiline text container.
  var leadDiv = document.createElement("div");
  leadDiv.style.position = "absolute";
  leadDiv.style.opacity = 0;
  leadDiv.style.fontFamily = '"' + pfont.name + '"';
  leadDiv.style.fontSize = emQuad + "px";
  leadDiv.innerHTML = protrusions + "<br/>" + protrusions;
  document.body.appendChild(leadDiv);

  var w = canvas.width,
      h = canvas.height,
      baseline = h/2;

  // Set all canvas pixeldata values to 255, with all the content
  // data being 0. This lets us scan for data[i] != 255.
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "black";
  ctx.fillText(protrusions, 0, baseline);
  var pixelData = ctx.getImageData(0, 0, w, h).data;

  // canvas pixel data is w*4 by h*4, because R, G, B and A are separate,
  // consecutive values in the array, rather than stored as 32 bit ints.
  var i = 0,
      w4 = w * 4,
      len = pixelData.length;

  // Finding the ascent uses a normal, forward scanline
  while (++i < len && pixelData[i] === 255) {
    noop();
  }
  var ascent = Math.round(i / w4);

  // Finding the descent uses a reverse scanline
  i = len - 1;
  while (--i > 0 && pixelData[i] === 255) {
    noop();
  }
  var descent = Math.round(i / w4);

  // set font metrics
  pfont.ascent = correctionFactor * (baseline - ascent);
  pfont.descent = correctionFactor * (descent - baseline);

  // Then we try to get the real value from the browser
  if (document.defaultView.getComputedStyle) {
    var leadDivHeight = document.defaultView.getComputedStyle(leadDiv,null).getPropertyValue("height");
    leadDivHeight = correctionFactor * leadDivHeight.replace("px","");
    if (leadDivHeight >= pfont.size * 2) {
      pfont.leading = Math.round(leadDivHeight/2);
    }
  }
  document.body.removeChild(leadDiv);

  // if we're caching, cache the context used for this pfont
  if (pfont.caching) {
    return ctx;
  }
}

const preloading = {
  // template element used to compare font sizes
  template: {},

  // indicates whether or not the reference tiny font has been loaded
  initialized: false,

  // load the reference tiny font via a css @font-face rule
  initialize: function() {
    let generateTinyFont = function() {
      let encoded = "#E3KAI2wAgT1MvMg7Eo3VmNtYX7ABi3CxnbHlm" +
                    "7Abw3kaGVhZ7ACs3OGhoZWE7A53CRobXR47AY3" +
                    "AGbG9jYQ7G03Bm1heH7ABC3CBuYW1l7Ae3AgcG" +
                    "9zd7AI3AE#B3AQ2kgTY18PPPUACwAg3ALSRoo3" +
                    "#yld0xg32QAB77#E777773B#E3C#I#Q77773E#" +
                    "Q7777777772CMAIw7AB77732B#M#Q3wAB#g3B#" +
                    "E#E2BB//82BB////w#B7#gAEg3E77x2B32B#E#" +
                    "Q#MTcBAQ32gAe#M#QQJ#E32M#QQJ#I#g32Q77#";
      let expand = function(input) {
                     return "AAAAAAAA".substr(~~input ? 7-input : 6);
                   };
      return encoded.replace(/[#237]/g, expand);
    };
    let fontface = document.createElement("style");
    fontface.setAttribute("type","text/css");
    fontface.innerHTML =  "@font-face {\n" +
                          '  font-family: "PjsEmptyFont";' + "\n" +
                          "  src: url('data:application/x-font-ttf;base64,"+generateTinyFont()+"')\n" +
                          "       format('truetype');\n" +
                          "}";
    document.head.appendChild(fontface);

    // set up the template element
    let element = document.createElement("span");
    element.style.cssText = 'position: absolute; top: -1000; left: 0; opacity: 0; font-family: "PjsEmptyFont", fantasy;';
    element.innerHTML = "AAAAAAAA";
    document.body.appendChild(element);
    this.template = element;

    this.initialized = true;
  },

  // Shorthand function to get the computed width for an element.
  getElementWidth: function(element) {
    return document.defaultView.getComputedStyle(element,"").getPropertyValue("width");
  },

  // time taken so far in attempting to load a font
  timeAttempted: 0,

  // returns false if no fonts are pending load, or true otherwise.
  pending: function(intervallength) {
    if (!this.initialized) {
      this.initialize();
    }
    let element,
        computedWidthFont,
        computedWidthRef = this.getElementWidth(this.template);
    for (let i = 0; i < this.fontList.length; i++) {
      // compares size of text in pixels. if equal, custom font is not yet loaded
      element = this.fontList[i];
      computedWidthFont = this.getElementWidth(element);
      if (this.timeAttempted < 4000 && computedWidthFont === computedWidthRef) {
        this.timeAttempted += intervallength;
        return true;
      } else {
        document.body.removeChild(element);
        this.fontList.splice(i--, 1);
        this.timeAttempted = 0;
      }
    }
    // if there are no more fonts to load, pending is false
    if (this.fontList.length === 0) {
      return false;
    }
    // We should have already returned before getting here.
    // But, if we do get here, length!=0 so fonts are pending.
    return true;
  },

  // fontList contains elements to compare font sizes against a template
  fontList: [],

  // addedList contains the fontnames of all the fonts loaded via @font-face
  addedList: {},

  // adds a font to the font cache
  // creates an element using the font, to start loading the font,
  // and compare against a default font to see if the custom font is loaded
  add: function(fontSrc) {
    if (!this.initialized) {
     this.initialize();
    }

    // fontSrc can be a string or a javascript object
    // acceptable fonts are .ttf, .otf, and data uri
    let fontName = (typeof fontSrc === 'object' ? fontSrc.fontFace : fontSrc),
        fontUrl = (typeof fontSrc === 'object' ? fontSrc.url : fontSrc);

    // check whether we already created the @font-face rule for this font
    if (this.addedList[fontName]) {
      return;
    }

    // if we didn't, create the @font-face rule
    let style = document.createElement("style");
    style.setAttribute("type","text/css");
    style.innerHTML = "@font-face{\n  font-family: '" + fontName + "';\n  src:  url('" + fontUrl + "');\n}\n";
    document.head.appendChild(style);
    this.addedList[fontName] = true;

    // also create the element to load and compare the new font
    let element = document.createElement("span");
    element.style.cssText = "position: absolute; top: 0; left: 0; opacity: 0;";
    element.style.fontFamily = '"' + fontName + '", "PjsEmptyFont", fantasy';
    element.innerHTML = "AAAAAAAA";
    document.body.appendChild(element);
    this.fontList.push(element);
  }
};

/**
 * Constructor for a system or from-file (non-SVG) font.
 */
class PFont {
  constructor(name, size) {
    if (name === undefined) {
      name = "";
    }
    this.name = name;
    if (size === undefined) {
      size = 0;
    }
    this.size = size;
    this.glyph = false;
    this.ascent = 0;
    this.descent = 0;
    // For leading, the "safe" value uses the standard TEX ratio of 1.2 em
    this.leading = 1.2 * size;

    // Note that an italic, bold font must used "... Bold Italic"
    // in P5. "... Italic Bold" is treated as normal/normal.
    let illegalIndicator = name.indexOf(" Italic Bold");
    if (illegalIndicator !== -1) {
      name = name.substring(0, illegalIndicator);
    }

    // determine font style
    this.style = "normal";
    let italicsIndicator = name.indexOf(" Italic");
    if (italicsIndicator !== -1) {
      name = name.substring(0, italicsIndicator);
      this.style = "italic";
    }

    // determine font weight
    this.weight = "normal";
    let boldIndicator = name.indexOf(" Bold");
    if (boldIndicator !== -1) {
      name = name.substring(0, boldIndicator);
      this.weight = "bold";
    }

    // determine font-family name
    this.family = "sans-serif";
    if (name !== undefined) {
      switch(name) {
        case "sans-serif":
        case "serif":
        case "monospace":
        case "fantasy":
        case "cursive":
          this.family = name;
          break;
        default:
          this.family = '"' + name + '", sans-serif';
          break;
      }
    }
    // Calculate the ascent/descent/leading value based on how the browser renders this font.
    this.context2d = computeFontMetrics(this);
    this.css = this.getCSSDefinition();
    if (this.context2d) {
      this.context2d.font = this.css;
    }
  }

  /**
   * This function generates the CSS "font" string for this PFont
   */
  getCSSDefinition(fontSize, lineHeight) {
    if(fontSize === undefined) {
      fontSize = this.size + "px";
    }
    if(lineHeight === undefined) {
      lineHeight = this.leading + "px";
    }
    // CSS "font" definition: font-style font-variant font-weight font-size/line-height font-family
    let components = [this.style, "normal", this.weight, fontSize + "/" + lineHeight, this.family];
    return components.join(" ");
  }

  /**
   * Rely on the cached context2d measureText function.
   */
  measureTextWidth(string) {
    return this.context2d.measureText(string).width;
  }

  /**
   * FALLBACK FUNCTION -- replaces Pfont.prototype.measureTextWidth
   * when the font cache becomes too large. This contructs a new
   * canvas 2d context object for calling measureText on.
   */
  measureTextWidthFallback(string) {
    let canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d");
    ctx.font = this.css;
    return ctx.measureText(string).width;
  }
}


/**
 * Global "loaded fonts" list, internal to PFont
 */
PFont.PFontCache = { length: 0 };

/**
 * This function acts as single access point for getting and caching
 * fonts across all sketches handled by an instance of Processing.js
 */
PFont.get = function(fontName, fontSize) {
  // round fontSize to one decimal point
  fontSize = ((fontSize*10)+0.5|0)/10;
  let cache = PFont.PFontCache,
      idx = fontName+"/"+fontSize;
  if (!cache[idx]) {
    cache[idx] = new PFont(fontName, fontSize);
    cache.length++;

    // FALLBACK FUNCTIONALITY 1:
    // If the cache has become large, switch over from full caching
    // to caching only the static metrics for each new font request.
    if (cache.length === 50) {
      PFont.prototype.measureTextWidth = PFont.prototype.measureTextWidthFallback;
      PFont.prototype.caching = false;
      // clear contexts stored for each cached font
      let entry;
      for (entry in cache) {
        if (entry !== "length") {
          cache[entry].context2d = null;
        }
      }
      return new PFont(fontName, fontSize);
    }

    // FALLBACK FUNCTIONALITY 2:
    // If the cache has become too large, switch off font caching entirely.
    if (cache.length === 400) {
      PFont.PFontCache = {};
      PFont.get = PFont.getFallback;
      return new PFont(fontName, fontSize);
    }
  }
  return cache[idx];
};

/**
 * regulates whether or not we're caching the canvas
 * 2d context for quick text width computation.
 */
PFont.caching = true;

/**
 * FALLBACK FUNCTION -- replaces PFont.get when the font cache
 * becomes too large. This function bypasses font caching entirely.
 */
PFont.getFallback = function(fontName, fontSize) {
  return new PFont(fontName, fontSize);
};

/**
 * Lists all standard fonts. Due to browser limitations, this list is
 * not the system font list, like in P5, but the CSS "genre" list.
 */
PFont.list = function() {
  return ["sans-serif", "serif", "monospace", "fantasy", "cursive"];
};

/**
 * Loading external fonts through @font-face rules is handled by PFont,
 * to ensure fonts loaded in this way are globally available.
 */
PFont.preloading = preloading;

class DrawingShared {
  constructor(sketch, canvas, context) {
    this.curSketch = sketch;
    this.curElement = canvas;
    this.curContext = context;

    this.drawing, // hold a Drawing2D or Drawing3D object
    this.doFill = true;
    this.fillStyle = [1.0, 1.0, 1.0, 1.0];
    this.currentFillColor = 0xFFFFFFFF;
    this.isFillDirty = true;
    this.doStroke = true;
    this.strokeStyle = [0.0, 0.0, 0.0, 1.0];
    this.currentStrokeColor = 0xFF000000;
    this.isStrokeDirty = true;
    this.lineWidth = 1;
    this.loopStarted = false;
    this.renderSmooth = false;
    this.doLoop = true;
    this.looping = 0;
    this.curRectMode = PConstants$1.CORNER;
    this.curEllipseMode = PConstants$1.CENTER;
    this.normalX = 0;
    this.normalY = 0;
    this.normalZ = 0;
    this.normalMode = PConstants$1.NORMAL_MODE_AUTO;
    this.curFrameRate = 60;
    this.curMsPerFrame = 1000/this.curFrameRate;
    this.curCursor = PConstants$1.ARROW;
    this.oldCursor = this.curElement.style.cursor;
    this.curShape = PConstants$1.POLYGON;
    this.curShapeCount = 0;
    this.curvePoints = [];
    this.curTightness = 0;
    this.curveDet = 20;
    this.curveInited = false;
    this.backgroundObj = -3355444, // rgb(204, 204, 204) is the default gray background colour
    this.bezDetail = 20;
    this.colorModeA = 255;
    this.colorModeX = 255;
    this.colorModeY = 255;
    this.colorModeZ = 255;
    this.pathOpen = false;
    this.mouseDragging = false;
    this.pmouseXLastFrame = 0;
    this.pmouseYLastFrame = 0;
    this.curColorMode = PConstants$1.RGB;
    this.curTint = null;
    this.curTint3d = null;
    this.getLoaded = false;
    this.start = Date.now();
    this.timeSinceLastFPS = this.start;
    this.framesSinceLastFPS = 0;
    this.textcanvas = undefined;
    this.curveBasisMatrix = undefined;
    this.curveToBezierMatrix = undefined;
    this.curveDrawMatrix = undefined;
    this.bezierDrawMatrix = undefined;
    this.bezierBasisInverse = undefined;
    this.bezierBasisMatrix = undefined;
    this.curContextCache = {
      attributes: {},
      locations: {}
    };

    // Shaders
    this.programObject3D = undefined;
    this.programObject2D = undefined;
    this.programObjectUnlitShape = undefined;
    this.boxBuffer = undefined;
    this.boxNormBuffer = undefined;
    this.boxOutlineBuffer = undefined;
    this.rectBuffer = undefined;
    this.rectNormBuffer = undefined;
    this.sphereBuffer = undefined;
    this.lineBuffer = undefined;
    this.fillBuffer = undefined;
    this.fillColorBuffer = undefined;
    this.strokeColorBuffer = undefined;
    this.pointBuffer = undefined;
    this.shapeTexVBO = undefined;
    this.canTex,   // texture for createGraphics
    this.textTex,   // texture for 3d tex
    this.curTexture = {width:0,height:0};
    this.curTextureMode = PConstants$1.IMAGE;
    this.usingTexture = false;
    this.textBuffer = undefined;
    this.textureBuffer = undefined;
    this.indexBuffer = undefined;

    // Text alignment
    this.horizontalTextAlignment = PConstants$1.LEFT;
    this.verticalTextAlignment = PConstants$1.BASELINE;
    this.textMode = PConstants$1.MODEL;

    // Font state
    this.curFontName = "Arial";
    this.curTextSize = 12;
    this.curTextAscent = 9;
    this.curTextDescent = 2;
    this.curTextLeading = 14;
    this.curTextFont = PFont.get(this.curFontName, this.curTextSize);

    // Pixels cache
    this.originalContext = undefined;
    this.proxyContext = null;
    this.isContextReplaced = false;
    this.setPixelsCached = undefined;
    this.maxPixelsCached = 1000;
    this.pressedKeysMap = [];
    this.lastPressedKeyCode = null;
    this.codedKeys = [ PConstants$1.SHIFT, PConstants$1.CONTROL, PConstants$1.ALT, PConstants$1.CAPSLK, PConstants$1.PGUP, PConstants$1.PGDN,
                      PConstants$1.END, PConstants$1.HOME, PConstants$1.LEFT, PConstants$1.UP, PConstants$1.RIGHT, PConstants$1.DOWN, PConstants$1.NUMLK,
                      PConstants$1.INSERT, PConstants$1.F1, PConstants$1.F2, PConstants$1.F3, PConstants$1.F4, PConstants$1.F5, PConstants$1.F6, PConstants$1.F7,
                      PConstants$1.F8, PConstants$1.F9, PConstants$1.F10, PConstants$1.F11, PConstants$1.F12, PConstants$1.META ];

    // User can only have MAX_LIGHTS lights
    this.lightCount = 0;

    //sphere stuff
    this.sphereDetailV = 0;
    this.sphereDetailU = 0;
    this.sphereX = [];
    this.sphereY = [];
    this.sphereZ = [];
    this.sinLUT = new Float32Array(PConstants$1.SINCOS_LENGTH);
    this.cosLUT = new Float32Array(PConstants$1.SINCOS_LENGTH);
    this.sphereVerts = undefined;
    this.sphereNorms;

    // Camera defaults and settings
    this.cam = undefined;
    this.cameraInv = undefined;
    this.modelView = undefined;
    this.modelViewInv = undefined;
    this.userMatrixStack = undefined;
    this.userReverseMatrixStack = undefined;
    this.inverseCopy = undefined;
    this.projection = undefined;
    this.manipulatingCamera = false;
    this.frustumMode = false;
    this.cameraFOV = 60 * (Math.PI / 180);
    this.cameraX = sketch.width / 2;
    this.cameraY = sketch.height / 2;
    this.cameraZ = this.cameraY / Math.tan(this.cameraFOV / 2);
    this.cameraNear = this.cameraZ / 10;
    this.cameraFar = this.cameraZ * 10;
    this.cameraAspect = sketch.width / sketch.height;

    this.vertArray = [];
    this.curveVertArray = [];
    this.curveVertCount = 0;
    this.isCurve = false;
    this.isBezier = false;
    this.firstVert = true;

    // PShape stuff
    this.curShapeMode = PConstants$1.CORNER;

    // Stores states for pushStyle() and popStyle().
    this.styleArray = [];

    // The vertices for the box cannot be specified using a triangle strip since each
    // side of the cube must have its own set of normals.
    // Vertices are specified in a counter-clockwise order.
    // Triangles are in this order: back, front, right, bottom, left, top.
    this.boxVerts = new Float32Array([
       0.5,  0.5, -0.5,  0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,
       0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5,
       0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5,
       0.5, -0.5, -0.5,  0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,
      -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5, -0.5, -0.5, -0.5,
       0.5,  0.5,  0.5,  0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5]);

    this.boxOutlineVerts = new Float32Array([
       0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5, -0.5,  0.5, -0.5, -0.5,
      -0.5,  0.5, -0.5, -0.5, -0.5, -0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5,
       0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5, -0.5,
      -0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5,
       0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5, -0.5, -0.5, -0.5,
      -0.5, -0.5, -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5,  0.5]);

    this.boxNorms = new Float32Array([
       0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,
       0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,
       1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,
       0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,
      -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0,
       0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0]);

    // These verts are used for the fill and stroke using TRIANGLE_FAN and LINE_LOOP.
    this.rectVerts = new Float32Array([0,0,0, 0,1,0, 1,1,0, 1,0,0]);
    this.rectNorms = new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1]);

    // set up sketch function biundings
    this.bindSketchFNames(sketch);
  }

  bindSketchFNames(p) {
    p.size = this.size.bind(this);
    p.background = this.background.bind(this);
    p.alpha = this.alpha.bind(this);
  }

  a3DOnlyFunction() {
    // noop
  }

  $ensureContext() {
    return this.curContext;
  }

  saveContext() {
    this.curContext.save();
  }

  restoreContext() {
    this.curContext.restore();
    this.isStrokeDirty = true;
    this.isFillDirty = true;
  }

  /**
  * Multiplies the current matrix by the one specified through the parameters. This is very slow because it will
  * try to calculate the inverse of the transform, so avoid it whenever possible. The equivalent function
  * in OpenGL is glMultMatrix().
  *
  * @param {int|float} n00-n15      numbers which define the 4x4 matrix to be multiplied
  *
  * @returns none
  *
  * @see popMatrix
  * @see pushMatrix
  * @see resetMatrix
  * @see printMatrix
  */
  applyMatrix() {
    var a = arguments;
    this.modelView.apply(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15]);
    this.modelViewInv.invApply(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15]);
  }

  /**
  * Defines the dimension of the display window in units of pixels. The size() function must
  * be the first line in setup(). If size() is not called, the default size of the window is
  * 100x100 pixels. The system variables width and height are set by the parameters passed to
  * the size() function.
  *
  * @param {int} aWidth     width of the display window in units of pixels
  * @param {int} aHeight    height of the display window in units of pixels
  * @param {MODE} aMode     Either P2D, P3D, JAVA2D, or OPENGL
  *
  * @see createGraphics
  * @see screen
  */
  size(aWidth, aHeight, aMode) {
    if (this.doStroke) {
      this.curSketch.stroke(0);
    }

    if (this.doFill) {
      this.curSketch.fill(255);
    }

    let curContext = this.curContext;
    let curElement = this.curElement;
    let curTextFont= this.curTextFont;

    // The default 2d context has already been created in the p.init() stage if
    // a 3d context was not specified. This is so that a 2d context will be
    // available if size() was not called.
    let savedProperties = {
      fillStyle: curContext.fillStyle,
      strokeStyle: curContext.strokeStyle,
      lineCap: curContext.lineCap,
      lineJoin: curContext.lineJoin
    };

    // remove the style width and height properties to ensure that the canvas gets set to
    // aWidth and aHeight coming in
    if (curElement.style.length > 0 ) {
      curElement.style.removeProperty("width");
      curElement.style.removeProperty("height");
    }

    curElement.width = p.width = aWidth || 100;
    curElement.height = p.height = aHeight || 100;

    for (var prop in savedProperties) {
      if (savedProperties.hasOwnProperty(prop)) {
        curContext[prop] = savedProperties[prop];
      }
    }

    // make sure to set the default font the first time round.
    this.curSketch.textFont(curTextFont);

    // Set the background to whatever it was called last as if background() was called before size()
    // If background() hasn't been called before, set background() to a light gray
    this.curSketch.background();

    // set 5% for pixels to cache (or 1000)
    this.maxPixelsCached = Math.max(1000, aWidth * aHeight * 0.05);

//
// FIXME: TODO: do we still need this with the rewrite?
//
//    // Externalize the context
//    this.curSketch.externals.context = curContext;

    for (let i = 0; i < PConstants$1.SINCOS_LENGTH; i++) {
      this.sinLUT[i] = Math.sin(i * (MATH.PI / 180) * 0.5);
      this.cosLUT[i] = Math.cos(i * (MATH.PI / 180) * 0.5);
    }
  }

  /**
   * The fill() function sets the color used to fill shapes. For example, if you run <b>fill(204, 102, 0)</b>, all subsequent shapes will be filled with orange.
   * This color is either specified in terms of the RGB or HSB color depending on the current <b>colorMode()</b>
   *(the default color space is RGB, with each value in the range from 0 to 255).
   * <br><br>When using hexadecimal notation to specify a color, use "#" or "0x" before the values (e.g. #CCFFAA, 0xFFCCFFAA).
   * The # syntax uses six digits to specify a color (the way colors are specified in HTML and CSS). When using the hexadecimal notation starting with "0x";
   * the hexadecimal value must be specified with eight characters; the first two characters define the alpha component and the remainder the red, green, and blue components.
   * <br><br>The value for the parameter "gray" must be less than or equal to the current maximum value as specified by <b>colorMode()</b>. The default maximum value is 255.
   * <br><br>To change the color of an image (or a texture), use tint().
   *
   * @param {int|float} gray    number specifying value between white and black
   * @param {int|float} value1  red or hue value
   * @param {int|float} value2  green or saturation value
   * @param {int|float} value3  blue or brightness value
   * @param {int|float} alpha   opacity of the fill
   * @param {Color} color       any value of the color datatype
   * @param {int} hex           color value in hexadecimal notation (i.e. #FFCC00 or 0xFFFFCC00)
   *
   * @see #noFill()
   * @see #stroke()
   * @see #tint()
   * @see #background()
   * @see #colorMode()
   */
  fill() {
    let color = this.curSketch.color.apply(this, arguments);
    if(color === this.currentFillColor && this.doFill) {
      return;
    }
    this.doFill = true;
    this.currentFillColor = color;
  }

  /**
   * The stroke() function sets the color used to draw lines and borders around shapes. This color
   * is either specified in terms of the RGB or HSB color depending on the
   * current <b>colorMode()</b> (the default color space is RGB, with each
   * value in the range from 0 to 255).
   * <br><br>When using hexadecimal notation to specify a color, use "#" or
   * "0x" before the values (e.g. #CCFFAA, 0xFFCCFFAA). The # syntax uses six
   * digits to specify a color (the way colors are specified in HTML and CSS).
   * When using the hexadecimal notation starting with "0x", the hexadecimal
   * value must be specified with eight characters; the first two characters
   * define the alpha component and the remainder the red, green, and blue
   * components.
   * <br><br>The value for the parameter "gray" must be less than or equal
   * to the current maximum value as specified by <b>colorMode()</b>.
   * The default maximum value is 255.
   *
   * @param {int|float} gray    number specifying value between white and black
   * @param {int|float} value1  red or hue value
   * @param {int|float} value2  green or saturation value
   * @param {int|float} value3  blue or brightness value
   * @param {int|float} alpha   opacity of the stroke
   * @param {Color} color       any value of the color datatype
   * @param {int} hex           color value in hexadecimal notation (i.e. #FFCC00 or 0xFFFFCC00)
   *
   * @see #fill()
   * @see #noStroke()
   * @see #tint()
   * @see #background()
   * @see #colorMode()
   */
  stroke() {
    let color = this.curSketch.color.apply(this, arguments);
    if(color === this.currentStrokeColor && this.doStroke) {
      return;
    }
    this.doStroke = true;
    this.currentStrokeColor = color;
  }


  /**
   * The strokeWeight() function sets the width of the stroke used for lines, points, and the border around shapes.
   * All widths are set in units of pixels.
   *
   * @param {int|float} w the weight (in pixels) of the stroke
   */
  strokeWeight(w) {
    this.lineWidth = w;
  }

  backgroundHelper(arg1, arg2, arg3, arg4) {
    let obj = undefined;
    let p = this.curSketch;

    if (arg1 instanceof PImage || arg1.__isPImage) {
      obj = arg1;
      if (!obj.loaded) {
        throw "Error using image in background(): PImage not loaded.";
      }
      if(obj.width !== p.width || obj.height !== p.height){
        throw "Background image must be the same dimensions as the canvas.";
      }
    } else {
      obj = p.color(arg1, arg2, arg3, arg4);
    }
    this.backgroundObj = obj;
  }

  alpha(aColor) {
    return ((aColor & PConstants$1.ALPHA_MASK) >>> 24) / 255 * this.colorModeA;
  }
}

class Drawing2D extends DrawingShared {
	constructor(sketch, canvas, context) {
    super(sketch, canvas, context);
	}

  size(aWidth, aHeight, aMode) {
    if (this.curContext === undefined) {
      // size() was called without p.init() default context, i.e. p.createGraphics()
      this.curContext = curElement.getContext("2d");
//      this.userMatrixStack = new PMatrixStack();
//      this.userReverseMatrixStack = new PMatrixStack();
//      this.modelView = new PMatrix2D();
//      this.modelViewInv = new PMatrix2D();
    }

    super.size(aWidth, aHeight, aMode);
  }

  background(arg1, arg2, arg3, arg4) {
    if (arg1 !== undefined) {
      super.backgroundHelper(arg1, arg2, arg3, arg4);
    }

    let p = this.curSketch;
    let backgroundObj = this.backgroundObj;

    this.saveContext();

    if (backgroundObj instanceof PImage || backgroundObj.__isPImage) {
      this.curContext.setTransform(1, 0, 0, 1, 0, 0);
      p.image(backgroundObj, 0, 0);
    }

    else {
      this.curContext.setTransform(1, 0, 0, 1, 0, 0);
      // If the background is transparent
      if (p.alpha(backgroundObj) !== this.colorModeA) {
        this.curContext.clearRect(0,0, p.width, p.height);
      }
      this.curContext.fillStyle = p.color.toString(backgroundObj);
      this.curContext.fillRect(0, 0, p.width, p.height);
      this.isFillDirty = true;
    }
    this.restoreContext();
  }
}

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

/**
 * Returns Java equals() result for two objects. If the first object
 * has the "equals" function, it preforms the call of this function.
 * Otherwise the method uses the JavaScript === operator.
 *
 * @param {Object} obj          The first object.
 * @param {Object} other        The second object.
 *
 * @returns {boolean}           true if the objects are equal.
 */
function virtEquals$1(obj, other) {
  if (obj === null || other === null) {
    return (obj === null) && (other === null);
  }
  if (typeof (obj) === "string") {
    return obj === other;
  }
  if (typeof(obj) !== "object") {
    return obj === other;
  }
  if (obj.equals instanceof Function) {
    return obj.equals(other);
  }
  return obj === other;
}

/**
 * Returns Java hashCode() result for the object. If the object has the "hashCode" function,
 * it preforms the call of this function. Otherwise it uses/creates the "$id" property,
 * which is used as the hashCode.
 *
 * @param {Object} obj          The object.
 * @returns {int}               The object's hash code.
 */
function virtHashCode$1(obj, undef) {
  if (typeof(obj) === "string") {
    var hash = 0;
    for (var i = 0; i < obj.length; ++i) {
      hash = (hash * 31 + obj.charCodeAt(i)) & 0xFFFFFFFF;
    }
    return hash;
  }
  if (typeof(obj) !== "object") {
    return obj & 0xFFFFFFFF;
  }
  if (obj.hashCode instanceof Function) {
    return obj.hashCode();
  }
  if (obj.$id === undef) {
      obj.$id = ((Math.floor(Math.random() * 0x10000) - 0x8000) << 16) | Math.floor(Math.random() * 0x10000);
  }
  return obj.$id;
}

class Iterator {
  constructor(array) {
    this.index = -1;
    this.array = array;
  }

  hasNext() {
    return (this.index + 1) < this.array.length;
  }

  next() {
    return this.array[++this.index];
  }

  remove() {
    this.array.splice(this.index--, 1);
  }
}

class JavaBaseClass {

	// void -> String
	toString() {
		return "JavaBaseClass";
	}

	// void -> integer
	hashCode() {
		return 0;
	}

}

/**
 * An ArrayList stores a variable number of objects.
 *
 * @param {int} initialCapacity optional defines the initial capacity of the list, it's empty by default
 *
 * @returns {ArrayList} new ArrayList object
 */


class ArrayList extends JavaBaseClass {
  constructor(a) {
    super();
    this.array = [];
    if (a && a.toArray) {
      this.array = a.toArray();
    }
  }

  /**
   * @member ArrayList
   * ArrayList.get() Returns the element at the specified position in this list.
   *
   * @param {int} i index of element to return
   *
   * @returns {Object} the element at the specified position in this list.
   */
  get(i) {
    return this.array[i];
  }

  /**
   * @member ArrayList
   * ArrayList.contains() Returns true if this list contains the specified element.
   *
   * @param {Object} item element whose presence in this List is to be tested.
   *
   * @returns {boolean} true if the specified element is present; false otherwise.
   */
  contains(item) {
    return this.indexOf(item)>-1;
  }

  /**
   * @member ArrayList
   * ArrayList.indexOf() Returns the position this element takes in the list, or -1 if the element is not found.
   *
   * @param {Object} item element whose position in this List is to be tested.
   *
   * @returns {int} the list position that the first match for this element holds in the list, or -1 if it is not in the list.
   */
  indexOf(item) {
    let array = this.array;
    for (let i = 0, len = array.length; i < len; ++i) {
      if (virtEquals$1(item, array[i])) {
        return i;
      }
    }
    return -1;
  }

  /**
   * @member ArrayList
   * ArrayList.lastIndexOf() Returns the index of the last occurrence of the specified element in this list,
   * or -1 if this list does not contain the element. More formally, returns the highest index i such that
   * (o==null ? get(i)==null : o.equals(get(i))), or -1 if there is no such index.
   *
   * @param {Object} item element to search for.
   *
   * @returns {int} the index of the last occurrence of the specified element in this list, or -1 if this list does not contain the element.
   */
  lastIndexOf(item) {
    let array = this.array;
    for (let i = array.length-1; i >= 0; --i) {
      if (virtEquals$1(item, array[i])) {
        return i;
      }
    }
    return -1;
  }

  /**
   * @member ArrayList
   * ArrayList.add() Adds the specified element to this list.
   *
   * @param {int}    index  optional index at which the specified element is to be inserted
   * @param {Object} object element to be added to the list
   */
  add(index, object) {
    let array = this.array;
    // add(Object)
    if (!object) {
      object = index;
      return array.push(object);
    }
    // add(i, Object)
    if (typeof index === 'number') {
      if (index < 0) {
        throw new Error(`ArrayList.add(index,Object): index cannot be less than zero (found ${number}).`);
      }
      if (index >= array.length) {
        throw new Error("ArrayList.add(index,Object): index cannot be higher than there are list elements (found ${number} for list size ${array.length}).");
      }
      return array.splice(index, 0, arguments[1]);
    }
    throw(`ArrayList.add(index,Object): index is not a number (found type ${typeof index} instead).`);
  }

  /**
   * @member ArrayList
   * ArrayList.addAll(collection) appends all of the elements in the specified
   * Collection to the end of this list, in the order that they are returned by
   * the specified Collection's Iterator.
   *
   * When called as addAll(index, collection) the elements are inserted into
   * this list at the position indicated by index.
   *
   * @param {index} Optional; specifies the position the colletion should be inserted at
   * @param {collection} Any iterable object (ArrayList, HashMap.keySet(), etc.)
   * @throws out of bounds error for negative index, or index greater than list size.
   */
  addAll(index, collection) {
    let iterator;
    let array = this.array;
    // addAll(Collection)
    if (!collection) {
      collection = index;
      iterator = new ObjectIterator(collection);
      while (iterator.hasNext()) {
        array.push(iterator.next());
      }
      return;
    }
    // addAll(int, Collection)
    if (typeof index === "number") {
      if (index < 0) {
        throw new Error(`ArrayList.addAll(index,Object): index cannot be less than zero (found ${number}).`);
      }
      if (index >= array.length) {
        throw new Error("ArrayList.addAll(index,Object): index cannot be higher than there are list elements (found ${number} for list size ${array.length}).");
      }
      iterator = new ObjectIterator(collection);
      while (iterator.hasNext()) {
        array.splice(index++, 0, iterator.next());
      }
      return;
    }
    throw(`ArrayList.addAll(index,collection): index is not a number (found type ${typeof index} instead).`);
  }

  /**
   * @member ArrayList
   * ArrayList.set() Replaces the element at the specified position in this list with the specified element.
   *
   * @param {int}    index  index of element to replace
   * @param {Object} object element to be stored at the specified position
   */
  set(index, object) {
    let array = this.array;
    if (!object) {
      throw new Error(`ArrayList.set(index,Object): missing object argument.`);
    }
    if (typeof index === 'number') {
      if (index < 0) {
        throw new Error(`ArrayList.set(index,Object): index cannot be less than zero (found ${number}).`);
      }
      if (index >= array.length) {
        throw new Error("ArrayList.set(index,Object): index cannot be higher than there are list elements (found ${number} for list size ${array.length}).");
      }
      return array.splice(index, 1, object);
    }
    throw(`ArrayList.set(index,Object): index is not a number (found type ${typeof index} instead).`);
  }

  /**
   * @member ArrayList
   * ArrayList.size() Returns the number of elements in this list.
   *
   * @returns {int} the number of elements in this list
   */
  size() {
    return this.array.length;
  }

  /**
   * @member ArrayList
   * ArrayList.clear() Removes all of the elements from this list. The list will be empty after this call returns.
   */
  clear() {
    this.array = [];
  };

  /**
   * @member ArrayList
   * ArrayList.remove() Removes an element either based on index, if the argument is a number, or
   * by equality check, if the argument is an object.
   *
   * @param {int|Object} item either the index of the element to be removed, or the element itself.
   *
   * @returns {Object|boolean} If removal is by index, the element that was removed, or null if nothing was removed. If removal is by object, true if removal occurred, otherwise false.
   */
  remove(item) {
    if (typeof item === 'number') {
      return array.splice(item, 1)[0];
    }
    item = this.indexOf(item);
    if (item > -1) {
      array.splice(item, 1);
      return true;
    }
    return false;
  };

   /**
   * @member ArrayList
   * ArrayList.removeAll Removes from this List all of the elements from
   * the current ArrayList which are present in the passed in paramater ArrayList 'c'.
   * Shifts any succeeding elements to the left (reduces their index).
   *
   * @param {ArrayList} the ArrayList to compare to the current ArrayList
   *
   * @returns {boolean} true if the ArrayList had an element removed; false otherwise
   */
  removeAll(other) {
    let oldlist = this.array;
    this.clear();
    // For every item that exists in the original ArrayList and not in the 'other' ArrayList
    // copy it into the empty 'this' ArrayList to create the new 'this' Array.
    oldlist.forEach( (item,i) => {
      if (!other.contains(item)) {
        this.add(x++, item);
      }
    });
    return (this.size() < newList.size());
  }

  /**
   * @member ArrayList
   * ArrayList.isEmpty() Tests if this list has no elements.
   *
   * @returns {boolean} true if this list has no elements; false otherwise
   */
  isEmpty() {
    return this.array.length === 0;
  };

  /**
   * @member ArrayList
   * ArrayList.clone() Returns a shallow copy of this ArrayList instance. (The elements themselves are not copied.)
   *
   * @returns {ArrayList} a clone of this ArrayList instance
   */
  clone() {
    return new ArrayList(this);
  };

  /**
   * @member ArrayList
   * ArrayList.toArray() Returns an array containing all of the elements in this list in the correct order.
   *
   * @returns {Object[]} Returns an array containing all of the elements in this list in the correct order
   */
  toArray() {
    return this.array.slice();
  };

  /**
   * FIXME: TODO: add missing documentation
   */
  iterator() {
    return new Iterator(this.array);
  }

  /**
   * toString override
   */
  toString() {
    return `[${ this.array.map(e => e.toString()).join(',') }]`;
  }
}

class Char$1 {
  constructor(chr) {
    let type = typeof chr;
    if (type === 'string' && chr.length === 1) {
      this.code = chr.charCodeAt(0);
    } else if (type === 'number') {
      this.code = chr;
    } else if (chr instanceof Char$1) {
      this.code = chr.code;
    } else {
      this.code = NaN;
    }
  };

  toString() {
    return String.fromCharCode(this.code);
  }

  valueOf() {
    return this.code;
  }
}

class HashmapIterator {
  constructor(buckets, conversion, removeItem) {
    this.buckets = buckets;
    this.bucketIndex = 0;
    this.itemIndex = -1;
    this.endOfBuckets = false;
    this.currentItem = undefined;
    // and now start at "item one"
    this.findNext();
  }

  findNext() {
    while (!this.endOfBuckets) {
      ++this.itemIndex;
      if (this.bucketIndex >= buckets.length) {
        this.endOfBuckets = true;
      } else if (this.buckets[this.bucketIndex] === undefined || this.itemIndex >= this.buckets[this.bucketIndex].length) {
        this.itemIndex = -1;
        ++this.bucketIndex;
      } else {
        return;
      }
    }
  }

  /*
  * @member Iterator
  * Checks if the Iterator has more items
  */
  hasNext() {
    return !this.endOfBuckets;
  };

  /*
  * @member Iterator
  * Return the next Item
  */
  next() {
    this.currentItem = this.conversion(this.buckets[this.bucketIndex][this.itemIndex]);
    this.findNext();
    return currentItem;
  };

  /*
  * @member Iterator
  * Remove the current item
  */
  remove() {
    if (this.currentItem !== undefined) {
      this.removeItem(currentItem);
      --this.itemIndex;
      this.findNext();
    }
  };
}

class Set {

  /**
   * this takes three functions
   * - conversion()
   * - isIn()
   * - removeItem()
   */
  constructor(hashMap, conversion, isIn, removeItem) {
    this.hashMap = hashMap;
    this.conversion = conversion;
    this.isIn = isInt;
    this.removeItem = removeItem;
  }

  clear() {
    this.hashMap.clear();
  }

  contains(o) {
    return this.isIn(o);
  }

  containsAll(o) {
    var it = o.iterator();
    while (it.hasNext()) {
      if (!this.contains(it.next())) {
        return false;
      }
    }
    return true;
  }

  isEmpty() {
    return this.hashMap.isEmpty();
  }

  iterator() {
    return new HashmapIterator(this.hashMap.buckets, conversion, removeItem);
  }

  remove(o) {
    if (this.contains(o)) {
      this.removeItem(o);
      return true;
    }
    return false;
  }

  removeAll(c) {
    var it = c.iterator();
    var changed = false;
    while (it.hasNext()) {
      var item = it.next();
      if (this.contains(item)) {
        this.removeItem(item);
        changed = true;
      }
    }
    return true;
  }

  retainAll(c) {
    var it = this.iterator();
    var toRemove = [];
    while (it.hasNext()) {
      var entry = it.next();
      if (!c.contains(entry)) {
        toRemove.push(entry);
      }
    }
    toRemove.forEach( e => this.removeItem(e));
    return toRemove.length > 0;
  }

  size() {
    return this.hashMap.size();
  }

  toArray() {
    var result = [];
    var it = this.iterator();
    while (it.hasNext()) {
      result.push(it.next());
    }
    return result;
  };
}

class Entry {
  constructor(hashMap, pair) {
    this.hashMap = hashMap;
    this.pair = pair;
  }

  _isIn(map) {
    return map === this.hashMap && (this.pair.removed === undefined);
  }

  equals(o) {
    return virtEquals(this.pair.key, o.getKey());
  }

  getKey() {
    return this.pair.key;
  }

  getValue() {
    return this.pair.value;
  }

  hashCode(o) {
    return virtHashCode(this.pair.key);
  }

  setValue(value) {
    let pair = this.pair;
    let old = pair.value;
    pair.value = value;
    return old;
  }
}

function getBucketIndex(buckets, key) {
  let index = virtHashCode$1(key) % buckets.length;
  return index < 0 ? buckets.length + index : index;
}

function ensureLoad(buckets, loadFactor, count) {
  if (count <= loadFactor * buckets.length) {
    return;
  }
  let allEntries = [];
  buckets.forEach(bucket => {
    if (bucket) {
      allEntries = allEntries.concat(bucket);
    }
  });
  let newBucketsLength = buckets.length * 2;
  let newbuckets = [];
  newbuckets.length = newBucketsLength;
  allEntries.forEach(entry => {
    let index = getBucketIndex(buckets, allEntries[j].key);
    // FIXME: TODO: bit convoluted...?
    let bucket = newbuckets[index];
    if (bucket === undefined) {
      newbuckets[index] = bucket = [];
    }
    bucket.push(allEntries[j]);
  });
  return buckets;
}

/**
* A HashMap stores a collection of objects, each referenced by a key. This is similar to an Array, only
* instead of accessing elements with a numeric index, a String  is used. (If you are familiar with
* associative arrays from other languages, this is the same idea.)
*
* @param {int} initialCapacity          defines the initial capacity of the map, it's 16 by default
* @param {float} loadFactor             the load factor for the map, the default is 0.75
* @param {Map} m                        gives the new HashMap the same mappings as this Map
*/
class HashMap extends JavaBaseClass {

  /**
  * @member HashMap
  * A HashMap stores a collection of objects, each referenced by a key. This is similar to an Array, only
  * instead of accessing elements with a numeric index, a String  is used. (If you are familiar with
  * associative arrays from other languages, this is the same idea.)
  *
  * @param {int} initialCapacity          defines the initial capacity of the map, it's 16 by default
  * @param {float} loadFactor             the load factor for the map, the default is 0.75
  * @param {Map} m                        gives the new HashMap the same mappings as this Map
  */
  constructor(other) {
    super();
    if (other instanceof HashMap) {
      return arguments[0].clone();
    }
    this.initialCapacity = arguments.length > 0 ? arguments[0] : 16;
    this.loadFactor = arguments.length > 1 ? arguments[1] : 0.75;
    this.clear();
  }


  clear() {
    this.count = 0;
    this.buckets = [];
    this.buckets.length = this.initialCapacity;
  }

  clone() {
    let map = new HashMap();
    map.putAll(this);
    return map;
  }

  containsKey(key) {
    let buckets = this.buckets;
    let index = getBucketIndex(buckets, key);
    let bucket = buckets[index];
    if (bucket === undefined) {
      return false;
    }
    for (let i = 0; i < bucket.length; ++i) {
      if (virtEquals$1(bucket[i].key, key)) {
        return true;
      }
    }
    return false;
  }

  containsValue(value) {
    let buckets = this.buckets;
    for (let i = 0; i < buckets.length; ++i) {
      let bucket = buckets[i];
      if (bucket === undefined) {
        continue;
      }
      for (let j = 0; j < bucket.length; ++j) {
        if (virtEquals$1(bucket[j].value, value)) {
          return true;
        }
      }
    }
    return false;
  }

  entrySet() {
    let conversion = pair => new Entry(pair);
    let isIn = pair => (pair instanceof Entry) && pair._isIn(this);
    let removeItem = pair => this.remove(pair.getKey());
    return new Set(this, conversion, isIn, removeItem);
  }

  get(key) {
    let buckets = this.buckets;
    let index = getBucketIndex(buckets, key);
    let bucket = buckets[index];
    if (bucket === undefined) {
      return null;
    }
    for (let i = 0; i < bucket.length; ++i) {
      if (virtEquals$1(bucket[i].key, key)) {
        return bucket[i].value;
      }
    }
    return null;
  }

  isEmpty() {
    return this.count === 0;
  }

  keySet() {
    let conversion = pair => pair.key;
    let isIn = key => this.containsKey(key);
    let removeItem = key => this.remove(key);
    return new Set(this, conversion, isIn, removeItem);
  }

  values() {
    let conversion = pair => pair.value;
    let isIn = value => this.containsValue(value);
    let removeItem = value => this.removeByValue(value);
    return new Set(this, conversion, isIn, removeItem);
  }

  put(key, value) {
    let buckets = this.buckets;
    let index = getBucketIndex(buckets, key);
    let bucket = buckets[index];
    if (bucket === undefined) {
      ++this.count;
      buckets[index] = [{
        key: key,
        value: value
      }];
      ensureLoad(buckets, this.loadFactor, this.count);
      return null;
    }
    for (let i = 0; i < bucket.length; ++i) {
      if (virtEquals$1(bucket[i].key, key)) {
        let previous = bucket[i].value;
        bucket[i].value = value;
        return previous;
      }
    }
    ++this.count;
    bucket.push({
      key: key,
      value: value
    });
    ensureLoad(buckets, this.loadFactor, this.count);
    return null;
  }

  putAll(m) {
    let it = m.entrySet().iterator();
    while (it.hasNext()) {
      let entry = it.next();
      this.put(entry.getKey(), entry.getValue());
    }
  }

  remove(key) {
    let buckets = this.buckets;
    let index = getBucketIndex(buckets, key);
    let bucket = buckets[index];
    if (bucket === undefined) {
      return null;
    }
    for (let i = 0; i < bucket.length; ++i) {
      if (virtEquals$1(bucket[i].key, key)) {
        --this.count;
        let previous = bucket[i].value;
        bucket[i].removed = true;
        if (bucket.length > 1) {
          bucket.splice(i, 1);
        } else {
          buckets[index] = undefined;
        }
        return previous;
      }
    }
    return null;
  }

  removeByValue(value) {
    // FIXME: TODO: surely this can be done better now
    let buckets = this.buckets, bucket, i, ilen, pair;
    for (bucket in buckets) {
      if (buckets.hasOwnProperty(bucket)) {
        for (i = 0, ilen = buckets[bucket].length; i < ilen; i++) {
          pair = buckets[bucket][i];
          // removal on values is based on identity, not equality
          if (pair.value === value) {
            buckets[bucket].splice(i, 1);
            return true;
          }
        }
      }
    }
    return false;
  }

  size() {
    return this.count;
  }

  // toString override
  toString() {
    let buckets = this.buckets;
    let rset = [];
    buckets.forEach(bucket => {
      bucket.forEach(pair => {
        rset.push(pair.key + "=" + pair.value.toString());
      });
    });
    return `{${ rset.join(',') }}`;
  }
}

// Pseudo-random generator
// see http://www.math.uni-bielefeld.de/~sillke/ALGORITHMS/random/marsaglia-c
class Marsaglia$1 {
  constructor(i1, i2) {
    this.z=i1 || 362436069;
    this.w= i2 || 521288629;
  }

  intGenerator() {
    this.z=(36969*(this.z&65535)+(this.z>>>16)) & 0xFFFFFFFF;
    this.w=(18000*(this.w&65535)+(this.w>>>16)) & 0xFFFFFFFF;
    return (((this.z&0xFFFF)<<16) | (this.w&0xFFFF)) & 0xFFFFFFFF;
  }

  doubleGenerator() {
    var i = this.intGenerator() / 4294967296;
    return i < 0 ? 1 + i : i;
  }

  static createRandomized() {
    var now = new Date();
    return new Marsaglia$1((now / 60000) & 0xFFFFFFFF, now & 0xFFFFFFFF);
  }
}

// Noise functions and helpers
function PerlinNoise(seed) {
  var rnd = seed !== undef ? new Marsaglia(seed, (seed<<16)+(seed>>16)) : Marsaglia.createRandomized();
  var i, j;
  // http://www.noisemachine.com/talk1/17b.html
  // http://mrl.nyu.edu/~perlin/noise/
  // generate permutation
  var perm = new Uint8Array(512);
  for(i=0;i<256;++i) { perm[i] = i; }
  for(i=0;i<256;++i) {
    // NOTE: we can only do this because we've made sure the Marsaglia generator
    //       gives us numbers where the last byte in a pseudo-random number is
    //       still pseudo-random. If no 2nd argument is passed in the constructor,
    //       that is no longer the case and this pair swap will always run identically.
    var t = perm[j = rnd.intGenerator() & 0xFF];
    perm[j] = perm[i];
    perm[i] = t;
  }
  // copy to avoid taking mod in perm[0];
  for(i=0;i<256;++i) { perm[i + 256] = perm[i]; }

  function grad3d(i,x,y,z) {
    var h = i & 15; // convert into 12 gradient directions
    var u = h<8 ? x : y,
        v = h<4 ? y : h===12||h===14 ? x : z;
    return ((h&1) === 0 ? u : -u) + ((h&2) === 0 ? v : -v);
  }

  function grad2d(i,x,y) {
    var v = (i & 1) === 0 ? x : y;
    return (i&2) === 0 ? -v : v;
  }

  function grad1d(i,x) {
    return (i&1) === 0 ? -x : x;
  }

  function lerp(t,a,b) { return a + t * (b - a); }

  this.noise3d = function(x, y, z) {
    var X = Math.floor(x)&255, Y = Math.floor(y)&255, Z = Math.floor(z)&255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    var fx = (3-2*x)*x*x, fy = (3-2*y)*y*y, fz = (3-2*z)*z*z;
    var p0 = perm[X]+Y, p00 = perm[p0] + Z, p01 = perm[p0 + 1] + Z,
        p1 = perm[X + 1] + Y, p10 = perm[p1] + Z, p11 = perm[p1 + 1] + Z;
    return lerp(fz,
      lerp(fy, lerp(fx, grad3d(perm[p00], x, y, z), grad3d(perm[p10], x-1, y, z)),
               lerp(fx, grad3d(perm[p01], x, y-1, z), grad3d(perm[p11], x-1, y-1,z))),
      lerp(fy, lerp(fx, grad3d(perm[p00 + 1], x, y, z-1), grad3d(perm[p10 + 1], x-1, y, z-1)),
               lerp(fx, grad3d(perm[p01 + 1], x, y-1, z-1), grad3d(perm[p11 + 1], x-1, y-1,z-1))));
  };

  this.noise2d = function(x, y) {
    var X = Math.floor(x)&255, Y = Math.floor(y)&255;
    x -= Math.floor(x); y -= Math.floor(y);
    var fx = (3-2*x)*x*x, fy = (3-2*y)*y*y;
    var p0 = perm[X]+Y, p1 = perm[X + 1] + Y;
    return lerp(fy,
      lerp(fx, grad2d(perm[p0], x, y), grad2d(perm[p1], x-1, y)),
      lerp(fx, grad2d(perm[p0 + 1], x, y-1), grad2d(perm[p1 + 1], x-1, y-1)));
  };

  this.noise1d = function(x) {
    var X = Math.floor(x)&255;
    x -= Math.floor(x);
    var fx = (3-2*x)*x*x;
    return lerp(fx, grad1d(perm[X], x), grad1d(perm[X+1], x-1));
  };
}

let noiseProfile = {
  generator: undefined,
  octaves: 4,
  fallout: 0.5,
  seed: undefined
};

let internalRandomGenerator = Math.random;

class ProcessingMath {
  /**
  * Constrains a value to not exceed a maximum and minimum value.
  *
  * @param {int|float} value   the value to constrain
  * @param {int|float} value   minimum limit
  * @param {int|float} value   maximum limit
  *
  * @returns {int|float}
  *
  * @see max
  * @see min
  */
  constrain(aNumber, aMin, aMax) {
    return aNumber > aMax ? aMax : aNumber < aMin ? aMin : aNumber;
  }

  /**
  * Calculates the distance between two points.
  *
  * @param {int|float} x1     int or float: x-coordinate of the first point
  * @param {int|float} y1     int or float: y-coordinate of the first point
  * @param {int|float} z1     int or float: z-coordinate of the first point
  * @param {int|float} x2     int or float: x-coordinate of the second point
  * @param {int|float} y2     int or float: y-coordinate of the second point
  * @param {int|float} z2     int or float: z-coordinate of the second point
  *
  * @returns {float}
  */
  dist() {
    var dx, dy, dz;
    if (arguments.length === 4) {
      dx = arguments[0] - arguments[2];
      dy = arguments[1] - arguments[3];
      return Math.sqrt(dx * dx + dy * dy);
    }
    if (arguments.length === 6) {
      dx = arguments[0] - arguments[3];
      dy = arguments[1] - arguments[4];
      dz = arguments[2] - arguments[5];
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }

  /**
  * Calculates a number between two numbers at a specific increment. The amt  parameter is the
  * amount to interpolate between the two values where 0.0 equal to the first point, 0.1 is very
  * near the first point, 0.5 is half-way in between, etc. The lerp function is convenient for
  * creating motion along a straight path and for drawing dotted lines.
  *
  * @param {int|float} value1       float or int: first value
  * @param {int|float} value2       float or int: second value
  * @param {int|float} amt          float: between 0.0 and 1.0
  *
  * @returns {float}
  *
  * @see curvePoint
  * @see bezierPoint
  */
  lerp(value1, value2, amt) {
    return ((value2 - value1) * amt) + value1;
  }

  /**
  * Calculates the magnitude (or length) of a vector. A vector is a direction in space commonly
  * used in computer graphics and linear algebra. Because it has no "start" position, the magnitude
  * of a vector can be thought of as the distance from coordinate (0,0) to its (x,y) value.
  * Therefore, mag() is a shortcut for writing "dist(0, 0, x, y)".
  *
  * @param {int|float} a       float or int: first value
  * @param {int|float} b       float or int: second value
  * @param {int|float} c       float or int: third value
  *
  * @returns {float}
  *
  * @see dist
  */
  mag(a, b, c) {
    if (c) {
      return Math.sqrt(a * a + b * b + c * c);
    }

    return Math.sqrt(a * a + b * b);
  }

  /**
  * Re-maps a number from one range to another. In the example above, the number '25' is converted from
  * a value in the range 0..100 into a value that ranges from the left edge (0) to the right edge (width) of the screen.
  * Numbers outside the range are not clamped to 0 and 1, because out-of-range values are often intentional and useful.
  *
  * @param {float} value        The incoming value to be converted
  * @param {float} istart       Lower bound of the value's current range
  * @param {float} istop        Upper bound of the value's current range
  * @param {float} ostart       Lower bound of the value's target range
  * @param {float} ostop        Upper bound of the value's target range
  *
  * @returns {float}
  *
  * @see norm
  * @see lerp
  */
  map(value, istart, istop, ostart, ostop) {
    return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
  }

  /**
  * Determines the largest value in a sequence of numbers.
  *
  * @param {int|float} value1         int or float
  * @param {int|float} value2         int or float
  * @param {int|float} value3         int or float
  * @param {int|float} array          int or float array
  *
  * @returns {int|float}
  *
  * @see min
  */
  max() {
    if (arguments.length === 2) {
      return arguments[0] < arguments[1] ? arguments[1] : arguments[0];
    }
    var numbers = arguments.length === 1 ? arguments[0] : arguments; // if single argument, array is used
    if (! ("length" in numbers && numbers.length > 0)) {
      throw "Non-empty array is expected";
    }
    var max = numbers[0],
      count = numbers.length;
    for (var i = 1; i < count; ++i) {
      if (max < numbers[i]) {
        max = numbers[i];
      }
    }
    return max;
  }

  /**
  * Determines the smallest value in a sequence of numbers.
  *
  * @param {int|float} value1         int or float
  * @param {int|float} value2         int or float
  * @param {int|float} value3         int or float
  * @param {int|float} array          int or float array
  *
  * @returns {int|float}
  *
  * @see max
  */
  min() {
    if (arguments.length === 2) {
      return arguments[0] < arguments[1] ? arguments[0] : arguments[1];
    }
    var numbers = arguments.length === 1 ? arguments[0] : arguments; // if single argument, array is used
    if (! ("length" in numbers && numbers.length > 0)) {
      throw "Non-empty array is expected";
    }
    var min = numbers[0],
      count = numbers.length;
    for (var i = 1; i < count; ++i) {
      if (min > numbers[i]) {
        min = numbers[i];
      }
    }
    return min;
  }

  /**
  * Normalizes a number from another range into a value between 0 and 1.
  * Identical to map(value, low, high, 0, 1);
  * Numbers outside the range are not clamped to 0 and 1, because out-of-range
  * values are often intentional and useful.
  *
  * @param {float} aNumber    The incoming value to be converted
  * @param {float} low        Lower bound of the value's current range
  * @param {float} high       Upper bound of the value's current range
  *
  * @returns {float}
  *
  * @see map
  * @see lerp
  */
  norm(aNumber, low, high) {
    return (aNumber - low) / (high - low);
  }

  /**
  * Squares a number (multiplies a number by itself). The result is always a positive number,
  * as multiplying two negative numbers always yields a positive result. For example, -1 * -1 = 1.
  *
  * @param {float} value        int or float
  *
  * @returns {float}
  *
  * @see sqrt
  */
  sq(aNumber) {
    return aNumber * aNumber;
  }

  /**
  * Converts a radian measurement to its corresponding value in degrees. Radians and degrees are two ways of
  * measuring the same thing. There are 360 degrees in a circle and 2*PI radians in a circle. For example,
  * 90 degrees = PI/2 = 1.5707964. All trigonometric methods in Processing require their parameters to be specified in radians.
  *
  * @param {int|float} value        an angle in radians
  *
  * @returns {float}
  *
  * @see radians
  */
  degrees(aAngle) {
    return (aAngle * 180) / Math.PI;
  }

  /**
  * Generates random numbers. Each time the random() function is called, it returns an unexpected value within
  * the specified range. If one parameter is passed to the function it will return a float between zero and the
  * value of the high parameter. The function call random(5) returns values between 0 and 5 (starting at zero,
  * up to but not including 5). If two parameters are passed, it will return a float with a value between the
  * parameters. The function call random(-5, 10.2) returns values starting at -5 up to (but not including) 10.2.
  * To convert a floating-point random number to an integer, use the int() function.
  *
  * @param {int|float} value1         if one parameter is used, the top end to random from, if two params the low end
  * @param {int|float} value2         the top end of the random range
  *
  * @returns {float}
  *
  * @see randomSeed
  * @see noise
  */
  random(aMin, aMax) {
    if (arguments.length === 0) {
      aMax = 1;
      aMin = 0;
    } else if (arguments.length === 1) {
      aMax = aMin;
      aMin = 0;
    }
    if (aMin === aMax) {
      return aMin;
    }
    for (var i = 0; i < 100; i++) {
      var ir = internalRandomGenerator();
      var result = ir * (aMax - aMin) + aMin;
      if (result !== aMax) {
        return result;
      }
      // assertion: ir is never less than 0.5
    }
    return aMin;
  }

  /**
  * Sets the seed value for random(). By default, random() produces different results each time the
  * program is run. Set the value parameter to a constant to return the same pseudo-random numbers
  * each time the software is run.
  *
  * @param {int|float} seed         int
  *
  * @see random
  * @see noise
  * @see noiseSeed
  */
  randomSeed(seed) {
    internalRandomGenerator = (new Marsaglia$1(seed, (seed<<16)+(seed>>16))).doubleGenerator;
    this.haveNextNextGaussian = false;
  }

  /**
  * Returns a float from a random series of numbers having a mean of 0 and standard deviation of 1. Each time
  * the randomGaussian() function is called, it returns a number fitting a Gaussian, or normal, distribution.
  * There is theoretically no minimum or maximum value that randomGaussian() might return. Rather, there is just a
  * very low probability that values far from the mean will be returned; and a higher probability that numbers
  * near the mean will be returned.
  *
  * @returns {float}
  *
  * @see random
  * @see noise
  */
  randomGaussian() {
    if (this.haveNextNextGaussian) {
      this.haveNextNextGaussian = false;
      return this.nextNextGaussian;
    }
    var v1, v2, s;
    do {
      v1 = 2 * internalRandomGenerator() - 1; // between -1.0 and 1.0
      v2 = 2 * internalRandomGenerator() - 1; // between -1.0 and 1.0
      s = v1 * v1 + v2 * v2;
    }
    while (s >= 1 || s === 0);

    var multiplier = Math.sqrt(-2 * Math.log(s) / s);
    this.nextNextGaussian = v2 * multiplier;
    this.haveNextNextGaussian = true;

    return v1 * multiplier;
  }

  /**
  * Returns the Perlin noise value at specified coordinates. Perlin noise is a random sequence
  * generator producing a more natural ordered, harmonic succession of numbers compared to the
  * standard random() function. It was invented by Ken Perlin in the 1980s and been used since
  * in graphical applications to produce procedural textures, natural motion, shapes, terrains etc.
  * The main difference to the random() function is that Perlin noise is defined in an infinite
  * n-dimensional space where each pair of coordinates corresponds to a fixed semi-random value
  * (fixed only for the lifespan of the program). The resulting value will always be between 0.0
  * and 1.0. Processing can compute 1D, 2D and 3D noise, depending on the number of coordinates
  * given. The noise value can be animated by moving through the noise space as demonstrated in
  * the example above. The 2nd and 3rd dimension can also be interpreted as time.
  * The actual noise is structured similar to an audio signal, in respect to the function's use
  * of frequencies. Similar to the concept of harmonics in physics, perlin noise is computed over
  * several octaves which are added together for the final result.
  * Another way to adjust the character of the resulting sequence is the scale of the input
  * coordinates. As the function works within an infinite space the value of the coordinates
  * doesn't matter as such, only the distance between successive coordinates does (eg. when using
  * noise() within a loop). As a general rule the smaller the difference between coordinates, the
  * smoother the resulting noise sequence will be. Steps of 0.005-0.03 work best for most applications,
  * but this will differ depending on use.
  *
  * @param {float} x          x coordinate in noise space
  * @param {float} y          y coordinate in noise space
  * @param {float} z          z coordinate in noise space
  *
  * @returns {float}
  *
  * @see random
  * @see noiseDetail
  */
  noise(x, y, z) {
    if(noiseProfile.generator === undef) {
      // caching
      noiseProfile.generator = new PerlinNoise(noiseProfile.seed);
    }
    var generator = noiseProfile.generator;
    var effect = 1, k = 1, sum = 0;
    for(var i=0; i<noiseProfile.octaves; ++i) {
      effect *= noiseProfile.fallout;
      switch (arguments.length) {
      case 1:
        sum += effect * (1 + generator.noise1d(k*x))/2; break;
      case 2:
        sum += effect * (1 + generator.noise2d(k*x, k*y))/2; break;
      case 3:
        sum += effect * (1 + generator.noise3d(k*x, k*y, k*z))/2; break;
      }
      k *= 2;
    }
    return sum;
  }

  /**
  * Adjusts the character and level of detail produced by the Perlin noise function.
  * Similar to harmonics in physics, noise is computed over several octaves. Lower octaves
  * contribute more to the output signal and as such define the overal intensity of the noise,
  * whereas higher octaves create finer grained details in the noise sequence. By default,
  * noise is computed over 4 octaves with each octave contributing exactly half than its
  * predecessor, starting at 50% strength for the 1st octave. This falloff amount can be
  * changed by adding an additional function parameter. Eg. a falloff factor of 0.75 means
  * each octave will now have 75% impact (25% less) of the previous lower octave. Any value
  * between 0.0 and 1.0 is valid, however note that values greater than 0.5 might result in
  * greater than 1.0 values returned by noise(). By changing these parameters, the signal
  * created by the noise() function can be adapted to fit very specific needs and characteristics.
  *
  * @param {int} octaves          number of octaves to be used by the noise() function
  * @param {float} falloff        falloff factor for each octave
  *
  * @see noise
  */
  noiseDetail(octaves, fallout) {
    noiseProfile.octaves = octaves;
    if(fallout !== undef) {
      noiseProfile.fallout = fallout;
    }
  }

  /**
  * Sets the seed value for noise(). By default, noise() produces different results each
  * time the program is run. Set the value parameter to a constant to return the same
  * pseudo-random numbers each time the software is run.
  *
  * @param {int} seed         int
  *
  * @returns {float}
  *
  * @see random
  * @see radomSeed
  * @see noise
  * @see noiseDetail
  */
  noiseSeed(seed) {
    noiseProfile.seed = seed;
    noiseProfile.generator = undef;
  }
}

let undef$1 = undefined;

function removeFirstArgument(args) {
	return Array.from(args).slice(1);
}

/**
 * This represents a static class of functions that perform the
 * role of basic Java functions, but renamed to not conflict
 * (in normal code) with function in a user's sketch.
 *
 * When the parser encounters the normal function, in a scope
 * that does not have an explicit function by that name in its
 * lookup table, it will rewrite the call to one of these static
 * underscored functions, so that the code does what the user expects.
 */
class JavaProxies {

  /**
   * The contains(string) function returns true if the string passed in the parameter
   * is a substring of this string. It returns false if the string passed
   * in the parameter is not a substring of this string.
   *
   * @param {String} The string to look for in the current string
   *
   * @return {boolean} returns true if this string contains
   * the string passed as parameter. returns false, otherwise.
   *
   */
  static __contains(subject, subStr) {
    if (typeof subject !== "string") {
      return subject.contains.apply(subject, removeFirstArgument(arguments));
    }
    //Parameter is not null AND
    //The type of the parameter is the same as this object (string)
    //The javascript function that finds a substring returns 0 or higher
    return (
      (subject !== null) &&
      (subStr !== null) &&
      (typeof subStr === "string") &&
      (subject.indexOf(subStr) > -1)
    );
  }

  /**
   * The __replaceAll() function searches all matches between a substring (or regular expression) and a string,
   * and replaces the matched substring with a new substring
   *
   * @param {String} subject    a substring
   * @param {String} regex      a substring or a regular expression
   * @param {String} replace    the string to replace the found value
   *
   * @return {String} returns result
   *
   * @see #match
   */
  static __replaceAll(subject, regex, replacement) {
    if (typeof subject !== "string") {
      return subject.replaceAll.apply(subject, removeFirstArgument(arguments));
    }

    return subject.replace(new RegExp(regex, "g"), replacement);
  }

  /**
   * The __replaceFirst() function searches first matche between a substring (or regular expression) and a string,
   * and replaces the matched substring with a new substring
   *
   * @param {String} subject    a substring
   * @param {String} regex      a substring or a regular expression
   * @param {String} replace    the string to replace the found value
   *
   * @return {String} returns result
   *
   * @see #match
   */
  static __replaceFirst(subject, regex, replacement) {
    if (typeof subject !== "string") {
      return subject.replaceFirst.apply(subject, removeFirstArgument(arguments));
    }

    return subject.replace(new RegExp(regex, ""), replacement);
  }

  /**
   * The __replace() function searches all matches between a substring and a string,
   * and replaces the matched substring with a new substring
   *
   * @param {String} subject         a substring
   * @param {String} what         a substring to find
   * @param {String} replacement    the string to replace the found value
   *
   * @return {String} returns result
   */
  static __replace(subject, what, replacement) {
    if (typeof subject !== "string") {
      return subject.replace.apply(subject, removeFirstArgument(arguments));
    }
    if (what instanceof RegExp) {
      return subject.replace(what, replacement);
    }

    if (typeof what !== "string") {
      what = what.toString();
    }
    if (what === "") {
      return subject;
    }

    var i = subject.indexOf(what);
    if (i < 0) {
      return subject;
    }

    var j = 0, result = "";
    do {
      result += subject.substring(j, i) + replacement;
      j = i + what.length;
    } while ( (i = subject.indexOf(what, j)) >= 0);
    return result + subject.substring(j);
  }

  /**
   * The __equals() function compares two strings (or objects) to see if they are the same.
   * This method is necessary because it's not possible to compare strings using the equality operator (==).
   * Returns true if the strings are the same and false if they are not.
   *
   * @param {String} subject  a string used for comparison
   * @param {String} other  a string used for comparison with
   *
   * @return {boolean} true is the strings are the same false otherwise
   */
  static __equals(subject, other) {
    if (subject.equals instanceof Function) {
      return subject.equals.apply(subject, removeFirstArgument(arguments));
    }

    return virtEquals$1(subject, other);
  }

  /**
   * The __equalsIgnoreCase() function compares two strings to see if they are the same.
   * Returns true if the strings are the same, either when forced to all lower case or
   * all upper case.
   *
   * @param {String} subject  a string used for comparison
   * @param {String} other  a string used for comparison with
   *
   * @return {boolean} true is the strings are the same, ignoring case. false otherwise
   */
  static __equalsIgnoreCase(subject, other) {
    if (typeof subject !== "string") {
      return subject.equalsIgnoreCase.apply(subject, removeFirstArgument(arguments));
    }

    return subject.toLowerCase() === other.toLowerCase();
  }

  /**
   * The __toCharArray() function splits the string into a char array.
   *
   * @param {String} subject The string
   *
   * @return {Char[]} a char array
   */
  static __toCharArray(subject) {
    if (typeof subject !== "string") {
      return subject.toCharArray.apply(subject, removeFirstArgument(arguments));
    }

    var chars = [];
    for (var i = 0, len = subject.length; i < len; ++i) {
      chars[i] = new Char(subject.charAt(i));
    }
    return chars;
  }

  /**
   * The __split() function splits a string using the regex delimiter
   * specified. If limit is specified, the resultant array will have number
   * of elements equal to or less than the limit.
   *
   * @param {String} subject string to be split
   * @param {String} regexp  regex string used to split the subject
   * @param {int}    limit   max number of tokens to be returned
   *
   * @return {String[]} an array of tokens from the split string
   */
  static __split(subject, regex, limit) {
    if (typeof subject !== "string") {
      return subject.split.apply(subject, removeFirstArgument(arguments));
    }

    var pattern = new RegExp(regex);

    // If limit is not specified, use JavaScript's built-in String.split.
    if ((limit === undef$1) || (limit < 1)) {
      return subject.split(pattern);
    }

    // If limit is specified, JavaScript's built-in String.split has a
    // different behaviour than Java's. A Java-compatible implementation is
    // provided here.
    var result = [], currSubject = subject, pos;
    while (((pos = currSubject.search(pattern)) !== -1) && (result.length < (limit - 1))) {
      var match = pattern.exec(currSubject).toString();
      result.push(currSubject.substring(0, pos));
      currSubject = currSubject.substring(pos + match.length);
    }
    if ((pos !== -1) || (currSubject !== "")) {
      result.push(currSubject);
    }
    return result;
  }

  /**
   * The codePointAt() function returns the unicode value of the character at a given index of a string.
   *
   * @param  {int} idx         the index of the character
   *
   * @return {String} code     the String containing the unicode value of the character
   */
  static __codePointAt(subject, idx) {
    var code = subject.charCodeAt(idx),
        hi,
        low;
    if (0xD800 <= code && code <= 0xDBFF) {
      hi = code;
      low = subject.charCodeAt(idx + 1);
      return ((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
    }
    return code;
  }

  /**
   * The matches() function checks whether or not a string matches a given regular expression.
   *
   * @param {String} str      the String on which the match is tested
   * @param {String} regexp   the regexp for which a match is tested
   *
   * @return {boolean} true if the string fits the regexp, false otherwise
   */
  static __matches(str, regexp) {
    return (new RegExp(regexp)).test(str);
  }

  /**
   * The startsWith() function tests if a string starts with the specified prefix.  If the prefix
   * is the empty String or equal to the subject String, startsWith() will also return true.
   *
   * @param {String} prefix   the String used to compare against the start of the subject String.
   * @param {int}    toffset  (optional) an offset into the subject String where searching should begin.
   *
   * @return {boolean} true if the subject String starts with the prefix.
   */
  static __startsWith(subject, prefix, toffset) {
    if (typeof subject !== "string") {
      return subject.startsWith.apply(subject, removeFirstArgument(arguments));
    }

    toffset = toffset || 0;
    if (toffset < 0 || toffset > subject.length) {
      return false;
    }
    return (prefix === '' || prefix === subject) ? true : (subject.indexOf(prefix) === toffset);
  }

  /**
   * The endsWith() function tests if a string ends with the specified suffix.  If the suffix
   * is the empty String, endsWith() will also return true.
   *
   * @param {String} suffix   the String used to compare against the end of the subject String.
   *
   * @return {boolean} true if the subject String starts with the prefix.
   */
  static __endsWith(subject, suffix) {
    if (typeof subject !== "string") {
      return subject.endsWith.apply(subject, removeFirstArgument(arguments));
    }

    var suffixLen = suffix ? suffix.length : 0;
    return (suffix === '' || suffix === subject) ? true :
      (subject.indexOf(suffix) === subject.length - suffixLen);
  }

  /**
   * The returns hash code of the.
   *
   * @param {Object} subject The string
   *
   * @return {int} a hash code
   */
  static __hashCode(subject) {
    if (subject.hashCode instanceof Function) {
      return subject.hashCode.apply(subject, removeFirstArgument(arguments));
    }
    return virtHashCode$1(subject);
  }

  /**
   * The __printStackTrace() prints stack trace to the console.
   *
   * @param {Exception} subject The error
   */
  static __printStackTrace(subject) {
    console.error("Exception: " + subject.toString());
  }
}

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
function generateDefaultScope(additionalScopes) {

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
    PConstants$1,
    BaseValues,
    Math,
    ProcessingMath,

    // Java constants and independent functions:
    JavaProxies,

    // Processing objects:
    {
      ArrayList,
      Char: Char$1,
      Character: Char$1,
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
      defaultScope[prop] = scopes[prop];
    });
  }

  // FIXME: TODO: testing size() calls
  defaultScope.__setup_drawing_context = function(canvas, context) {
    let dContext = new Drawing2D(defaultScope, canvas, context);
    defaultScope.context = dContext;
  };


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
}

var version = "0.0.0";

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
      let name$$1 = subject.name;
      if(localNames.hasOwnProperty(name$$1)) {
        return name$$1;
      }
      if(globalNames.hasOwnProperty(name$$1) ||
         PConstants$1.hasOwnProperty(name$$1) ||
         this.defaultScope.hasOwnProperty(name$$1)) {
        return "$p." + name$$1;
      }
      return name$$1;
    };
  }

  toString(additionalScopes) {
    additionalScopes = additionalScopes || {};
    this.defaultScope = generateDefaultScope(additionalScopes);

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

    classes = contextMappedString(classes, replaceContext, '');
    otherStatements = contextMappedString(otherStatements, replaceContext, '');

    let result = [
     `// this code was autogenerated by ProcessingJS-ES7 version ${version}`
    ,`(function(PJS) {`
    ,`  let $p = PJS.generateDefaultScope();`
    ,`  $p.id = {{ SKETCH_ID_PLACEHOLDER }};`
    ,`  ${ classes }`
    ,`  ${ otherStatements }`
    ,`  PJS.onSketchLoad($p);`
    ,`  window.sketch = $p;`
    ,`}(Processing));`].join('\n');

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
function transformMain(code, scope) {
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
  if (!dm || dm.length !== 2) {
    return aCode;
  }

  // masks contents of a JSON to be replaced later
  // to protect the contents from further parsing
  let jsonItems = [],
      directives = dm.splice(1, 2)[0].replace(/\{([\s\S]*?)\}/g, (function() {
        return function(all, item) {
          jsonItems.push(item);
          return "{" + (jsonItems.length-1) + "}";
        };
      }())).replace('\n', '').replace('\r', '').split(";");
  directives.forEach(pair => {
    pair = pair.split('=');
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
      }

      else if (key === "font") {
        list = value.split(",");
        list.forEach(item => {
          let fontName = clean(item),
              index = /^\{(\d*?)\}$/.exec(fontName);
          // if index is not null, send JSON, otherwise, send string
          PFont.preloading.add(index ? JSON.parse("{" + jsonItems[index[1]] + "}") : fontName);
        });
      }

      else if (key === "pauseOnBlur") {
        sketch.options.pauseOnBlur = value === "true";
      }

      else if (key === "globalKeyEvents") {
        sketch.options.globalKeyEvents = value === "true";
      }

      else if (key.substring(0, 6) === "param-") {
        sketch.params[key.substring(6)] = value;
      }

      else { sketch.options[key] = value; }
    }
  });

  return aCode;
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

function colorBindings(p, hooks) {
  function color$4(aValue1, aValue2, aValue3, aValue4) {
    let r, g, b, a;
    let context = p.context;


    if (context.curColorMode === PConstants$1.HSB) {
      var rgb = p.color.toRGB(aValue1, aValue2, aValue3);
      r = rgb[0];
      g = rgb[1];
      b = rgb[2];
    } else {
      r = Math.round(255 * (aValue1 / context.colorModeX));
      g = Math.round(255 * (aValue2 / context.colorModeY));
      b = Math.round(255 * (aValue3 / context.colorModeZ));
    }

    a = Math.round(255 * (aValue4 / context.colorModeA));

    // Limit values less than 0 and greater than 255
    r = (r < 0) ? 0 : r;
    g = (g < 0) ? 0 : g;
    b = (b < 0) ? 0 : b;
    a = (a < 0) ? 0 : a;
    r = (r > 255) ? 255 : r;
    g = (g > 255) ? 255 : g;
    b = (b > 255) ? 255 : b;
    a = (a > 255) ? 255 : a;

    // Create color int
    return (a << 24) & PConstants$1.ALPHA_MASK | (r << 16) & PConstants$1.RED_MASK | (g << 8) & PConstants$1.GREEN_MASK | b & PConstants$1.BLUE_MASK;
  }

  function color$2(aValue1, aValue2) {
    let a;
    let context = p.context;

    // Color int and alpha
    if (aValue1 & PConstants$1.ALPHA_MASK) {
      a = Math.round(255 * (aValue2 / context.colorModeA));
      // Limit values less than 0 and greater than 255
      a = (a > 255) ? 255 : a;
      a = (a < 0) ? 0 : a;

      return aValue1 - (aValue1 & PConstants$1.ALPHA_MASK) + ((a << 24) & PConstants$1.ALPHA_MASK);
    }
    // Grayscale and alpha
    if (context.curColorMode === PConstants$1.RGB) {
      return color$4(aValue1, aValue1, aValue1, aValue2);
    }
    if (context.curColorMode === PConstants$1.HSB) {
      return color$4(0, 0, (aValue1 / context.colorModeX) * context.colorModeZ, aValue2);
    }
  }

  function color$1(aValue1) {
    let context = p.context;

    // Grayscale
    if (aValue1 <= context.colorModeX && aValue1 >= 0) {
        if (context.curColorMode === PConstants$1.RGB) {
          return color$4(aValue1, aValue1, aValue1, context.colorModeA);
        }
        if (curColorMode === PConstants$1.HSB) {
          return color$4(0, 0, (aValue1 / context.colorModeX) * context.colorModeZ, context.colorModeA);
        }
    }
    // Color int
    if (aValue1) {
      if (aValue1 > 2147483647) {
        // Java Overflow
        aValue1 -= 4294967296;
      }
      return aValue1;
    }
  }

  /**
  * Creates colors for storing in variables of the color datatype. The parameters are
  * interpreted as RGB or HSB values depending on the current colorMode(). The default
  * mode is RGB values from 0 to 255 and therefore, the function call color(255, 204, 0)
  * will return a bright yellow color. More about how colors are stored can be found in
  * the reference for the color datatype.
  *
  * @param {int|float} aValue1        red or hue or grey values relative to the current color range.
  * Also can be color value in hexadecimal notation (i.e. #FFCC00 or 0xFFFFCC00)
  * @param {int|float} aValue2        green or saturation values relative to the current color range
  * @param {int|float} aValue3        blue or brightness values relative to the current color range
  * @param {int|float} aValue4        relative to current color range. Represents alpha
  *
  * @returns {color} the color
  *
  * @see colorMode
  */
  let color = function(aValue1, aValue2, aValue3, aValue4) {
    let context = p.context;

    // 4 arguments: (R, G, B, A) or (H, S, B, A)
    if (aValue1 !== undefined && aValue2 !== undefined && aValue3 !== undefined && aValue4 !== undefined) {
      return color$4(aValue1, aValue2, aValue3, aValue4);
    }

    // 3 arguments: (R, G, B) or (H, S, B)
    if (aValue1 !== undefined && aValue2 !== undefined && aValue3 !== undefined) {
      return color$4(aValue1, aValue2, aValue3, context.colorModeA);
    }

    // 2 arguments: (Color, A) or (Grayscale, A)
    if (aValue1 !== undefined && aValue2 !== undefined) {
      return color$2(aValue1, aValue2);
    }

    // 1 argument: (Grayscale) or (Color)
    if (typeof aValue1 === "number") {
      return color$1(aValue1);
    }

    // Default
    return color$4(context.colorModeX, context.colorModeY, context.colorModeZ, context.colorModeA);
  };

  // Ease of use function to extract the colour bits into a string
  color.toString = function(colorInt) {
    return "rgba(" + ((colorInt & PConstants$1.RED_MASK) >>> 16) + "," + ((colorInt & PConstants$1.GREEN_MASK) >>> 8) +
           "," + ((colorInt & PConstants$1.BLUE_MASK)) + "," + ((colorInt & PConstants$1.ALPHA_MASK) >>> 24) / 255 + ")";
  };

  // Easy of use function to pack rgba values into a single bit-shifted color int.
  color.toInt = function(r, g, b, a) {
    return (a << 24) & PConstants$1.ALPHA_MASK | (r << 16) & PConstants$1.RED_MASK | (g << 8) & PConstants$1.GREEN_MASK | b & PConstants$1.BLUE_MASK;
  };

  // Creates a simple array in [R, G, B, A] format, [255, 255, 255, 255]
  color.toArray = function(colorInt) {
    return [(colorInt & PConstants$1.RED_MASK) >>> 16, (colorInt & PConstants$1.GREEN_MASK) >>> 8,
            colorInt & PConstants$1.BLUE_MASK, (colorInt & PConstants$1.ALPHA_MASK) >>> 24];
  };

  // Creates a WebGL color array in [R, G, B, A] format. WebGL wants the color ranges between 0 and 1, [1, 1, 1, 1]
  color.toGLArray = function(colorInt) {
    return [((colorInt & PConstants$1.RED_MASK) >>> 16) / 255, ((colorInt & PConstants$1.GREEN_MASK) >>> 8) / 255,
            (colorInt & PConstants$1.BLUE_MASK) / 255, ((colorInt & PConstants$1.ALPHA_MASK) >>> 24) / 255];
  };

  // HSB conversion function from Mootools, MIT Licensed
  color.toRGB = function(h, s, b) {
    // Limit values greater than range
    h = (h > colorModeX) ? colorModeX : h;
    s = (s > colorModeY) ? colorModeY : s;
    b = (b > colorModeZ) ? colorModeZ : b;

    h = (h / colorModeX) * 360;
    s = (s / colorModeY) * 100;
    b = (b / colorModeZ) * 100;

    var br = Math.round(b / 100 * 255);

    if (s === 0) { // Grayscale
      return [br, br, br];
    }
    var hue = h % 360;
    var f = hue % 60;
    var p = Math.round((b * (100 - s)) / 10000 * 255);
    var q = Math.round((b * (6000 - s * f)) / 600000 * 255);
    var t = Math.round((b * (6000 - s * (60 - f))) / 600000 * 255);
    switch (Math.floor(hue / 60)) {
    case 0:
      return [br, t, p];
    case 1:
      return [q, br, p];
    case 2:
      return [p, br, t];
    case 3:
      return [p, q, br];
    case 4:
      return [t, p, br];
    case 5:
      return [br, p, q];
    }
  };

  p.color = color;
}

/**
 * This function takes a sketch and gives it all its "play"
 * bindings. This is done using a wrapper function because there
 * are several shared variables that these Processing calls use
 * that we do not want to expose through the sketch itself, and
 * so do NOT want added wholesale to the DefaultScope object.
 */
function playBindings(p, hooks) {
  let timeSinceLastFPS = 0,
      framesSinceLastFPS = 0,
      doLoop = true,
      loopStarted = false,
      looping = false,
      curFrameRate = 60,
      curMsPerFrame = 1000 / curFrameRate;

  /**
  * Executes the code within draw() one time. This functions allows the program to update
  * the display window only when necessary, for example when an event registered by
  * mousePressed() or keyPressed() occurs.
  * In structuring a program, it only makes sense to call redraw() within events such as
  * mousePressed(). This is because redraw() does not run draw() immediately (it only sets
  * a flag that indicates an update is needed).
  * Calling redraw() within draw() has no effect because draw() is continuously called anyway.
  *
  * @returns none
  *
  * @see noLoop
  * @see loop
  */
  function redrawHelper() {
    let sec = (Date.now() - timeSinceLastFPS) / 1000;
    framesSinceLastFPS++;
    let fps = framesSinceLastFPS / sec;
    // recalculate FPS every half second for better accuracy.
    if (sec > 0.5) {
      timeSinceLastFPS = Date.now();
      framesSinceLastFPS = 0;
      // mask the framerate as __frameRate, because of p.frameRate()
      p.__frameRate = fps;
    }
    p.frameCount++;
  }

  /**
  * Stops Processing from continuously executing the code within draw(). If loop() is
  * called, the code in draw() begin to run continuously again. If using noLoop() in
  * setup(), it should be the last line inside the block.
  * When noLoop() is used, it's not possible to manipulate or access the screen inside event
  * handling functions such as mousePressed() or keyPressed(). Instead, use those functions
  * to call redraw() or loop(), which will run draw(), which can update the screen properly.
  * This means that when noLoop() has been called, no drawing can happen, and functions like
  * saveFrame() or loadPixels() may not be used.
  * Note that if the sketch is resized, redraw() will be called to update the sketch, even
  * after noLoop() has been specified. Otherwise, the sketch would enter an odd state until
  * loop() was called.
  *
  * @returns none
  *
  * @see redraw
  * @see draw
  * @see loop
  */
  p.noLoop = function() {
    doLoop = false;
    loopStarted = false;
    clearInterval(looping);
    hooks.onPause();
  };

  /**
  * Causes Processing to continuously execute the code within draw(). If noLoop() is called,
  * the code in draw() stops executing.
  *
  * @returns none
  *
  * @see noLoop
  */
  p.loop = function() {
    if (loopStarted) {
      return;
    }

    timeSinceLastFPS = Date.now();
    framesSinceLastFPS = 0;

    looping = window.setInterval(function() {
      try {
        hooks.onFrameStart();
        p.redraw();
        hooks.onFrameEnd();
      } catch(e_loop) {
        window.clearInterval(looping);
        throw e_loop;
      }
    }, curMsPerFrame);
    doLoop = true;
    loopStarted = true;
    hooks.onLoop();
  };

  /**
  * Specifies the number of frames to be displayed every second. If the processor is not
  * fast enough to maintain the specified rate, it will not be achieved. For example, the
  * function call frameRate(30) will attempt to refresh 30 times a second. It is recommended
  * to set the frame rate within setup(). The default rate is 60 frames per second.
  *
  * @param {int} aRate        number of frames per second.
  *
  * @returns none
  *
  * @see delay
  */
  p.frameRate = function(aRate) {
    curFrameRate = aRate;
    curMsPerFrame = 1000 / curFrameRate;

    // clear and reset interval
    if (doLoop) {
      p.noLoop();
      p.loop();
    }
  };

  p.redraw = function() {
    redrawHelper();

    // curContext.lineWidth = lineWidth;
    // var pmouseXLastEvent = p.pmouseX,
    //     pmouseYLastEvent = p.pmouseY;
    // p.pmouseX = pmouseXLastFrame;
    // p.pmouseY = pmouseYLastFrame;

    // saveContext();
    p.draw();
    // restoreContext();

    // pmouseXLastFrame = p.mouseX;
    // pmouseYLastFrame = p.mouseY;
    // p.pmouseX = pmouseXLastEvent;
    // p.pmouseY = pmouseYLastEvent;
  };

  // Internal function for kicking off the draw loop
  // for a sketch. Depending on whether a noLoop() was
  // issued during setup or initial draw, this might
  // do "nothing", other than record the sketch start.
  return function() {
    if (doLoop) {
      console.log("kicking off animation");
      p.loop();
    }
  }
}

let emptyhooks = {
  preSetup: noop,
  postSetup: noop,
  preDraw: noop,
  postDraw: noop,

  onFrameStart: noop,
  onFrameEnd: noop,
  onLoop: noop,
  onPause: noop
};

class SketchRunner {
  constructor(data) {
  	this.sketch = data.sketch;
  	this.target = data.target;
  	this.hooks = Object.assign({}, emptyhooks, data.hooks);
  	this.cache = {};

    // FIXME: TODO: this provisions a canvas for testing purposes. REMOVE LATER
    if (!this.target) {
      let canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      this.target = canvas;
    }

    // set up Processing API function bindings
    colorBindings(this.sketch, this.hooks);
    this.startLooping = playBindings(this.sketch, this.hooks);

    // FIXME: TODO: test size() doing anything at all. REMOVE LATER... possibly
    this.sketch.__setup_drawing_context(this.target, this.target.getContext("2d"));
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
      this.hooks.onFrameStart();
	    this.sketch.draw();
      this.hooks.onFrameEnd();
	    this.__post_draw();
	    // and then we either animate or we don't, depending on whether
      // the user called sketch.noLoop() before we reach this point.
      this.startLooping();
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
    this.hooks.preDraw(this.context);
  	this.cache.context = this.context;
  }

  // hook opportunity
  __post_draw() {
  	this.hooks.postDraw(this.context);
    this.context = this.cache.context;
  }
}

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

return Processing;

})));
