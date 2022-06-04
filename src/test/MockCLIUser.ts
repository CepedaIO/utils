import { rejects } from "assert";
import {ChildProcess, spawn, SpawnOptions} from "child_process";

interface MockCLIUserOptions extends SpawnOptions {
  output?: (output: string) => void;
}

export class MockCLIUser {
  waitingFor?:string;
  willSend?:string[];
  resolve?:Function;
  prompt?:string;
  sentInput: boolean = false;
  process: ChildProcess;
  timeout: number = 1000;

  constructor(
    command: string,
    args: string[],
    options: MockCLIUserOptions
  ) {
    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'inherit'],
      shell: true,
      ...options
    });

    this.process.stdout.on('data', (data:Buffer) => {
      if(!this.resolve) {
        return;
      }

      const output = data.toString('utf-8');
      if(options.output) {
        options.output(output);
      }

      if(!this.sentInput && output.includes(this.prompt)) {
        this.sentInput = true;
        this.willSend.forEach((chunk) => this.process.stdin.write(chunk));

        if(!this.waitingFor) {
          this.resolveSend(output)
        }
      }

      if(this.waitingFor && output.includes(this.waitingFor)) {
        this.resolveSend(output);
      }
    });
  }

  private resolveSend(output: string) {
    this.resolve(output);
    this.clear()
  }

  private clear() {
    this.resolve = null;
    this.waitingFor = null;
    this.sentInput = false;
    this.prompt = null;
    this.willSend = null
  }

  private setWillSend(answer?:string | string[]) {
    if(Array.isArray(answer)) {
      this.willSend = answer;
    } else if(typeof answer === 'string') {
      this.willSend = [answer];
    } else {
      this.willSend = [];
    }

    if(this.willSend[this.willSend.length - 1] !== '\x0D') {
      this.willSend.push('\x0D');
    }
  }

  send(prompt: string, answer?:string | string[], message?:string) {
    this.prompt = prompt;
    this.waitingFor = message;

    this.setWillSend(answer);

    return new Promise((resolve, reject) => {
      this.resolve = resolve;

      setTimeout(() => {
        if(this.resolve) {
          reject(new Error(`Waiting for timeout reached for: ${prompt}`));
          this.clear();
        }
      }, this.timeout);
    });
  }

  test(tuples:Array<[string] | [string, string] | [string, string, string]>) {
    return tuples.reduce((tail, tuple) => 
      tail.then(() => this.send.apply(this, tuple))
    , Promise.resolve())
  }

  waitFor(prompt: string): Promise<string> {
    this.waitingFor = prompt;

    return new Promise((resolve, reject) => {
      this.resolve = resolve

      setTimeout(() => {
        if(this.resolve) {
          reject(new Error(`Waiting for timeout reached for: ${prompt}`));
          this.clear();
        }
      }, this.timeout);
    });
  }

  waitTillDone() {
    return new Promise<void>((resolve) => {
      this.process.on('exit', () => resolve());
    });
  }
}