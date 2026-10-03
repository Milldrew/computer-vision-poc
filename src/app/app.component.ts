import { Component, NgZone, OnDestroy } from '@angular/core';
import * as bodySegmentation from '@tensorflow-models/body-segmentation';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

type State = 'idle' | 'loading' | 'running' | 'no-camera' | 'denied' | 'unsupported' | 'error';

/** Processing size. 320x240 is sharp at the 600px display width and still fast. */
const WIDTH = 320;
const HEIGHT = 240;
/**
 * Person detection (COCO-SSD) is the expensive model and a person's box moves
 * slowly, so it runs every few frames and the last box is reused in between.
 * Segmentation still runs every frame, so the cut-out stays tight.
 */
const DETECT_EVERY = 6;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnDestroy {
  state: State = 'idle';
  /** 255 hides the background completely; lower lets it show through. */
  opacity = 255;

  private stream?: MediaStream;
  private running = false;
  private crown = new Image();

  constructor(private zone: NgZone) {
    // Load the crown once, up front. (It used to be created - and drawn before
    // it had loaded, at zero size - on every frame, so it never appeared.)
    this.crown.src = 'crown.1024.995.svg';
  }

  /** Runs only when the visitor asks: no camera prompt on page load. */
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.state = 'unsupported';
      return;
    }
    this.state = 'loading';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
    } catch (err: any) {
      this.state = err?.name === 'NotAllowedError' ? 'denied' : err?.name === 'NotFoundError' ? 'no-camera' : 'error';
      return;
    }
    try {
      const [segmenter, detector] = await Promise.all([
        bodySegmentation.createSegmenter(bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation, {
          runtime: 'tfjs',
        }),
        cocoSsd.load({ base: 'lite_mobilenet_v2' }),
      ]);
      const video = document.getElementById('video') as HTMLVideoElement;
      video.srcObject = this.stream;
      await video.play();
      this.state = 'running';
      this.running = true;
      // The frame loop needs no change detection; keep it outside Angular.
      this.zone.runOutsideAngular(() => this.loop(video, segmenter, detector));
    } catch (err) {
      console.error(err);
      this.stop();
      this.state = 'error';
    }
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.state = 'idle';
  }

  ngOnDestroy() {
    this.stop();
  }

  private async loop(video: HTMLVideoElement, segmenter: bodySegmentation.BodySegmenter, detector: cocoSsd.ObjectDetection) {
    const work = document.getElementById('canvas') as HTMLCanvasElement;
    const output = document.getElementById('output') as HTMLCanvasElement;
    work.width = output.width = WIDTH;
    work.height = output.height = HEIGHT;
    const workCtx = work.getContext('2d', { willReadFrequently: true })!;
    const outCtx = output.getContext('2d')!;
    let frameNo = 0;
    let person: cocoSsd.DetectedObject | undefined;

    const tick = async () => {
      if (!this.running) return;
      // Current frame first, then every model looks at that same frame.
      workCtx.drawImage(video, 0, 0, WIDTH, HEIGHT);
      const frame = workCtx.getImageData(0, 0, WIDTH, HEIGHT);
      const segmentation = await segmenter.segmentPeople(frame, { flipHorizontal: false });
      const mask = await bodySegmentation.toBinaryMask(segmentation);
      if (frameNo++ % DETECT_EVERY === 0) {
        const found = await detector.detect(work, 3);
        person = found.find((p) => p.class === 'person' && p.score > 0.5);
      }
      hideBackground(frame, mask, this.opacity);
      outCtx.putImageData(frame, 0, 0);
      if (person) drawCrown(outCtx, this.crown, person.bbox);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

/** Fades every pixel the mask marks as background, by the slider's amount. */
function hideBackground(frame: ImageData, mask: ImageData, opacity: number) {
  const f = frame.data;
  const m = mask.data;
  for (let i = 0; i < f.length; i += 4) {
    if (m[i + 3] !== 0) f[i + 3] = 255 - opacity;
  }
}

/** Sits the crown on the top of the person's box, about half its width. */
function drawCrown(ctx: CanvasRenderingContext2D, crown: HTMLImageElement, bbox: number[]) {
  if (!crown.complete || !crown.naturalWidth) return;
  const [x, y, w] = bbox;
  const width = w * 0.5;
  const height = width * (crown.naturalHeight / crown.naturalWidth);
  // The box's top is the top of the head; sink the crown into the hair a little.
  ctx.drawImage(crown, x + w / 2 - width / 2, Math.max(0, y - height * 0.75), width, height);
}
