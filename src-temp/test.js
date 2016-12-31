// SIMPLE CODE TEST

import convert from "./convert";

var converted = convert(`
  import test.something; \
\
  class Cake { \
    int a = 0; \
    boolean test(boolean okay) { \
      return true; \
    } \
    static boolean test2(boolean okay) { \
      return false; \
    } \
  } \
\
  void setup() { \
    Cake c = new Cake(); \
    noLoop(); \
  } \
\
  void draw() { \
    background(255); \
  } \
`);

console.log(converted.sourceCode);
