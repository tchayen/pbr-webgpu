import { Vec2 } from "./math/Vec2";
import { Vec3 } from "./math/Vec3";

export type FaceVertex = {
  vertexIndex: number;
  uvIndex: number;
  normalIndex: number;
};

export type Face = {
  vertices: FaceVertex[];
};

export type ObjData = {
  vertices: Vec3[];
  uvs: Vec2[];
  normals: Vec3[];
  faces: Face[];
};

export function parseObjFile(objFileContents: string): ObjData {
  const vertices: Vec3[] = [];
  const uvs: Vec2[] = [];
  const normals: Vec3[] = [];
  const faces: Face[] = [];

  const lines = objFileContents.split("\n");
  for (const line of lines) {
    const t = line.trim().split(/\s+/);
    if (t[0] === "v") {
      vertices.push(
        new Vec3(parseFloat(t[1]), parseFloat(t[2]), parseFloat(t[3]))
      );
    } else if (t[0] === "vt") {
      uvs.push(new Vec2(parseFloat(t[1]), parseFloat(t[2])));
    } else if (t[0] === "vn") {
      normals.push(
        new Vec3(parseFloat(t[1]), parseFloat(t[2]), parseFloat(t[3]))
      );
    } else if (t[0] === "f") {
      const face: FaceVertex[] = [];
      for (let i = 1; i < t.length; i += 1) {
        const v = t[i].split("/");
        const vertexIndex = parseInt(v[0]) - 1;
        const uvIndex = parseInt(v[1]) - 1;
        const normalIndex = parseInt(v[2]) - 1;
        face.push({ vertexIndex, uvIndex, normalIndex });
      }
      faces.push({ vertices: face });
    }
  }

  return { vertices, uvs, normals, faces };
}
