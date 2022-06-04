import { rejects } from "assert";
import {ChildProcess, spawn, SpawnOptions} from "child_process";

interface MockCLIUserOptions extends SpawnOptions {
  output?: (output: string) => void;
}

export class MockCLIUser {
  started: boolean = false;
  waitingFor?:string;
  waitingForNext: boolean;
  willSend?:string[];
  resolve?:Function;
  prompt?:string;
  sentInput: boolean = false;
  process: ChildProcess;
  timeout: number = 1000;

  constructor(
    public command: string,
    public args: string[],
    public options: MockCLIUserOptions
  ) {}

  private start() {
    this.started = true;
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'inherit'],
      shell: true,
      ...this.options
    });

    this.process.stdout.on('data', (data:Buffer) => {
      const output = data.toString('utf-8');
      if(this.options.output) {
        this.options.output(output);
      }

      if(!this.resolve) {
        return;
      }

      if(this.prompt && !this.sentInput && output.includes(this.prompt)) {
        this.sentInput = true;
        this.willSend.forEach((chunk) => this.process.stdin.write(chunk));

        if(!this.waitingFor) {
          this.resolveSend(output)
        }
      }

      if(this.waitingFor && output.includes(this.waitingFor)) {
        this.resolveSend(output);
      }

      if(this.waitingForNext) {
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
    this.waitingForNext = false;
    this.sentInput = false;
    this.prompt = null;
    this.willSend = null
  }

  setupResolution(resolve, reject, message) {
    this.resolve = resolve;

    if(!this.started) {
      this.start();
    }

    setTimeout(() => {
      if(this.resolve) {
        reject(new Error(`Waiting for timeout reached: ${message}`));
        this.clear();
      }
    }, this.timeout);
  }

  send(prompt: string, answer?:string | string[], message?:string) {
    this.prompt = prompt;
    this.waitingFor = message;

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

    return new Promise((resolve, reject) => this.setupResolution(resolve, reject, prompt));
  }

  test(tuples:Array<[string] | [string, string] | [string, string, string]>) {
    return tuples.reduce((tail, tuple) => 
      tail.then(() => this.send.apply(this, tuple))
    , Promise.resolve())
  }

  nextMessage(): Promise<string> {
    this.waitingForNext = true;
    return new Promise((resolve, reject) => this.setupResolution(resolve, reject, 'Waiting for next message'));
  }

  waitFor(prompt: string): Promise<string> {
    this.waitingFor = prompt;

    return new Promise((resolve, reject) => this.setupResolution(resolve, reject, prompt));
  }

  waitTillDone() {
    return new Promise<void>((resolve) => {
      this.process.on('exit', () => resolve());
    });
  }
}