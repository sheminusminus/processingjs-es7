import contextMappedString from "../context-mapped-string.js";

export default class AstInterfaceBody {
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
};
