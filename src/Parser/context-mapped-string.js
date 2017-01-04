export default function contextMappedString(array, replaceContext, glue) {
  return array.map( e => e.toString(replaceContext)).join(glue);
};
