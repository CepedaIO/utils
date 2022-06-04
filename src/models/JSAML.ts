import { readFile, readFileSync, writeFile } from "fs";
import * as YAML from 'yaml';

type Syntax = 'yaml' | 'json';

function isYAML(path: string) {
  return path.includes('.yaml');
}

export class JSAML<Type = JSON> {
  constructor(
    public path: string,
    public syntax: Syntax = 'yaml'
  ) { }

  static async read<Type = JSON>(path: string, syntax: Syntax = 'yaml'): Promise<Type> {
    return new Promise((resolve, reject) => {
      readFile(path, 'utf-8', (err, data) => {
        if (err) return reject(err);
        const json = isYAML(path) ? YAML.parse(data) : JSON.parse(data);
        return resolve(json);
      })
    });
  }

  static async save<Type = JSON>(json: Type, path: string, syntax: Syntax = 'yaml'): Promise<string> {
    const data = isYAML(path) ? YAML.stringify(json) : JSON.stringify(json);
    return new Promise((resolve, reject) =>
      writeFile(path, data, (err) => !err ? resolve(data) : reject(err))
    );
  }

  read() {
    return JSAML.read(this.path, this.syntax);
  }

  save(json: Type) {
    return JSAML.save(json, this.path, this.syntax);
  }
}