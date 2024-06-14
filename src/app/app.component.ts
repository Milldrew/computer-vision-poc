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
  ngAfterViewInit() {
    //add image to background
    // const body = document.getElementsByTagName('body')[0];
    // body.style.backgroundImage = 'url(crown.1024.995.svg)';
  }
  ngOnInit() {
  }
  //@ts-ignore
  cocoSsdModel = cocoSsd.load();
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

    //@ts-ignore
    let cocoSsdModel;


    async function processVideo() {
      //@ts-ignore
      if (!cocoSsdModel) {
        //@ts-ignore
        cocoSsdModel = await cocoSsd.load();
      }


      const predictions = await cocoSsdModel.detect(video).catch(console.error);
      //@ts-ignore
      const person = predictions.find(prediction => prediction.class === 'person');
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
      const mask = await bodySegmentation.toBinaryMask(segmentation)

      debugger;
      const frame = offScreenContext.getImageData(0, 0, width, height);
      const pixels = frame.data;
      const maskPixels = new Uint8ClampedArray(mask.data)
      debugger;
      console.log(pixels, 'pixels')

      for (let redIndex = 0; redIndex < pixels.length; redIndex += 4) {
        if (maskPixels[redIndex + 3] === 0) {
          pixels[redIndex + 3] *= 0.9;
        } else {
          pixels[redIndex] = 255;
          pixels[redIndex + 1] = 255;
          pixels[redIndex + 2] = 255;
          pixels[redIndex + 3] = 255;
          // pixels[redIndex + 3] = 255;

        }
      }

      let coloredPart = document.getElementById('canvas');
      let opacity = 1;
      let flipHorizontal = false;
      let maskBlurAmount = 0;
      // const combineFrameAndMask = bodySegmentation.drawMask(outputStreamElement,
      // coloredPart, maskImageData, opacity, maskBlurAmount, flipHorizontal);
      // outputStreamElement.putImageData(mask, 0, 0);
      outputStreamElement.putImageData(frame, 0, 0);


      /// add crown
      // const crownWidth = 1024;
      // const crownHeight = 995;
      if (person) {


        const [personX, personY, personWidth, personHeight] = person.bbox;

        const scaleDown = 0.1;
        const crown = new Image();
        crown.src = 'crown.1024.995.svg';
        crown.width *= scaleDown;
        crown.height *= scaleDown;
        const crownX = personX + personWidth / 2 - crown.width / 2;
        const crownY = personY - crown.height + 35;
        // crown.width += personWidth;
        // crown.height += personWidth

        outputStreamElement.drawImage(crown, crownX, crownY, crown.width, crown.height);
        // outputStreamElement.drawImage(crown, topOfheadCoordinate.x, topOfheadCoordinate.y, crown.width * scaleDown, crown.height * scaleDown)


      }




      requestAnimationFrame(processVideo);
      console.log(3)
    }
  });
}


