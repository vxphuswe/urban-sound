// AudioWorklet: gom mẫu micro thành khối 2048 mẫu rồi gửi về luồng chính.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(2048);
    this.i = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (input && input.length) {
      const chs = input.length;
      const len = input[0].length;
      for (let k = 0; k < len; k++) {
        let v = 0;
        for (let c = 0; c < chs; c++) v += input[c][k];
        this.buf[this.i++] = v / chs;
        if (this.i === this.buf.length) {
          this.port.postMessage(this.buf.slice());
          this.i = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);
