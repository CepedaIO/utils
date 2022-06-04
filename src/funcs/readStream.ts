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

export async function* readStream(stream:Readable) {
  console.log('ended:', stream.readableEnded);
  if(stream.readableEnded) {
    return;
  }

  await signalReadable(stream);

  let val;
  do {
    val = stream.read();
    if(val) {
      yield val.toString();
    }
  } while(val);

  yield * await readStream(stream);
}
