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
    canvas: HTMLCanvasElement,
    distance?: number,
  ) {
    canvas.addEventListener("mousedown", this.handleMouseDown);
    canvas.addEventListener("mousemove", this.handleMouseMove);
    canvas.addEventListener("mouseup", this.handleMouseUp);

    if (distance) {
      this.distance = distance;
    }
  }

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
