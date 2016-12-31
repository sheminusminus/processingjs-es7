import getLocalNames from "../get-local-names";
import isLookupTableEmpty from "../is-lookup-table-empty";
import contextMappedString from "../context-mapped-string.js";

export default class AstStatementsBlock {
  constructor(statements) {
    this.statements = statements;
  }

  toString(replaceContext) {
    var localNames = getLocalNames(this.statements);
    var oldContext = replaceContext;

    if (!oldContext) {
      console.error("NO CONTEXT IN AstStatementsBlock.toString");
      console.trace();
    }

    // replacing context only when necessary
    if(!isLookupTableEmpty(localNames)) {
      replaceContext = function (subject) {
        return localNames.hasOwnProperty(subject.name) ? subject.name : oldContext(subject);
      };
    }

    return "{\n" + contextMappedString(this.statements, replaceContext, '') + "\n}";
  }
};
