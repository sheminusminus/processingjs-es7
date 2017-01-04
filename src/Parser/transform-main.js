import removeGenerics from "./remove-generics";
import splitToAtoms from "./split-to-atoms";
import Transformer from "./transformers";
import Ast from "./ast objects/ast";

// helper function:
//
//   masks strings and regexs with "'5'", where 5 is the index in an array
//   containing all strings and regexs also removes all comments.
//
function removeStrings(strings) {
  return function(all, quoted, aposed, regexCtx, prefix, regex, singleComment, comment) {
    let index;
    if(quoted || aposed) { // replace strings
      index = strings.length;
      strings.push(all);
      return "'" + index + "'";
    }
    if(regexCtx) { // replace RegExps
      index = strings.length;
      strings.push(regex);
      return prefix + "'" + index + "'";
    }
    // kill comments
    return comment !== "" ? " " : "\n";
  };
};

// helper function
//
//   protects $ and _ in source code during AST transformation
//
function hexProtector(all, hexCode) {
  // $ = __x0024
  // _ = __x005F
  // this protects existing character codes from conversion
  // __x0024 = __x005F_x0024
  return "__x005F_x" + hexCode;
}

// ...
export default function transformMain(code, scope) {
	// remove carriage returns "\r"
	let codeWithoutExtraCr = code.replace(/\r\n?|\n\r/g, "\n");

  // unzip code as string heap and stringless source code.
	let strings = [];
  let replaceFn = removeStrings(strings);
	let codeWithoutStrings = codeWithoutExtraCr.replace(/("(?:[^"\\\n]|\\.)*")|('(?:[^'\\\n]|\\.)*')|(([\[\(=|&!\^:?]\s*)(\/(?![*\/])(?:[^\/\\\n]|\\.)*\/[gim]*)\b)|(\/\/[^\n]*\n)|(\/\*(?:(?!\*\/)(?:.|\n))*\*\/)/g, replaceFn);

	// protect character codes from namespace collision
	codeWithoutStrings = codeWithoutStrings.replace(/__x([0-9A-F]{4})/g, hexProtector);

	// convert dollar sign to character code
	codeWithoutStrings = codeWithoutStrings.replace(/\$/g, "__x0024");

	// Remove newlines after return statements
	codeWithoutStrings = codeWithoutStrings.replace(/return\s*[\n\r]+/g, "return ");

	// Remove generics
	let codeWithoutGenerics = removeGenerics(codeWithoutStrings);

	// Split code into atoms
	let atoms = splitToAtoms(codeWithoutGenerics);
  let transformer = new Transformer(atoms);

  // Remove java import statements from the source
  //
  // FIXME: TODO: now that ES6 has class import functionality, we
  //              should be able to leave these in, and then during
  //              execution let the browser deal with errors.
  let statements = transformer.extractClassesAndMethods(atoms[0]);
  statements = statements.replace(/\bimport\s+[^;]+;/g, "");

  // transform code into an AST nodeSet
  let nodeSet = transformer.transformStatements(statements);
  let declaredClasses = transformer.declaredClasses;

  // bind transform as AST
  let ast = new Ast(declaredClasses, strings, nodeSet);
  ast.generateMetadata();
  ast.setWeight();

  // and we're done
  return ast;
};
