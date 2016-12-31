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

import { trim, trimSpaces } from "./trim-spaces";
import preExpressionTransform from "./pre-expression-transform";
import preStatementsTransform from "./pre-statements-transform";
import getAtomIndex from "./get-atom-index";

import AstCatchStatement from "./ast objects/ast-catch-statement";
import AstClass from "./ast objects/ast-class";
import AstClassBody from "./ast objects/ast-class-body";
import AstClassField from "./ast objects/ast-class-field";
import AstClassMethod from "./ast objects/ast-class-method";
import AstConstructor from "./ast objects/ast-constructor";
import AstExpression from "./ast objects/ast-expression";
import AstForEachExpression from "./ast objects/ast-for-each-expression";
import AstForExpression from "./ast objects/ast-for-expression";
import AstForInExpression from "./ast objects/ast-for-in-expression";
import AstForStatement from "./ast objects/ast-for-statement";
import AstFunction from "./ast objects/ast-function";
import AstInlineClass from "./ast objects/ast-inline-class";
import AstInlineObject from "./ast objects/ast-inline-object";
import AstInnerClass from "./ast objects/ast-inner-class";
import AstInnerInterface from "./ast objects/ast-inner-interface";
import AstInterface from "./ast objects/ast-interface";
import AstInterfaceBody from "./ast objects/ast-interface-body";
import AstLabel from "./ast objects/ast-label";
import AstMethod from "./ast objects/ast-method";
import AstParam from "./ast objects/ast-param";
import AstParams from "./ast objects/ast-params";
import AstPrefixStatement from "./ast objects/ast-prefix-statement";
import AstStatement from "./ast objects/ast-statement";
import AstStatementsBlock from "./ast objects/ast-statements-block";
import AstSwitchCase from "./ast objects/ast-switch-case";
import AstVar from "./ast objects/ast-var";
import AstVarDefinition from "./ast objects/ast-var-definition";

// =======================================================

export default class Transformer {
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
    let trimmed = trimSpaces(expr);
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
      let field = trimSpaces(fields[i]);
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
    let oldClassId = this.currentClassId
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

  transformStatementsBlock(block) {
    let content = trimSpaces(block.substring(1, block.length - 1));
    return new AstStatementsBlock(this.transformStatements(content.middle));
  }
};
