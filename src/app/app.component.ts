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
  isLoading = true;

  cocoSsdModel: cocoSsd.ObjectDetection;
  cocoSsdModelLoaded = false;
  async ngAfterContentInit() {
    this.cocoSsdModel = await cocoSsd.load();
    this.cocoSsdModelLoaded = true;
  }
  async ngAfterViewInit() {
    const width = 640;
    const height = 480;
    // const width = 160;
    // const height = 120;
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

    setTimeout(() => {
      this.isLoading = false;
    }, 2000);
    async function processVideo(cocoSsdModel: cocoSsd.ObjectDetection) {
      if (!cocoSsdModel) {
        requestAnimationFrame(() => processVideo(cocoSsdModel));
        return;
      }

      const person = await createPerson(cocoSsdModel, video, offScreenContext) as cocoSsd.DetectedObject;

      offScreenContext.drawImage(video, 0, 0, width, height);

      const frame = offScreenContext.getImageData(0, 0, width, height);
      if (person) {
        // removeTheBackground(frame, person);
      }
      outputStreamElement.putImageData(frame, 0, 0);

      if (person) {
        addCrownToPerson(person, outputStreamElement);
      }


      requestAnimationFrame(() => processVideo(cocoSsdModel));
    }
  }
}

function getElementsAndContexts(width: number, height: number) {
  const video = document.getElementById('video') as HTMLVideoElement;
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const output = document.getElementById('output') as HTMLCanvasElement;
  const offScreenContext = canvas.getContext('2d',
    {
      willReadFrequently: true
    }
  ) as CanvasRenderingContext2D;
  const outputStreamElement = output.getContext('2d') as CanvasRenderingContext2D;
  video.width = canvas.width = output.width = width;
  video.height = canvas.height = output.height = height;

  return {video, canvas, output, offScreenContext, outputStreamElement};

}


function addCrownToPerson(person: any, outputStreamElement: CanvasRenderingContext2D) {
  const [personX, personY, personWidth, personHeight] = person.bbox;

  const scaleDown = 0.1;
  const crown = new Image();
  crown.src = 'crown.1024.995.svg';
  crown.width *= scaleDown;
  crown.height *= scaleDown;
  const crownX = personX + personWidth / 2 - crown.width / 2;
  crown.width += personWidth * 0.1;
  crown.height += personWidth * 0.1;
  const crownY = personY - crown.height + 35;

  outputStreamElement.drawImage(crown, crownX, crownY, crown.width, crown.height);
}

async function createPerson(cocoSsdModel: cocoSsd.ObjectDetection, video: HTMLVideoElement, offScreenContext: CanvasRenderingContext2D) {
  const predictions = await cocoSsdModel.detect(video).catch(console.error);
  if (!predictions || predictions.length === 0) {
    return;
  }
  predictions
  debugger;
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

function removeTheBackground(frame: ImageData, person: cocoSsd.DetectedObject) {
  const [personX, personY, personWidth, personHeight] = person.bbox;
  const frameData = frame.data;
  for (let i = 0; i < frameData.length; i += 4) {
    const x = i / 4 % frame.width;
    const y = i / 4 / frame.width;
    const isPerson = x > personX && x < personX + personWidth && y > personY && y < personY + personHeight
    if (!isPerson) {
      frameData[i + 3] = 20;
    }
  }
}
