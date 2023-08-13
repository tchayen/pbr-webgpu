import { GLTFDescriptor } from "../lib/gltfTypes";

export class Store {
  listeners: Array<() => void> = [];
  data: GLTFDescriptor | null = null;

  constructor() {
    this.setStore = this.setStore.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.getSnapshot = this.getSnapshot.bind(this);
  }

  setStore(gltf: GLTFDescriptor) {
    this.data = gltf;
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void) {
    this.listeners = [...this.listeners, listener];

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getSnapshot() {
    return this.data;
  }
}
