import {Component} from '@angular/core';
import {ComputerVisionService} from './computer-vision.service';
import * as bodySegmentation from '@tensorflow-models/body-segmentation';
import {Color} from '@tensorflow-models/body-segmentation/dist/body_pix/impl/types';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(private computerVisionService: ComputerVisionService) {
  }
  //@ts-ignore
  cocoSsdModel;
  cocoSsdModelLoaded = false;
  async ngAfterContentInit() {
    this.cocoSsdModel = await cocoSsd.load();
    this.cocoSsdModelLoaded = true;
  }
  async ngAfterViewInit() {
    const width = 640;
    const height = 480;
    const {video, canvas, output, offScreenContext, outputStreamElement} = getElementsAndContexts(width, height)


    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
    const segmenterConfig: bodySegmentation.MediaPipeSelfieSegmentationTfjsModelConfig
      = {
      runtime: 'tfjs',
    };
    const segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);
    // Check if the browser supports media devices
    //@ts-ignore
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {

      //@ts-ignore
      getMedia(video).then(() => {
        processVideo(this.cocoSsdModel);
      }).catch(err => {
        console.error('Error accessing media devices.', err);
        alert(`${err}`)
      })
    } else {
      alert('media devices not supported')
      console.error('Media devices not supported by this browser.');
      //@ts-ignore
      getMedia(video).then(() => {
        processVideo(this.cocoSsdModel);
      }).catch(err => {
        console.error('Error accessing media devices.', err);
        alert(`${err}`)
      })


    }

    //@ts-ignore
    let cocoSsdModel;

    async function processVideo(cocoSsdModel: any) {
      requestAnimationFrame(() => processVideo(cocoSsdModel));
      if (!cocoSsdModel) {
        return;
      }

      //@ts-ignore
      const person = await createPerson(cocoSsdModel, video, offScreenContext);

      offScreenContext.drawImage(video, 0, 0, width, height);
      const imageData = offScreenContext.getImageData(0, 0, width, height);
      const segmentation = await segmenter.segmentPeople(imageData).catch(err => {
        console.error('Error segmenting people.', err);
      })
      if (!segmentation || Array.isArray(segmentation) && segmentation.length === 0) {
        throw new Error('No person detected');
      }
      const mask = await bodySegmentation.toBinaryMask(segmentation)

      const frame = offScreenContext.getImageData(0, 0, width, height);
      const pixels = frame.data;
      const maskPixels = new Uint8ClampedArray(mask.data)
      convertPixelsUsingMask(pixels, maskPixels);

      outputStreamElement.putImageData(frame, 0, 0);
      if (person) {
        addCrownToPerson(person, outputStreamElement);
      }
    }
  }
}

function getElementsAndContexts(width: number, height: number) {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const output = document.getElementById('output');
  //@ts-ignore
  const offScreenContext = canvas.getContext('2d');
  //@ts-ignore
  const outputStreamElement = output.getContext('2d');
  //@ts-ignore
  video.width = canvas.width = output.width = width;
  //@ts-ignore
  video.height = canvas.height = output.height = height;

  return {video, canvas, output, offScreenContext, outputStreamElement};

}

function convertPixelsUsingMask(pixels: Uint8ClampedArray, maskPixels: Uint8ClampedArray) {
  for (let redIndex = 0; redIndex < pixels.length; redIndex += 4) {
    if (maskPixels[redIndex + 3] === 0) {
      pixels[redIndex + 3] *= 0.9;
    } else {
      pixels[redIndex] = 0;
      pixels[redIndex + 1] = 0;
      pixels[redIndex + 2] = 0;
      pixels[redIndex + 3] = 255;
      // pixels[redIndex] = 255;
      // pixels[redIndex + 1] = 255;
      // pixels[redIndex + 2] = 255;
      // pixels[redIndex + 3] = 255;
      // pixels[redIndex + 3] = 255;

    }
  }
}

function addCrownToPerson(person: any, outputStreamElement: CanvasRenderingContext2D) {
  const [personX, personY, personWidth, personHeight] = person.bbox;

  const scaleDown = 0.1;
  const crown = new Image();
  crown.src = 'crown.1024.995.svg';
  crown.width *= scaleDown;
  crown.height *= scaleDown;
  const crownX = personX + personWidth / 2 - crown.width / 2;
  const crownY = personY - crown.height + 35;

  outputStreamElement.drawImage(crown, crownX, crownY, crown.width, crown.height);
}

async function createPerson(cocoSsdModel: any, video: HTMLVideoElement, offScreenContext: CanvasRenderingContext2D) {
  const predictions = await cocoSsdModel.detect(video).catch(console.error);
  //@ts-ignore
  return predictions.find(prediction => prediction.class === 'person');
}
async function getMedia(video: HTMLVideoElement) {
  const constraints = {
    audio: false,
    video: {
      facingMode: 'user'
    }
  }
  return new Promise((resolve, reject) => {
    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        video.srcObject = stream;
        video.play();
        resolve(video);
      })
      .catch(err => {
        console.error('Error accessing media devices.', err);
        reject(err);
      });
  });
}
