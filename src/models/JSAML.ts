import { promises } from "fs";
import * as YAML from 'yaml';

const { readFile, writeFile } = promises;

type Syntax = 'yaml' | 'json';

function isYAML(path: string) {
  return path.includes('.yaml');
}

export class JSAML<Type = JSON>  {
  constructor(
    public path: string,
    public syntax: Syntax = 'yaml'
  ) { }

  static async read<Type = JSON>(path: string, syntax: Syntax = 'yaml'): Promise<Type> {
    const data = await readFile(path, 'utf-8');
    const json = isYAML(path) ? YAML.parse(data) : JSON.parse(data);
    return json;
  }

  static async save<Type = JSON>(json: Type, path: string, syntax: Syntax = 'yaml'): Promise<string> {
    const data = isYAML(path) ? YAML.stringify(json) : JSON.stringify(json);
    await writeFile(path, data);
    return data;
  }

  read() {
    return JSAML.read(this.path, this.syntax);
  }

  save(json: Type) {
    return JSAML.save(json, this.path, this.syntax);
  }
}