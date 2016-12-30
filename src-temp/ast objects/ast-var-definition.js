
  function AstVarDefinition(name, value, isDefault) {
    this.name = name;
    this.value = value;
    this.isDefault = isDefault;
  }
  AstVarDefinition.prototype.toString = function() {
    return this.name + ' = ' + this.value;
  };