import { SelfieSegmentation } from "../node_modules/@mediapipe/selfie_segmentation";
import imageList from "./imageList";
import "./style.scss";

let globalController = null;
let timestamp = null;
let stream = null;
let customBackgroundImage = new Image();

const canvasElement = new OffscreenCanvas(640, 480);
const canvasCtx = canvasElement.getContext("2d");
const selfieSegmentation = new SelfieSegmentation({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
  },
});

selfieSegmentation.setOptions({
  modelSelection: 1,
});
selfieSegmentation.onResults(onResults);

const $localVideo = document.querySelector(".localVideo");
const $turnCameraOnButton = document.querySelector(".turnCameraOnButton");
const $turnCameraOffButton = document.querySelector(".turnCameraOffButton");
const $removeBackgroundButton = document.querySelector(
  ".removeBackgroundButton"
);
const $sectionCustomImages = document.querySelector(".sectionCustomImages");

init();

function init() {
  $sectionCustomImages.innerHTML = renderImageItem(imageList);
  bindEventListeners();
}

function bindEventListeners() {
  $turnCameraOnButton.addEventListener("click", turnOnCamera);
  $removeBackgroundButton.addEventListener("click", setVirtualBackground);
  $turnCameraOffButton.addEventListener("click", turnOffCamera);
  const [...$customImages] =
    $sectionCustomImages.querySelectorAll(".customImage");
  $customImages.map((item, index) =>
    item.addEventListener("click", changeBackground(imageList[index].url))
  );
}

function renderImageItem(imageList) {
  return imageList.reduce(
    (acc, curr) =>
      acc +
      `<div class="customImage">
        <img
          src="${curr.url}"
          alt="${curr.alt}"
        />
      </div>`,
    ""
  );
}

async function turnOnCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
    });

    $localVideo.srcObject = stream;
  } catch (error) {
    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      alert("Permission denied error");
    } else {
      alert("error");
    }
  }
}

function turnOffCamera() {
  stream.getVideoTracks().map((track) => track.stop());
}

async function setVirtualBackground() {
  const transformedStream = await transformGetUserMediaStream();
  $localVideo.srcObject = transformedStream;
}

function changeBackground(imageUrl) {
  return () => {
    customBackgroundImage.src = imageUrl;
    canvasCtx.drawImage(
      customBackgroundImage,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );
  };
}

async function transformGetUserMediaStream() {
  const videoTrack = stream.getVideoTracks()[0];
  const trackProcessor = new MediaStreamTrackProcessor({ track: videoTrack });
  const trackGenerator = new MediaStreamTrackGenerator({ kind: "video" });
  customBackgroundImage.src = imageList[0].url;

  const transformer = new TransformStream({
    async transform(videoFrame, controller) {
      globalController = controller;
      timestamp = videoFrame.timestamp;
      videoFrame.width = 640;
      videoFrame.height = 480;
      await selfieSegmentation.send({ image: videoFrame });

      videoFrame.close();
      console.log("transform");
    },
  });

  trackProcessor.readable
    .pipeThrough(transformer)
    .pipeTo(trackGenerator.writable);

  const transformedStream = new MediaStream([trackGenerator]);
  return transformedStream;
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.segmentationMask,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  canvasCtx.globalCompositeOperation = "source-out";
  canvasCtx.drawImage(
    customBackgroundImage,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  // Only overwrite missing pixels.
  canvasCtx.globalCompositeOperation = "destination-atop";
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  canvasCtx.restore();
  globalController.enqueue(
    new VideoFrame(canvasElement, { timestamp, alpha: "discard" })
  );
}
