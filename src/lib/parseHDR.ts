// Based on https://github.com/vorg/parse-hdr
import { Float16Array } from "@petamoriken/float16";

let radiancePattern = "#\\?RADIANCE";
let commentPattern = "#.*";
let exposurePattern = "EXPOSURE=\\s*([0-9]*[.][0-9]*)";
let formatPattern = "FORMAT=32-bit_rle_rgbe";
let widthHeightPattern = "-Y ([0-9]+) \\+X ([0-9]+)";

export type HDRData = {
  width: number;
  height: number;
  exposure: number;
  gamma: number;
  data: Float16Array;
};

// Returns data as floats and flipped along Y by default
export function parseHDR(source: ArrayBuffer): HDRData {
  const buffer = new Uint8Array(source);

  let fileOffset = 0;
  const bufferLength = buffer.length;

  const NEW_LINE = 10;

  function readLine() {
    let line = "";
    while (++fileOffset < bufferLength) {
      let b = buffer[fileOffset];
      if (b == NEW_LINE) {
        fileOffset += 1;
        break;
      }
      line += String.fromCharCode(b);
    }
    return line;
  }

  let width = 0;
  let height = 0;
  let exposure = 1;
  let gamma = 1;
  let rle = false;

  for (let i = 0; i < 20; i++) {
    let line = readLine();
    let match;
    if ((match = line.match(radiancePattern))) {
    } else if ((match = line.match(formatPattern))) {
      rle = true;
    } else if ((match = line.match(exposurePattern))) {
      exposure = Number(match[1]);
    } else if ((match = line.match(commentPattern))) {
    } else if ((match = line.match(widthHeightPattern))) {
      height = Number(match[1]);
      width = Number(match[2]);
      break;
    }
  }

  let data = new Uint8Array(width * height * 4);
  let scanlineWidth = width;
  let scanlinesCount = height;

  readPixelsRawRLE(buffer, data, 0, fileOffset, scanlineWidth, scanlinesCount);

  let floatData = new Float16Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    let r = data[offset + 0] / 255;
    let g = data[offset + 1] / 255;
    let b = data[offset + 2] / 255;
    const e = data[offset + 3];
    const scale = Math.pow(2.0, e - 128.0);

    r *= scale;
    g *= scale;
    b *= scale;

    let floatOffset = offset;

    floatData[floatOffset + 0] = r;
    floatData[floatOffset + 1] = g;
    floatData[floatOffset + 2] = b;
    floatData[floatOffset + 3] = 1.0;
  }

  return {
    width,
    height,
    exposure,
    gamma,
    data: floatData,
  };
}

function readPixelsRawRLE(
  buffer: Uint8Array,
  data: Uint8Array,
  offset: number,
  fileOffset: number,
  scanlineWidth: number,
  scanlinesCount: number,
) {
  const rgbe = new Array<number>(4);
  let scanlineBuffer: number[] | null = null;
  let ptr;
  let ptr_end;
  let count;
  const twoBytes = new Array<number>(2);
  const bufferLength = buffer.length;

  function readBuf(buf: Uint8Array | number[]) {
    let bytesRead = 0;
    do {
      buf[bytesRead++] = buffer[fileOffset];
      fileOffset += 1;
    } while (fileOffset < bufferLength && bytesRead < buf.length);
    return bytesRead;
  }

  function readBufferOffset(
    buf: Uint8Array | number[],
    offset: number,
    length: number,
  ) {
    let bytesRead = 0;
    do {
      buf[offset + bytesRead] = buffer[fileOffset];
      bytesRead += 1;
      fileOffset += 1;
    } while (fileOffset < bufferLength && bytesRead < length);
    return bytesRead;
  }

  function readPixelsRaw(data: Uint8Array, offset: number, numpixels: number) {
    const numExpected = 4 * numpixels;
    let readCount = readBufferOffset(data, offset, numExpected);
    if (readCount < numExpected) {
      throw new Error(
        "Error reading raw pixels: got " +
          readCount +
          " bytes, expected " +
          numExpected,
      );
    }
  }

  while (scanlinesCount > 0) {
    if (readBuf(rgbe) < rgbe.length) {
      throw new Error("Error reading bytes: expected " + rgbe.length);
    }

    if (rgbe[0] != 2 || rgbe[1] != 2 || (rgbe[2] & 0x80) != 0) {
      //this file is not run length encoded
      data[offset + 0] = rgbe[0];
      data[offset + 1] = rgbe[1];
      data[offset + 2] = rgbe[2];
      data[offset + 3] = rgbe[3];
      offset += 4;
      readPixelsRaw(data, offset, scanlineWidth * scanlinesCount - 1);
      return;
    }

    if ((((rgbe[2] & 0xff) << 8) | (rgbe[3] & 0xff)) != scanlineWidth) {
      throw new Error(
        "Wrong scanline width " +
          (((rgbe[2] & 0xff) << 8) | (rgbe[3] & 0xff)) +
          ", expected " +
          scanlineWidth,
      );
    }

    if (scanlineBuffer == null) {
      scanlineBuffer = new Array<number>(4 * scanlineWidth);
    }

    ptr = 0;
    // Read each of the four channels for the scanline into the buffer.
    for (let i = 0; i < 4; i++) {
      ptr_end = (i + 1) * scanlineWidth;
      while (ptr < ptr_end) {
        if (readBuf(twoBytes) < twoBytes.length) {
          throw new Error("Error reading 2-byte buffer");
        }
        if ((twoBytes[0] & 0xff) > 128) {
          /* a run of the same value */
          count = (twoBytes[0] & 0xff) - 128;
          if (count == 0 || count > ptr_end - ptr) {
            throw new Error("Bad scanline data");
          }
          while (count-- > 0) {
            scanlineBuffer[ptr++] = twoBytes[1];
          }
        } else {
          /* a non-run */
          count = twoBytes[0] & 0xff;
          if (count == 0 || count > ptr_end - ptr) {
            throw new Error("Bad scanline data");
          }
          scanlineBuffer[ptr++] = twoBytes[1];
          if (--count > 0) {
            if (readBufferOffset(scanlineBuffer, ptr, count) < count) {
              throw new Error("Error reading non-run data");
            }
            ptr += count;
          }
        }
      }
    }

    for (let i = 0; i < scanlineWidth; i++) {
      data[offset + 0] = scanlineBuffer[i];
      data[offset + 1] = scanlineBuffer[i + scanlineWidth];
      data[offset + 2] = scanlineBuffer[i + 2 * scanlineWidth];
      data[offset + 3] = scanlineBuffer[i + 3 * scanlineWidth];
      offset += 4;
    }

    scanlinesCount -= 1;
  }
}
