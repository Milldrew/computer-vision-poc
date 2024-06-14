import {Component} from '@angular/core';
import {ComputerVisionService} from './computer-vision.service';
import * as bodySegmentation from '@tensorflow-models/body-segmentation';
import {Color} from '@tensorflow-models/body-segmentation/dist/body_pix/impl/types';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(private computerVisionService: ComputerVisionService) {
    setUpStream();
  }
}

function setUpStream() {
  document.addEventListener('DOMContentLoaded', async () => {


    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    //@ts-ignore
    const offScreenContext = canvas.getContext('2d');
    const output = document.getElementById('output');
    //@ts-ignore
    const outputStreamElement = output.getContext('2d');
    const width = 640;
    const height = 480;

    //@ts-ignore
    video.width = canvas.width = output.width = width;
    //@ts-ignore
    video.height = canvas.height = output.height = height;

    // Load BodySegmentation model
    console.log(bodySegmentation, 'bodySegmentation');
    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
    const segmenterConfig: bodySegmentation.MediaPipeSelfieSegmentationTfjsModelConfig
      = {
      runtime: 'tfjs',
    };
    const segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);

    // Check if the browser supports media devices
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // Access the user's camera and stream video
      navigator.mediaDevices.getUserMedia({video: true, audio: false})
        .then(stream => {
          //@ts-ignore
          video.srcObject = stream;
          //@ts-ignore
          video.play();
          processVideo();
        })
        .catch(err => {
          console.error('Error accessing media devices.', err);
        });
    } else {
      console.error('Media devices not supported by this browser.');
    }


    async function processVideo() {
      offScreenContext.drawImage(video, 0, 0, width, height);
      const imageData = offScreenContext.getImageData(0, 0, width, height);
      const segmentation = await segmenter.segmentPeople(imageData).catch(err => {
        console.error('Error segmenting people.', err);
      })
      console.log(11)
      console.log(segmentation, 'segmentation')
      if (!segmentation || Array.isArray(segmentation) && segmentation.length === 0) {
        throw new Error('No person detected');
      }
      function valueToColor(value: number): Color {
        console.log(value, 'value')
        return {r: value, g: value, b: value, a: 255};
      }
      const mask = await bodySegmentation.toBinaryMask(segmentation);
      const frame = offScreenContext.getImageData(0, 0, width, height);
      const pixelData = frame.data;
      const maskPixels = new Uint8ClampedArray(mask.data)

      for (let i = 0; i < pixelData.length; i += 4) {
        const maskIndex = i / 4;
        if (maskPixels[maskIndex] === 0) {
          pixelData[i] = pixelData[i + 1] = pixelData[i + 2] = pixelData[i + 3] = 0;
          // pixelData[i] = pixelData[i + 1] = pixelData[i + 2] = 0;
        }
      }

      let coloredPart = await bodySegmentation.toBinaryMask(segmentation)
      let opacity = 1;
      let flipHorizontal = false;
      let maskBlurAmount = 0;
      // bodySegmentation.drawMask(outputStreamElement, frame, mask, opacity, maskBlurAmount, flipHorizontal);
      outputStreamElement.putImageData(frame, 0, 0);
      requestAnimationFrame(processVideo);
      console.log(3)
    }
  });



}
