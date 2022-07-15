import React, { useState, useEffect } from 'react';
import './App.css'
import Webcam from "react-webcam";
import cv from "@techstark/opencv-js"
import {AR} from "js-aruco"

function App() {

  const webcamRef = React.useRef(null);
  const videoConstraints = {
    height: 720,
    width: 1200,
    // My external cam deviceId.
    // deviceId: "a97bd76dd673920b79ce367c49f172e4a76a3f968b205819dc73f01e52d79d19",
    facingMode: "environment",
    screenshotQuality: 1
  };
  const ghostCanvas = document.createElement("canvas");

  function drawCorners(markers, context){
    var corners, corner, i, j;
  
    context.lineWidth = 3;

    for (i = 0; i !== markers.length; ++ i){
      corners = markers[i].corners;
      
      context.strokeStyle = "red";
      context.beginPath();
      
      for (j = 0; j !== corners.length; ++ j){
        corner = corners[j];
        context.moveTo(corner.x, corner.y);
        corner = corners[(j + 1) % corners.length];
        context.lineTo(corner.x, corner.y);
      }

      context.stroke();
      context.closePath();
      
      context.strokeStyle = "green";
      context.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);
    }
  }

  function drawId(markers, context){
    var corners, corner, x, y, i, j;
    
    context.strokeStyle = "blue";
    context.lineWidth = 1;
    
    for (i = 0; i !== markers.length; ++ i){
      corners = markers[i].corners;
      
      x = Infinity;
      y = Infinity;
      
      for (j = 0; j !== corners.length; ++ j){
        corner = corners[j];
        
        x = Math.min(x, corner.x);
        y = Math.min(y, corner.y);
      }

      context.strokeText(markers[i].id, x, y)
    }
  }

  async function startProcess() {
    var mainCanvas = document.getElementById("mainCanvas");
    var mainCtx = mainCanvas.getContext("2d");
    var ghostCtx = ghostCanvas.getContext("2d");
    var videoWidth = webcamRef.current.video.videoWidth;
    var videoHeight = webcamRef.current.video.videoHeight;

    if (mainCanvas.width != videoWidth || mainCanvas.height != videoHeight) {
      mainCanvas.width = videoWidth;
      mainCanvas.height = videoHeight;
      ghostCanvas.width = videoWidth;
      ghostCanvas.height = videoHeight;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    var image = new Image;

    image.onload = function () {
      ghostCtx.clearRect(
        0,
        0,
        videoWidth,
        videoHeight
      );

      ghostCtx.drawImage(image, 0, 0, videoWidth, videoHeight);
    
      mainCtx.clearRect(
        0,
        0,
        mainCanvas.width,
        mainCanvas.height
      );
      
      // These are my defaults.
      // var topLeftAruco = [90, 10];
      // var topRightAruco = [310, 220];
      // var bottomRightAruco = [270, 540];
      // var bottomLeftAruco = [5, 480];

      var topLeftAruco = [0, 0];
      var topRightAruco = [0, 0];
      var bottomRightAruco = [0, 0];
      var bottomLeftAruco = [0, 0];

      var cameraImageData = ghostCtx.getImageData(0, 0, videoWidth, videoHeight);
      var detector = new AR.Detector();
      var markers = detector.detect(cameraImageData);

      if (markers.length > 3) {
        markers.forEach(marker => {
          var sumX = 0;
          var sumY = 0;
          marker.corners.forEach(corner => {
            sumX += corner.x;
            sumY += corner.y;
          });
          var centerX =sumX / 4;
          var centerY =sumY / 4;

          if (marker.id == 819) {
            topLeftAruco = [centerX, centerY];
          }
          else if (marker.id == 273) {
            topRightAruco = [centerX, centerY];
          }
          else if (marker.id == 61) {
            bottomLeftAruco = [centerX, centerY];
          }
          else if (marker.id == 922) {
            bottomRightAruco = [centerX, centerY];
          }
        });
      }
      else {
        mainCtx.font = "20px Arial";
        mainCtx.fillStyle = "green";
        mainCtx.textAlign = "center";

        mainCtx.fillText("Make sure the camera reads all Aruco markers!", videoWidth / 2, videoHeight / 2);
      }
      
      drawCorners(markers, mainCtx);
      drawId(markers, mainCtx);

      mainCtx.lineWidth = 3;
      mainCtx.strokeStyle = "red";

      mainCtx.beginPath();
      mainCtx.moveTo(topLeftAruco[0], topLeftAruco[1]);
      mainCtx.lineTo(topRightAruco[0], topRightAruco[1]);
      mainCtx.lineTo(bottomRightAruco[0], bottomRightAruco[1]);
      mainCtx.lineTo(bottomLeftAruco[0], bottomLeftAruco[1]);
      mainCtx.lineTo(topLeftAruco[0], topLeftAruco[1]);
      mainCtx.stroke();

      var src = cv.matFromImageData(cameraImageData);
      let dst = new cv.Mat();
      let dsize = new cv.Size(500, 500);
      let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [topLeftAruco[0], topLeftAruco[1], topRightAruco[0], topRightAruco[1], bottomLeftAruco[0], bottomLeftAruco[1], bottomRightAruco[0], bottomRightAruco[1]]);
      let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 500, 0, 0, 500, 500, 500]);
      let M = cv.getPerspectiveTransform(srcTri, dstTri);
      cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
      cv.imshow('secondCanvas', dst);
      src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();

      setTimeout(() => startProcess(), 10);
    }

    image.src = imageSrc;

  };

  useEffect(() => {
    function checkWebcam() {
      if (webcamRef.current.getScreenshot() == null) {
        setTimeout(() => checkWebcam(), 10);
      }
      else {
        startProcess();
      }
    }
    checkWebcam();
  })

  return (

    <div>
      <div style={{ position: "absolute" }}>
        <Webcam
          audio={false}
          id="img"
          ref={webcamRef}
          forceScreenshotSourceSize={true}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          mirrored={false}
        />
      </div>
      <div style={{ position: "absolute"/*, marginTop: "720px"*/ }}>
        <canvas
          id="mainCanvas"
          width={720}
          height={1200}
          style={{ backgroundColor: "transparent" }}
        />
      </div>
      <div style={{ position: "absolute", marginLeft: "720px" }}>
        <canvas
          id="secondCanvas"
          width={500}
          height={500}
          style={{ backgroundColor: "transparent" }}
        />
      </div>
    </div>
  );
}

export default App;