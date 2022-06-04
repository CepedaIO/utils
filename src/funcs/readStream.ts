import {Readable} from "stream";

async function signalReadable(stream: Readable) {
  return new Promise(resolve => {
    stream.once("readable", resolve);
  });
}

export async function* readStream(stream:Readable) {
  if(stream.readableEnded) {
    return;
  }

  let val;
  do {
    val = stream.read();
    if(val) {
      yield val.toString();
    }
  } while(val);

  await signalReadable(stream);
  yield * readStream(stream);
}
