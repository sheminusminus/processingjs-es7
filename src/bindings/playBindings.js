/**
 * This function takes a sketch and gives it all its "play"
 * bindings. This is done using a wrapper function because there
 * are several shared variables that these Processing calls use
 * that we do not want to expose through the sketch itself, and
 * so do NOT want added wholesale to the DefaultScope object.
 */
export default function playBindings(p, hooks) {
  let timeSinceLastFPS = 0,
      framesSinceLastFPS = 0,
      doLoop = true,
      loopStarted = false,
      looping = false,
      curFrameRate = 60,
      curMsPerFrame = 1000 / curFrameRate;

  /**
  * Executes the code within draw() one time. This functions allows the program to update
  * the display window only when necessary, for example when an event registered by
  * mousePressed() or keyPressed() occurs.
  * In structuring a program, it only makes sense to call redraw() within events such as
  * mousePressed(). This is because redraw() does not run draw() immediately (it only sets
  * a flag that indicates an update is needed).
  * Calling redraw() within draw() has no effect because draw() is continuously called anyway.
  *
  * @returns none
  *
  * @see noLoop
  * @see loop
  */
  function redrawHelper() {
    let sec = (Date.now() - timeSinceLastFPS) / 1000;
    framesSinceLastFPS++;
    let fps = framesSinceLastFPS / sec;
    // recalculate FPS every half second for better accuracy.
    if (sec > 0.5) {
      timeSinceLastFPS = Date.now();
      framesSinceLastFPS = 0;
      // mask the framerate as __frameRate, because of p.frameRate()
      p.__frameRate = fps;
    }
    p.frameCount++;
  }

  /**
  * Stops Processing from continuously executing the code within draw(). If loop() is
  * called, the code in draw() begin to run continuously again. If using noLoop() in
  * setup(), it should be the last line inside the block.
  * When noLoop() is used, it's not possible to manipulate or access the screen inside event
  * handling functions such as mousePressed() or keyPressed(). Instead, use those functions
  * to call redraw() or loop(), which will run draw(), which can update the screen properly.
  * This means that when noLoop() has been called, no drawing can happen, and functions like
  * saveFrame() or loadPixels() may not be used.
  * Note that if the sketch is resized, redraw() will be called to update the sketch, even
  * after noLoop() has been specified. Otherwise, the sketch would enter an odd state until
  * loop() was called.
  *
  * @returns none
  *
  * @see redraw
  * @see draw
  * @see loop
  */
  p.noLoop = function() {
    doLoop = false;
    loopStarted = false;
    clearInterval(looping);
    hooks.onPause();
  };

  /**
  * Causes Processing to continuously execute the code within draw(). If noLoop() is called,
  * the code in draw() stops executing.
  *
  * @returns none
  *
  * @see noLoop
  */
  p.loop = function() {
    if (loopStarted) {
      return;
    }

    timeSinceLastFPS = Date.now();
    framesSinceLastFPS = 0;

    looping = window.setInterval(function() {
      try {
        hooks.onFrameStart();
        p.redraw();
        hooks.onFrameEnd();
      } catch(e_loop) {
        window.clearInterval(looping);
        throw e_loop;
      }
    }, curMsPerFrame);
    doLoop = true;
    loopStarted = true;
    hooks.onLoop();
  };

  /**
  * Specifies the number of frames to be displayed every second. If the processor is not
  * fast enough to maintain the specified rate, it will not be achieved. For example, the
  * function call frameRate(30) will attempt to refresh 30 times a second. It is recommended
  * to set the frame rate within setup(). The default rate is 60 frames per second.
  *
  * @param {int} aRate        number of frames per second.
  *
  * @returns none
  *
  * @see delay
  */
  p.frameRate = function(aRate) {
    curFrameRate = aRate;
    curMsPerFrame = 1000 / curFrameRate;

    // clear and reset interval
    if (doLoop) {
      p.noLoop();
      p.loop();
    }
  };

  p.redraw = function() {
    redrawHelper();

    // curContext.lineWidth = lineWidth;
    // var pmouseXLastEvent = p.pmouseX,
    //     pmouseYLastEvent = p.pmouseY;
    // p.pmouseX = pmouseXLastFrame;
    // p.pmouseY = pmouseYLastFrame;

    // saveContext();
    p.draw();
    // restoreContext();

    // pmouseXLastFrame = p.mouseX;
    // pmouseYLastFrame = p.mouseY;
    // p.pmouseX = pmouseXLastEvent;
    // p.pmouseY = pmouseYLastEvent;
  };

  // Internal function for kicking off the draw loop
  // for a sketch. Depending on whether a noLoop() was
  // issued during setup or initial draw, this might
  // do "nothing", other than record the sketch start.
  return function() {
    if (doLoop) {
      console.log("kicking off animation");
      p.loop();
    }
  }
};