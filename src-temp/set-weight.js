  function setWeight(ast) {
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