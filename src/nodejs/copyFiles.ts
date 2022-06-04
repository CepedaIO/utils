import {basename} from "path";
import {existsSync} from "fs";
import {copyFile} from "fs/promises";

export async function copyFiles(urls: string[], dest:string) {
  return Promise.all(urls.map((url) => {
    const fileDest = `${dest}/${basename(url)}`;

    if(!existsSync(fileDest)) {
      return copyFile(url, fileDest);
    }
  }));
}