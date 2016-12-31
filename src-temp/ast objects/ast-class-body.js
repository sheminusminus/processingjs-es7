import { trim } from "../trim-spaces";
import sortByWeight from "../sort-by-weight";
import contextMappedString from "../context-mapped-string.js";

export default class AstClassBody {
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

    sortByWeight(this.innerClasses);
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
};
