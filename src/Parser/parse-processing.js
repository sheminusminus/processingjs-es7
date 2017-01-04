import transformMain from "./transform-main";
import injectStrings from "./inject-strings";

export default function parseProcessing(code) {
  // run the conversion from source to AST
  let ast = transformMain(code);

  // convert AST to processing.js source code
  let pjsSourceCode = ast.toString();
  let strings = ast.getSourceStrings();

  // remove empty extra lines with space
  pjsSourceCode = pjsSourceCode.replace(/\s*\n(?:[\t ]*\n)+/g, "\n\n");

  // convert character codes to characters
  pjsSourceCode = pjsSourceCode.replace(/__x([0-9A-F]{4})/g, function(all, hexCode) {
    return String.fromCharCode(parseInt(hexCode,16));
  });

  // inject string content
  pjsSourceCode = injectStrings(pjsSourceCode, strings);

  return pjsSourceCode;
};
