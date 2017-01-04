export default class AstForStatement {
  constructor(argument, misc) {
    this.argument = argument;
    this.misc = misc;
  }

  toString(replaceContext) {
    return this.misc.prefix + this.argument.toString();
  }
};
