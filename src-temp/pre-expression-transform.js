export default function preExpressionTransform(transformer, expr) {
  let s = expr;
  let atoms = transformer.atoms;

  // new type[] {...} --> {...}
  let newTypeRegExp = /\bnew\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)(?:\s*"C\d+")+\s*("A\d+")/g;
  s = s.replace(newTypeRegExp, (all, type, init) => init);

  // new Runnable() {...} --> "F???"
  let newRunnableRegExp = /\bnew\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)(?:\s*"B\d+")\s*("A\d+")/g;
  s = s.replace(newRunnableRegExp, (all, type, init) => transformer.addAtom(all, 'F'));

  // function(...) { } --> "H???"
  s = s.replace(transformer.functionsRegex, all => transformer.addAtom(all, 'H'));

  // new type[?] --> createJavaArray('type', [?])
  let javaArrayRegExp = /\bnew\s+([A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)\s*("C\d+"(?:\s*"C\d+")*)/g;
  s = s.replace(javaArrayRegExp, (all, type, index) => {
    let args = index
      .replace(/"C(\d+)"/g, (all, j) => atoms[j] )
      .replace(/\[\s*\]/g, "[null]")
      .replace(/\s*\]\s*\[\s*/g, ", ");
    let arrayInitializer = "{" + args.substring(1, args.length - 1) + "}";
    let createArrayArgs = "('" + type + "', " + transformer.addAtom(arrayInitializer, 'A') + ")";
    return '$p.createJavaArray' + transformer.addAtom(createArrayArgs, 'B');
  });

  // .length() --> .length
  let lengthRegExp = /(\.\s*length)\s*"B\d+"/g;
  s = s.replace(lengthRegExp, "$1");

  // #000000 --> 0x000000
  let hexRegExp = /#([0-9A-Fa-f]{6})\b/g;
  s = s.replace(hexRegExp, (all, digits) => "0xFF" + digits );

  // delete (type)???, except (int)???
  let typeDeletionRegExp = /"B(\d+)"(\s*(?:[\w$']|"B))/g;
  s = s.replace(typeDeletionRegExp, (all, index, next) => {
    let atom = atoms[index];

    // FIXME: TODO: figure out this regexp and name it appropriately
    let unknownRegExp = /^\(\s*[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*\s*(?:"C\d+"\s*)*\)$/;
    if(!unknownRegExp.test(atom)) {
      return all;
    }

    let intTypeRegExp = /^\(\s*int\s*\)$/;
    if(intTypeRegExp.test(atom)) {
      return "(int)" + next;
    }

    let indexParts = atom.split(/"C(\d+)"/g);
    if(indexParts.length > 1) {
      // even items contains atom numbers, can check only first
      if(! /^\[\s*\]$/.test(atoms[indexParts[1]])) {
        return all; // fallback - not a cast
      }
    }
    return "" + next;
  });

  // (int)??? -> __int_cast(???)
  let intCastRegExp = /\(int\)([^,\]\)\}\?\:\*\+\-\/\^\|\%\&\~<\>\=]+)/g;
  s = s.replace(intCastRegExp, (all, arg) => {
    let trimmed = trimSpaces(arg);
    return trimmed.untrim("__int_cast(" + trimmed.middle + ")");
  });

  // super() -> $superCstr(), super. -> $super.;
  let superConstructorRegExp = /\bsuper(\s*"B\d+")/g;
  let superRegExp = /\bsuper(\s*\.)/g;
  s = s.replace(superConstructorRegExp, "$$superCstr$1").replace(superRegExp, "$$super$1");

  // 000.43->0.43 and 0010f->10, but not 0010
  let floatConversionRegExp = /\b0+((\d*)(?:\.[\d*])?(?:[eE][\-\+]?\d+)?[fF]?)\b/;
  s = s.replace(floatConversionRegExp, (all, numberWithout0, intPart) => {
    if( numberWithout0 === intPart) {
      return all;
    }
    return intPart === "" ? "0" + numberWithout0 : numberWithout0;
  });

  // 3.0f -> 3.0
  let floatFormatRegExp = /\b(\.?\d+\.?)[fF]\b/g;
  s = s.replace(floatFormatRegExp, "$1");

  // Weird (?) parsing errors with %
  let percRegExp = /([^\s])%([^=\s])/g;
  s = s.replace(percRegExp, "$1 % $2");

  // Since frameRate() and frameRate are different things,
  // we need to differentiate them somehow. So when we parse
  // the Processing.js source, replace frameRate so it isn't
  // confused with frameRate(), as well as keyPressed and mousePressed
  let namingConflictRegExp = /\b(frameRate|keyPressed|mousePressed)\b(?!\s*"B)/g;
  s = s.replace(namingConflictRegExp, "__$1");

  // "boolean", "byte", "int", etc. => "parseBoolean", "parseByte", "parseInt", etc.
  let primitivesRegExp = /\b(boolean|byte|char|float|int)\s*"B/g;
  s = s.replace(primitivesRegExp, (all, name) => "parse" + name.substring(0, 1).toUpperCase() + name.substring(1) + "\"B");

  // "pixels" replacements:
  //   pixels[i] = c => pixels.setPixel(i,c) | pixels[i] => pixels.getPixel(i)
  //   pixels.length => pixels.getLength()
  //   pixels = ar => pixels.set(ar) | pixels => pixels.toArray()
  let pixelsRegExp = /\bpixels\b\s*(("C(\d+)")|\.length)?(\s*=(?!=)([^,\]\)\}]+))?/g;
  s = s.replace(pixelsRegExp,
    (all, indexOrLength, index, atomIndex, equalsPart, rightSide) => {
      if(index) {
        let atom = atoms[atomIndex];
        if(equalsPart) {
          return "pixels.setPixel" + transformer.addAtom("(" +atom.substring(1, atom.length - 1) + "," + rightSide + ")", 'B');
        }
        return "pixels.getPixel" + transformer.addAtom("(" + atom.substring(1, atom.length - 1) + ")", 'B');
      }
      if(indexOrLength) {
        // length
        return "pixels.getLength" + transformer.addAtom("()", 'B');
      }
      if(equalsPart) {
        return "pixels.set" + transformer.addAtom("(" + rightSide + ")", 'B');
      }
      return "pixels.toArray" + transformer.addAtom("()", 'B');
    }
  );

  // Java method replacements for: replace, replaceAll, replaceFirst, equals, hashCode, etc.
  //   xxx.replace(yyy) -> __replace(xxx, yyy)
  //   "xx".replace(yyy) -> __replace("xx", yyy)
  let repeatJavaReplacement;

  function replacePrototypeMethods(all, subject, method, atomIndex) {
    let atom = atoms[atomIndex];
    repeatJavaReplacement = true;
    let trimmed = trimSpaces(atom.substring(1, atom.length - 1));
    return "__" + method  + (
      trimmed.middle === "" ?
        transformer.addAtom("(" + subject.replace(/\.\s*$/, "") + ")", 'B')
        :
        transformer.addAtom("(" + subject.replace(/\.\s*$/, "") + "," + trimmed.middle + ")", 'B')
    );
  }

  do {
    repeatJavaReplacement = false;
    let prototypeMethodRegExp = /((?:'\d+'|\b[A-Za-z_$][\w$]*\s*(?:"[BC]\d+")*)\s*\.\s*(?:[A-Za-z_$][\w$]*\s*(?:"[BC]\d+"\s*)*\.\s*)*)(replace|replaceAll|replaceFirst|contains|equals|equalsIgnoreCase|hashCode|toCharArray|printStackTrace|split|startsWith|endsWith|codePointAt|matches)\s*"B(\d+)"/g;
    s = s.replace(prototypeMethodRegExp, replacePrototypeMethods);
  } while (repeatJavaReplacement);

  // xxx instanceof yyy -> __instanceof(xxx, yyy)
  function replaceInstanceof(all, subject, type) {
    repeatJavaReplacement = true;
    return "__instanceof" + transformer.addAtom("(" + subject + ", " + type + ")", 'B');
  }
  do {
    repeatJavaReplacement = false;
    let instanceRegExp = /((?:'\d+'|\b[A-Za-z_$][\w$]*\s*(?:"[BC]\d+")*)\s*(?:\.\s*[A-Za-z_$][\w$]*\s*(?:"[BC]\d+"\s*)*)*)instanceof\s+([A-Za-z_$][\w$]*\s*(?:\.\s*[A-Za-z_$][\w$]*)*)/g;
    s = s.replace(instanceRegExp, replaceInstanceof);
  } while (repeatJavaReplacement);

  // this() -> $constr()
  let thisRegExp = /\bthis(\s*"B\d+")/g;
  s = s.replace(thisRegExp, "$$constr$1");

  return s;
};
