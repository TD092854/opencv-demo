const input = document.getElementById("input");
const output = document.getElementById("output");
const outputContext = output.getContext("2d");

const resolution = DEFAULT_RESOLUTION;

prepareOutput(output, resolution);

let openCV = null;
let stream = null;
let processingCanvas = null;
let processingCanvasContext = null;
let srcMat = null;
let grayMat = null;

async function start() {
  openCV = await loadOpenCV();
  stream = await startCamera(resolution);
  await playStream(input, stream);
  startProcessing();

  setLoading(false);
}

//#region OpenCV

function startProcessing() {
  processingCanvas = createProcessingCanvas(resolution);
  processingCanvasContext = processingCanvas.getContext("2d");

  srcMat = new openCV.Mat(resolution.height, resolution.width, openCV.CV_8UC4);
  grayMat = new openCV.Mat(resolution.height, resolution.width, openCV.CV_8UC1);

  requestAnimationFrame(processVideo);
}

function processVideo() {
  const begin = Date.now();
  const circleMat = new openCV.Mat();

  // Prepare the frame.
  processingCanvasContext.drawImage(input, 0, 0, resolution.width, resolution.height);
  const imageData = processingCanvasContext.getImageData(0, 0, resolution.width, resolution.height);
  srcMat.data.set(imageData.data);

  // Convert to grayscale.
  openCV.cvtColor(srcMat, grayMat, openCV.COLOR_RGBA2GRAY);
  // Downsample because we have big image.
  openCV.pyrDown(grayMat, grayMat);
  // Blur the image to reduce noise.
  openCV.medianBlur(grayMat, grayMat, 5);

  // Detect circles.
  // Params:
  // 4: dp - Inverse ratio of the accumulator resolution to the image resolution, 1 = same as input, 2 = half the input.
  // 5: minDist - Minimum distance between the centers of the circles.
  // 6: highThreshold - High threshold for the Canny edge detector (low is half).
  // 7: accumulatorThreshold - Accumulator threshold for the circle centers, smaller means more false circle may be detected.
  //    Circles with the largest accumulator will be returned first.
  // 8: Minimum circle radius.
  // 9: Maximum cirlce radius.
  openCV.HoughCircles(grayMat, circleMat, openCV.HOUGH_GRADIENT, 1, 35, 150, 25, 5, 40);
  
  // Draw.
  outputContext.drawImage(processingCanvas, 0, 0, resolution.width, resolution.height);
  drawCircles(circleMat, grayMat.size());
  drawFPS(output, Date.now() - begin);

  // Cleanup.
  circleMat.delete();
  // Schedule a new render.
  requestAnimationFrame(processVideo);
}

//#endregion

//#region Canvas 

function drawCircles(circleMat, detectionSize) {
  const xRatio = resolution.width / detectionSize.width;
  const yRatio = resolution.height / detectionSize.height;

  for (let i = 0; i < circleMat.cols; ++i) {
    const index = i * 3;
    const x = circleMat.data32F[index] * xRatio;
    const y = circleMat.data32F[index + 1] * yRatio;
    const radius = circleMat.data32F[index + 2] * ((xRatio + yRatio) / 2);

    outputContext.beginPath();
    outputContext.arc(x, y, radius, 0, Math.PI * 2);
    outputContext.stroke();
  }
}

//#endregion
