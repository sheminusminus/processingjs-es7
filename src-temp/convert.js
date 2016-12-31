// ==================================================================
//
//  Syntax converter for Processing syntax (java-like) to JavaScript
//
// ==================================================================

import Sketch from "./sketch";
import processPredirectives from "./process-predirectives";
import parseProcessing from "./parse-processing";

export default function convert(processingSourceCode) {
  let sketch = new Sketch();
  let pureSourceCode = processPredirectives(processingSourceCode, sketch);
  let javaScriptSourceCode = parseProcessing(pureSourceCode);
  sketch.sourceCode = javaScriptSourceCode;
  return sketch;
}
