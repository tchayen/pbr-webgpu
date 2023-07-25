import { Mat4 } from "./math/Mat4";
import { Vec3 } from "./math/Vec3";

export class Camera {
  target = new Vec3(0, 0, 0);
  distance = 10;

  scrollDirection = 0;

  wheelTimeout: number | null = null;

  private lastX: number = 0;
  private lastY: number = 0;
  private isDragging: boolean = false;

  constructor(
    public pitch: number,
    public yaw: number,
    canvas?: HTMLCanvasElement,
    distance?: number,
  ) {
    (canvas ?? window).addEventListener("mousedown", this.handleMouseDown);
    (canvas ?? window).addEventListener("mousemove", this.handleMouseMove);
    (canvas ?? window).addEventListener("mouseup", this.handleMouseUp);
    (canvas ?? window).addEventListener("wheel", this.handleMouseWheel);

    if (distance) {
      this.distance = distance;
    }
  }

  handleMouseWheel = (event: WheelEvent) => {
    this.scrollDirection = Math.sign(event.deltaY);

    const zoomSpeed = 0.5;
    this.distance -= this.scrollDirection * zoomSpeed;

    const minDistance = 1;
    this.distance = Math.max(this.distance, minDistance);
  };

  handleMouseDown = (event: MouseEvent) => {
    this.isDragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  };

  handleMouseMove = (event: MouseEvent) => {
    if (!this.isDragging) return;

    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;

    this.lastX = event.clientX;
    this.lastY = event.clientY;

    this.pitch -= dy * 0.003;
    this.yaw -= dx * 0.003;
  };

  handleMouseUp = () => {
    this.isDragging = false;
  };

  getPosition(): Vec3 {
    return new Vec3(
      Math.cos(this.pitch) * Math.cos(this.yaw),
      Math.sin(this.pitch),
      Math.cos(this.pitch) * Math.sin(this.yaw),
    )
      .scale(this.distance)
      .add(this.target);
  }

  getView(): Mat4 {
    const position = this.getPosition();
    return Mat4.lookAt(position, this.target, new Vec3(0, 1, 0));
  }
}
