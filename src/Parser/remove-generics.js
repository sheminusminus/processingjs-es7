// removes generics
export default function removeGenerics(codeWoStrings) {
	let genericsWereRemoved;
	let codeWoGenerics = codeWoStrings;

	let replaceFunc = function(all, before, types, after) {
	  if(!!before || !!after) {
	    return all;
	  }
	  genericsWereRemoved = true;
	  return "";
	};

  let regExp = /([<]?)<\s*((?:\?|[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)(?:\[\])*(?:\s+(?:extends|super)\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)?(?:\s*,\s*(?:\?|[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)(?:\[\])*(?:\s+(?:extends|super)\s+[A-Za-z_$][\w$]*\b(?:\s*\.\s*[A-Za-z_$][\w$]*\b)*)?)*)\s*>([=]?)/g;

	do {
	  genericsWereRemoved = false;
	  codeWoGenerics = codeWoGenerics.replace(regExp, replaceFunc);
	} while (genericsWereRemoved);

	return codeWoGenerics
}
