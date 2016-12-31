export default class AstVarDefinition {
  constructor (name, value, isDefault) {
    this.name = name;
    this.value = value;
    this.isDefault = isDefault;
  }

  toString(replaceContext) {
    return this.name + ' = ' + this.value.toString(replaceContext);
  }
};
