import AstClass from "./ast objects/ast-class";
import AstForStatement from "./ast objects/ast-for-statement";
import AstFunction from "./ast objects/ast-function";
import AstInnerClass from "./ast objects/ast-inner-class";
import AstInnerInterface from "./ast objects/ast-inner-interface";
import AstInterface from "./ast objects/ast-interface";
import AstMethod from "./ast objects/ast-method";
import AstVar from "./ast objects/ast-var";

import appendToLookupTable from "./append-to-lookup-table";

export default function getLocalNames(statements) {
  let localNames = [];
  for(let i=0,l=statements.length;i<l;++i) {
    let statement = statements[i];
    if(statement instanceof AstVar) {
      localNames = localNames.concat(statement.getNames());
    } else if(statement instanceof AstForStatement &&
      statement.argument.initStatement instanceof AstVar) {
      localNames = localNames.concat(statement.argument.initStatement.getNames());
    } else if(statement instanceof AstInnerInterface || statement instanceof AstInnerClass ||
      statement instanceof AstInterface || statement instanceof AstClass ||
      statement instanceof AstMethod || statement instanceof AstFunction) {
      localNames.push(statement.name);
    }
  }
  return appendToLookupTable({}, localNames);
};
