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
      /**
       * TODO: I don't think I can assume that all chunks will end in a new line. Should check to make sure I consume everything correctly
       */
      const valStr = val.toString();
      const lines = valStr.split('\n');
      for(const line of lines) {
        yield line;
      }
    }
  } while(val);

  await signalReadable(stream);
  yield * readStream(stream);
}
