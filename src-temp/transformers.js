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

import appendToLookupTable from "./append-to-lookup-table";

import (
  AstCatchStatement,
  AstClass,
  AstClassBody,
  AstClassField,
  AstClassMethod,
  AstConstructor,
  AstExpression,
  AstForEachExpression,
  AstForExpression,
  AstForInExpression,
  AstForStatement,
  AstFunction,
  AstInlineClass,
  AstInlineObject,
  AstInnerClass,
  AstInnerInterface,
  AstInterface,
  AstInterfaceBody,
  AstLabel,
  AstMethod,
  AstParam,
  AstParams,
  AstPrefixStatement,
  AstRoot,
  AstStatement,
  AstStatementsBlock,
  AstSwitchCase,
  AstVar,
  AstVarDefinition
) from "./ast-objects/all";


// =======================================================

let replaceContext;
let declaredClasses = {};
let currentClassId;
let classIdSeed = 0;
let classesRegex = /\b((?:(?:public|private|final|protected|static|abstract)\s+)*)(class|interface)\s+([A-Za-z_$][\w$]*\b)(\s+extends\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*,\s*[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*\b)*)?(\s+implements\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*,\s*[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*\b)*)?\s*("A\d+")/g;
let methodsRegex = /\b((?:(?:public|private|final|protected|static|abstract|synchronized)\s+)*)((?!(?:else|new|return|throw|function|public|private|protected)\b)[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*"C\d+")*)\s*([A-Za-z_$][\w$]*\b)\s*("B\d+")(\s*throws\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*,\s*[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)*)?\s*("A\d+"|;)/g;
let fieldTest = /^((?:(?:public|private|final|protected|static)\s+)*)((?!(?:else|new|return|throw)\b)[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*"C\d+")*)\s*([A-Za-z_$][\w$]*\b)\s*(?:"C\d+"\s*)*([=,]|$)/;
let cstrsRegex = /\b((?:(?:public|private|final|protected|static|abstract)\s+)*)((?!(?:new|return|throw)\b)[A-Za-z_$][\w$]*\b)\s*("B\d+")(\s*throws\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*,\s*[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)*)?\s*("A\d+")/g;
let attrAndTypeRegex = /^((?:(?:public|private|final|protected|static)\s+)*)((?!(?:new|return|throw)\b)[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*(?:\s*"C\d+")*)\s*/;
let functionsRegex = /\bfunction(?:\s+([A-Za-z_$][\w$]*))?\s*("B\d+")\s*("A\d+")/g;

let transformClassBody,
    transformInterfaceBody,
    transformStatementsBlock,
    transformStatements,
    transformMain,
    transformExpression;

// =======================================================

function addAtom(text, type) {
  let lastIndex = atoms.length;
  atoms.push(text);
  return '"' + type + lastIndex + '"';
}

function transformParams(params) {
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

function preExpressionTransform(expr) {
  let s = expr;
  // new type[] {...} --> {...}
  s = s.replace(/\bnew\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)(?:\s*"C\d+")+\s*("A\d+")/g, function(all, type, init) {
    return init;
  });
  // new Runnable() {...} --> "F???"
  s = s.replace(/\bnew\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)(?:\s*"B\d+")\s*("A\d+")/g, function(all, type, init) {
    return addAtom(all, 'F');
  });
  // function(...) { } --> "H???"
  s = s.replace(functionsRegex, function(all) {
    return addAtom(all, 'H');
  });
  // new type[?] --> createJavaArray('type', [?])
  s = s.replace(/\bnew\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)\s*("C\d+"(?:\s*"C\d+")*)/g, function(all, type, index) {
    let args = index.replace(/"C(\d+)"/g, function(all, j) { return atoms[j]; })
      .replace(/\[\s*\]/g, "[null]").replace(/\s*\]\s*\[\s*/g, ", ");
    let arrayInitializer = "{" + args.substring(1, args.length - 1) + "}";
    let createArrayArgs = "('" + type + "', " + addAtom(arrayInitializer, 'A') + ")";
    return '$p.createJavaArray' + addAtom(createArrayArgs, 'B');
  });
  // .length() --> .length
  s = s.replace(/(\.\s*length)\s*"B\d+"/g, "$1");
  // #000000 --> 0x000000
  s = s.replace(/#([0-9A-Fa-f]{6})\b/g, function(all, digits) {
    return "0xFF" + digits;
  });
  // delete (type)???, except (int)???
  s = s.replace(/"B(\d+)"(\s*(?:[\w$']|"B))/g, function(all, index, next) {
    let atom = atoms[index];
    if(!/^\(\s*[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*\s*(?:"C\d+"\s*)*\)$/.test(atom)) {
      return all;
    }
    if(/^\(\s*int\s*\)$/.test(atom)) {
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
  s = s.replace(/\(int\)([^,\]\)\}\?\:\*\+\-\/\^\|\%\&\~<\>\=]+)/g, function(all, arg) {
    let trimmed = trimSpaces(arg);
    return trimmed.untrim("__int_cast(" + trimmed.middle + ")");
  });
  // super() -> $superCstr(), super. -> $super.;
  s = s.replace(/\bsuper(\s*"B\d+")/g, "$$superCstr$1").replace(/\bsuper(\s*\.)/g, "$$super$1");
  // 000.43->0.43 and 0010f->10, but not 0010
  s = s.replace(/\b0+((\d*)(?:\.[\d*])?(?:[eE][\-\+]?\d+)?[fF]?)\b/, function(all, numberWithout0, intPart) {
    if( numberWithout0 === intPart) {
      return all;
    }
    return intPart === "" ? "0" + numberWithout0 : numberWithout0;
  });
  // 3.0f -> 3.0
  s = s.replace(/\b(\.?\d+\.?)[fF]\b/g, "$1");
  // Weird (?) parsing errors with %
  s = s.replace(/([^\s])%([^=\s])/g, "$1 % $2");
  // Since frameRate() and frameRate are different things,
  // we need to differentiate them somehow. So when we parse
  // the Processing.js source, replace frameRate so it isn't
  // confused with frameRate(), as well as keyPressed and mousePressed
  s = s.replace(/\b(frameRate|keyPressed|mousePressed)\b(?!\s*"B)/g, "__$1");
  // "boolean", "byte", "int", etc. => "parseBoolean", "parseByte", "parseInt", etc.
  s = s.replace(/\b(boolean|byte|char|float|int)\s*"B/g, function(all, name) {
    return "parse" + name.substring(0, 1).toUpperCase() + name.substring(1) + "\"B";
  });
  // "pixels" replacements:
  //   pixels[i] = c => pixels.setPixel(i,c) | pixels[i] => pixels.getPixel(i)
  //   pixels.length => pixels.getLength()
  //   pixels = ar => pixels.set(ar) | pixels => pixels.toArray()
  s = s.replace(/\bpixels\b\s*(("C(\d+)")|\.length)?(\s*=(?!=)([^,\]\)\}]+))?/g,
    function(all, indexOrLength, index, atomIndex, equalsPart, rightSide) {
      if(index) {
        let atom = atoms[atomIndex];
        if(equalsPart) {
          return "pixels.setPixel" + addAtom("(" +atom.substring(1, atom.length - 1) +
            "," + rightSide + ")", 'B');
        }
        return "pixels.getPixel" + addAtom("(" + atom.substring(1, atom.length - 1) +
          ")", 'B');
      }
      if(indexOrLength) {
        // length
        return "pixels.getLength" + addAtom("()", 'B');
      }
      if(equalsPart) {
        return "pixels.set" + addAtom("(" + rightSide + ")", 'B');
      }
      return "pixels.toArray" + addAtom("()", 'B');
    });
  // Java method replacements for: replace, replaceAll, replaceFirst, equals, hashCode, etc.
  //   xxx.replace(yyy) -> __replace(xxx, yyy)
  //   "xx".replace(yyy) -> __replace("xx", yyy)
  let repeatJavaReplacement;
  function replacePrototypeMethods(all, subject, method, atomIndex) {
    let atom = atoms[atomIndex];
    repeatJavaReplacement = true;
    let trimmed = trimSpaces(atom.substring(1, atom.length - 1));
    return "__" + method  + ( trimmed.middle === "" ? addAtom("(" + subject.replace(/\.\s*$/, "") + ")", 'B') :
      addAtom("(" + subject.replace(/\.\s*$/, "") + "," + trimmed.middle + ")", 'B') );
  }
  do {
    repeatJavaReplacement = false;
    s = s.replace(/((?:'\d+'|\b[A-Za-z_$][\w$]*\s*(?:"[BC]\d+")*)\s*\.\s*(?:[A-Za-z_$][\w$]*\s*(?:"[BC]\d+"\s*)*\.\s*)*)(replace|replaceAll|replaceFirst|contains|equals|equalsIgnoreCase|hashCode|toCharArray|printStackTrace|split|startsWith|endsWith|codePointAt|matches)\s*"B(\d+)"/g,
      replacePrototypeMethods);
  } while (repeatJavaReplacement);
  // xxx instanceof yyy -> __instanceof(xxx, yyy)
  function replaceInstanceof(all, subject, type) {
    repeatJavaReplacement = true;
    return "__instanceof" + addAtom("(" + subject + ", " + type + ")", 'B');
  }
  do {
    repeatJavaReplacement = false;
    s = s.replace(/((?:'\d+'|\b[A-Za-z_$][\w$]*\s*(?:"[BC]\d+")*)\s*(?:\.\s*[A-Za-z_$][\w$]*\s*(?:"[BC]\d+"\s*)*)*)instanceof\s+([A-Za-z_$][\w$]*\s*(?:\.\s*[A-Za-z_$][\w$]*)*)/g,
      replaceInstanceof);
  } while (repeatJavaReplacement);
  // this() -> $constr()
  s = s.replace(/\bthis(\s*"B\d+")/g, "$$constr$1");

  return s;
}

function transformInlineClass(class_) {
  let m = new RegExp(/\bnew\s*([A-Za-z_$][\w$]*\s*(?:\.\s*[A-Za-z_$][\w$]*)*)\s*"B\d+"\s*"A(\d+)"/).exec(class_);
  let oldClassId = currentClassId, newClassId = generateClassId();
  currentClassId = newClassId;
  let uniqueClassName = m[1] + "$" + newClassId;
  let inlineClass = new AstInlineClass(uniqueClassName,
    transformClassBody(atoms[m[2]], uniqueClassName, "", "implements " + m[1]));
  appendClass(inlineClass, newClassId, oldClassId);
  currentClassId = oldClassId;
  return inlineClass;
}

function transformFunction(class_) {
  let m = new RegExp(/\b([A-Za-z_$][\w$]*)\s*"B(\d+)"\s*"A(\d+)"/).exec(class_);
  return new AstFunction( m[1] !== "function" ? m[1] : null,
    transformParams(atoms[m[2]]), transformStatementsBlock(atoms[m[3]]));
}

function transformInlineObject(obj) {
  let members = obj.split(',');
  for(let i=0; i < members.length; ++i) {
    let label = members[i].indexOf(':');
    if(label < 0) {
      members[i] = { value: transformExpression(members[i]) };
    } else {
      members[i] = { label: trim(members[i].substring(0, label)),
        value: transformExpression( trim(members[i].substring(label + 1)) ) };
    }
  }
  return new AstInlineObject(members);
}

function expandExpression(expr) {
  if(expr.charAt(0) === '(' || expr.charAt(0) === '[') {
    return expr.charAt(0) + expandExpression(expr.substring(1, expr.length - 1)) + expr.charAt(expr.length - 1);
  }
  if(expr.charAt(0) === '{') {
    if(/^\{\s*(?:[A-Za-z_$][\w$]*|'\d+')\s*:/.test(expr)) {
      return "{" + addAtom(expr.substring(1, expr.length - 1), 'I') + "}";
    }
    return "[" + expandExpression(expr.substring(1, expr.length - 1)) + "]";
  }
  let trimmed = trimSpaces(expr);
  let result = preExpressionTransform(trimmed.middle);
  result = result.replace(/"[ABC](\d+)"/g, function(all, index) {
    return expandExpression(atoms[index]);
  });
  return trimmed.untrim(result);
}

function replaceContextInVars(expr) {
  return expr.replace(/(\.\s*)?((?:\b[A-Za-z_]|\$)[\w$]*)(\s*\.\s*([A-Za-z_$][\w$]*)(\s*\()?)?/g,
    function(all, memberAccessSign, identifier, suffix, subMember, callSign) {
      if(memberAccessSign) {
        return all;
      }
      let subject = { name: identifier, member: subMember, callSign: !!callSign };
      return replaceContext(subject) + (suffix === undef ? "" : suffix);
    });
}


function transformExpression(expr) {
  let transforms = [];
  let s = expandExpression(expr);
  s = s.replace(/"H(\d+)"/g, function(all, index) {
    transforms.push(transformFunction(atoms[index]));
    return '"!' + (transforms.length - 1) + '"';
  });
  s = s.replace(/"F(\d+)"/g, function(all, index) {
    transforms.push(transformInlineClass(atoms[index]));
    return '"!' + (transforms.length - 1) + '"';
  });
  s = s.replace(/"I(\d+)"/g, function(all, index) {
    transforms.push(transformInlineObject(atoms[index]));
    return '"!' + (transforms.length - 1) + '"';
  });

  return new AstExpression(s, transforms);
};


function transformVarDefinition(def, defaultTypeValue) {
  let eqIndex = def.indexOf("=");
  let name, value, isDefault;
  if(eqIndex < 0) {
    name = def;
    value = defaultTypeValue;
    isDefault = true;
  } else {
    name = def.substring(0, eqIndex);
    value = transformExpression(def.substring(eqIndex + 1));
    isDefault = false;
  }
  return new AstVarDefinition( trim(name.replace(/(\s*"C\d+")+/g, "")),
    value, isDefault);
}

function getDefaultValueForType(type) {
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

function transformStatement(statement) {
  if(fieldTest.test(statement)) {
    let attrAndType = attrAndTypeRegex.exec(statement);
    let definitions = statement.substring(attrAndType[0].length).split(",");
    let defaultTypeValue = getDefaultValueForType(attrAndType[2]);
    for(let i=0; i < definitions.length; ++i) {
      definitions[i] = transformVarDefinition(definitions[i], defaultTypeValue);
    }
    return new AstVar(definitions, attrAndType[2]);
  }
  return new AstStatement(transformExpression(statement));
}

function transformForExpression(expr) {
  let content;
  if (/\bin\b/.test(expr)) {
    content = expr.substring(1, expr.length - 1).split(/\bin\b/g);
    return new AstForInExpression( transformStatement(trim(content[0])),
      transformExpression(content[1]));
  }
  if (expr.indexOf(":") >= 0 && expr.indexOf(";") < 0) {
    content = expr.substring(1, expr.length - 1).split(":");
    return new AstForEachExpression( transformStatement(trim(content[0])),
      transformExpression(content[1]));
  }
  content = expr.substring(1, expr.length - 1).split(";");
  return new AstForExpression( transformStatement(trim(content[0])),
    transformExpression(content[1]), transformExpression(content[2]));
}

function sortByWeight(array) {
  array.sort(function (a,b) {
    return b.weight - a.weight;
  });
}

function transformInnerClass(class_) {
  let m = classesRegex.exec(class_); // 1 - attr, 2 - class|int, 3 - name, 4 - extends, 5 - implements, 6 - body
  classesRegex.lastIndex = 0;
  let isStatic = m[1].indexOf("static") >= 0;
  let body = atoms[getAtomIndex(m[6])], innerClass;
  let oldClassId = currentClassId, newClassId = generateClassId();
  currentClassId = newClassId;
  if(m[2] === "interface") {
    innerClass = new AstInnerInterface(m[3], transformInterfaceBody(body, m[3], m[4]), isStatic);
  } else {
    innerClass = new AstInnerClass(m[3], transformClassBody(body, m[3], m[4], m[5]), isStatic);
  }
  appendClass(innerClass, newClassId, oldClassId);
  currentClassId = oldClassId;
  return innerClass;
}

function transformClassMethod(method) {
  let m = methodsRegex.exec(method);
  methodsRegex.lastIndex = 0;
  let isStatic = m[1].indexOf("static") >= 0;
  let body = m[6] !== ';' ? atoms[getAtomIndex(m[6])] : "{}";
  return new AstClassMethod(m[3], transformParams(atoms[getAtomIndex(m[4])]),
    transformStatementsBlock(body), isStatic );
}

function transformClassField(statement) {
  let attrAndType = attrAndTypeRegex.exec(statement);
  let isStatic = attrAndType[1].indexOf("static") >= 0;
  let definitions = statement.substring(attrAndType[0].length).split(/,\s*/g);
  let defaultTypeValue = getDefaultValueForType(attrAndType[2]);
  for(let i=0; i < definitions.length; ++i) {
    definitions[i] = transformVarDefinition(definitions[i], defaultTypeValue);
  }
  return new AstClassField(definitions, attrAndType[2], isStatic);
}

function transformConstructor(cstr) {
  let m = new RegExp(/"B(\d+)"\s*"A(\d+)"/).exec(cstr);
  let params = transformParams(atoms[m[1]]);

  return new AstConstructor(params, transformStatementsBlock(atoms[m[2]]));
}

// This converts constructors into atoms, and adds them to the atoms array.
// constructors = G
function extractConstructors(code, className) {
  let result = code.replace(cstrsRegex, function(all, attr, name, params, throws_, body) {
    if(name !== className) {
      return all;
    }
    return addAtom(all, 'G');
  });
  return result;
}

// This converts classes, methods and functions into atoms, and adds them to the atoms array.
// classes = E, methods = D and functions = H
function extractClassesAndMethods(code) {
  let s = code;
  s = s.replace(classesRegex, function(all) {
    return addAtom(all, 'E');
  });
  s = s.replace(methodsRegex, function(all) {
    return addAtom(all, 'D');
  });
  s = s.replace(functionsRegex, function(all) {
    return addAtom(all, 'H');
  });
  return s;
}

function transformInterfaceBody(body, name, baseInterfaces) {
  let declarations = body.substring(1, body.length - 1);
  declarations = extractClassesAndMethods(declarations);
  declarations = extractConstructors(declarations, name);
  let methodsNames = [], classes = [];
  declarations = declarations.replace(/"([DE])(\d+)"/g, function(all, type, index) {
    if(type === 'D') { methodsNames.push(index); }
    else if(type === 'E') { classes.push(index); }
    return "";
  });
  let fields = declarations.split(/;(?:\s*;)*/g);
  let baseInterfaceNames;
  let i, l;

  if(baseInterfaces !== undef) {
    baseInterfaceNames = baseInterfaces.replace(/^\s*extends\s+(.+?)\s*$/g, "$1").split(/\s*,\s*/g);
  }

  for(i = 0, l = methodsNames.length; i < l; ++i) {
    let method = transformClassMethod(atoms[methodsNames[i]]);
    methodsNames[i] = method.name;
  }
  for(i = 0, l = fields.length - 1; i < l; ++i) {
    let field = trimSpaces(fields[i]);
    fields[i] = transformClassField(field.middle);
  }
  let tail = fields.pop();
  for(i = 0, l = classes.length; i < l; ++i) {
    classes[i] = transformInnerClass(atoms[classes[i]]);
  }

  return new AstInterfaceBody(name, baseInterfaceNames, methodsNames, fields, classes, { tail: tail });
};

function transformClassBody(body, name, baseName, interfaces) {
  let declarations = body.substring(1, body.length - 1);
  declarations = extractClassesAndMethods(declarations);
  declarations = extractConstructors(declarations, name);
  let methods = [], classes = [], cstrs = [], functions = [];
  declarations = declarations.replace(/"([DEGH])(\d+)"/g, function(all, type, index) {
    if(type === 'D') { methods.push(index); }
    else if(type === 'E') { classes.push(index); }
    else if(type === 'H') { functions.push(index); }
    else { cstrs.push(index); }
    return "";
  });
  let fields = declarations.replace(/^(?:\s*;)+/, "").split(/;(?:\s*;)*/g);
  let baseClassName, interfacesNames;
  let i;

  if(baseName !== undef) {
    baseClassName = baseName.replace(/^\s*extends\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)\s*$/g, "$1");
  }

  if(interfaces !== undef) {
    interfacesNames = interfaces.replace(/^\s*implements\s+(.+?)\s*$/g, "$1").split(/\s*,\s*/g);
  }

  for(i = 0; i < functions.length; ++i) {
    functions[i] = transformFunction(atoms[functions[i]]);
  }
  for(i = 0; i < methods.length; ++i) {
    methods[i] = transformClassMethod(atoms[methods[i]]);
  }
  for(i = 0; i < fields.length - 1; ++i) {
    let field = trimSpaces(fields[i]);
    fields[i] = transformClassField(field.middle);
  }
  let tail = fields.pop();
  for(i = 0; i < cstrs.length; ++i) {
    cstrs[i] = transformConstructor(atoms[cstrs[i]]);
  }
  for(i = 0; i < classes.length; ++i) {
    classes[i] = transformInnerClass(atoms[classes[i]]);
  }

  return new AstClassBody(name, baseClassName, interfacesNames, functions, methods, fields, cstrs,
    classes, { tail: tail });
};

function generateClassId() {
  return "class" + (++classIdSeed);
}

function appendClass(class_, classId, scopeId) {
  class_.classId = classId;
  class_.scopeId = scopeId;
  declaredClasses[classId] = class_;
}

function transformGlobalClass(class_) {
  let m = classesRegex.exec(class_); // 1 - attr, 2 - class|int, 3 - name, 4 - extends, 5 - implements, 6 - body
  classesRegex.lastIndex = 0;
  let body = atoms[getAtomIndex(m[6])];
  let oldClassId = currentClassId, newClassId = generateClassId();
  currentClassId = newClassId;
  let globalClass;
  if(m[2] === "interface") {
    globalClass = new AstInterface(m[3], transformInterfaceBody(body, m[3], m[4]) );
  } else {
    globalClass = new AstClass(m[3], transformClassBody(body, m[3], m[4], m[5]) );
  }
  appendClass(globalClass, newClassId, oldClassId);
  currentClassId = oldClassId;
  return globalClass;
}

function transformGlobalMethod(method) {
  let m = methodsRegex.exec(method);
  let result =
  methodsRegex.lastIndex = 0;
  return new AstMethod(m[3], transformParams(atoms[getAtomIndex(m[4])]),
    transformStatementsBlock(atoms[getAtomIndex(m[6])]));
}

function preStatementsTransform(statements) {
  let s = statements;
  // turns multiple catch blocks into one, because we have no way to properly get into them anyway.
  s = s.replace(/\b(catch\s*"B\d+"\s*"A\d+")(\s*catch\s*"B\d+"\s*"A\d+")+/g, "$1");
  return s;
}

function transformStatements(statements, transformMethod, transformClass) {
  let nextStatement = new RegExp(/\b(catch|for|if|switch|while|with)\s*"B(\d+)"|\b(do|else|finally|return|throw|try|break|continue)\b|("[ADEH](\d+)")|\b(case)\s+([^:]+):|\b([A-Za-z_$][\w$]*\s*:)|(;)/g);
  let res = [];
  statements = preStatementsTransform(statements);
  let lastIndex = 0, m, space;
  // m contains the matches from the nextStatement regexp, null if there are no matches.
  // nextStatement.exec starts searching at nextStatement.lastIndex.
  while((m = nextStatement.exec(statements)) !== null) {
    if(m[1] !== undef) { // catch, for ...
      let i = statements.lastIndexOf('"B', nextStatement.lastIndex);
      let statementsPrefix = statements.substring(lastIndex, i);
      if(m[1] === "for") {
        res.push(new AstForStatement(transformForExpression(atoms[m[2]]),
          { prefix: statementsPrefix }) );
      } else if(m[1] === "catch") {
        res.push(new AstCatchStatement(transformParams(atoms[m[2]]),
          { prefix: statementsPrefix }) );
      } else {
        res.push(new AstPrefixStatement(m[1], transformExpression(atoms[m[2]]),
          { prefix: statementsPrefix }) );
      }
    } else if(m[3] !== undef) { // do, else, ...
        res.push(new AstPrefixStatement(m[3], undef,
          { prefix: statements.substring(lastIndex, nextStatement.lastIndex) }) );
    } else if(m[4] !== undef) { // block, class and methods
      space = statements.substring(lastIndex, nextStatement.lastIndex - m[4].length);
      if(trim(space).length !== 0) { continue; } // avoiding new type[] {} construct
      res.push(space);
      let kind = m[4].charAt(1), atomIndex = m[5];
      if(kind === 'D') {
        res.push(transformMethod(atoms[atomIndex]));
      } else if(kind === 'E') {
        res.push(transformClass(atoms[atomIndex]));
      } else if(kind === 'H') {
        res.push(transformFunction(atoms[atomIndex]));
      } else {
        res.push(transformStatementsBlock(atoms[atomIndex]));
      }
    } else if(m[6] !== undef) { // switch case
      res.push(new AstSwitchCase(transformExpression(trim(m[7]))));
    } else if(m[8] !== undef) { // label
      space = statements.substring(lastIndex, nextStatement.lastIndex - m[8].length);
      if(trim(space).length !== 0) { continue; } // avoiding ?: construct
      res.push(new AstLabel(statements.substring(lastIndex, nextStatement.lastIndex)) );
    } else { // semicolon
      let statement = trimSpaces(statements.substring(lastIndex, nextStatement.lastIndex - 1));
      res.push(statement.left);
      res.push(transformStatement(statement.middle));
      res.push(statement.right + ";");
    }
    lastIndex = nextStatement.lastIndex;
  }
  let statementsTail = trimSpaces(statements.substring(lastIndex));
  res.push(statementsTail.left);
  if(statementsTail.middle !== "") {
    res.push(transformStatement(statementsTail.middle));
    res.push(";" + statementsTail.right);
  }
  return res;
};

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
  return appendToLookupTable({}, localNames);
}

function transformStatementsBlock(block) {
  let content = trimSpaces(block.substring(1, block.length - 1));
  return new AstStatementsBlock(transformStatements(content.middle));
};
