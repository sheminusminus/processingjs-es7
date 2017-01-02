export default class AstPrefixStatement {
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
};
