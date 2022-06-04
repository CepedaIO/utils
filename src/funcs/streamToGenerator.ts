import {Readable} from "stream";

async function signalEnd(stream: Readable) {
  return new Promise(resolve => {
    stream.once("end", resolve);
  });
}

async function signalReadable(stream: Readable) {
  return new Promise(resolve => {
    stream.once("readable", resolve);
  });
}

export async function* streamToGenerator(stream: Readable, encoding: BufferEncoding = 'utf-8') {
  stream.setEncoding(encoding);
  const endPromise = signalEnd(stream);

  while(!stream.readableEnded) {
    while(stream.readable) {
      const val = stream.read();
      if(val) yield val;
      break;
    }

    const readablePromise = signalReadable(stream);
    await Promise.race([endPromise, readablePromise]);
  }
}
