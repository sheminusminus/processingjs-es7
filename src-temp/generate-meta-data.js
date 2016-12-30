  function generateMetadata(ast) {
    let globalScope = {};
    let id, class_;
    for(id in declaredClasses) {
      if(declaredClasses.hasOwnProperty(id)) {
        class_ = declaredClasses[id];
        let scopeId = class_.scopeId, name = class_.name;
        if(scopeId) {
          let scope = declaredClasses[scopeId];
          class_.scope = scope;
          if(scope.inScope === undef) {
            scope.inScope = {};
          }
          scope.inScope[name] = class_;
        } else {
          globalScope[name] = class_;
        }
      }
    }

    function findInScopes(class_, name) {
      let parts = name.split('.');
      let currentScope = class_.scope, found;
      while(currentScope) {
        if(currentScope.hasOwnProperty(parts[0])) {
          found = currentScope[parts[0]]; break;
        }
        currentScope = currentScope.scope;
      }
      if(found === undef) {
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