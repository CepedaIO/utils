import {ChildProcess, spawn, SpawnOptions} from "child_process";

export interface MockCLIUserOptions extends SpawnOptions {
  output?: (output: string) => void;
}

export class MockCLIUser {
  started: boolean = false;
  waitingFor?:string;
  waitingForNext: boolean;
  willSend?:string[];
  resolve?: Function;
  reject?: Function;
  prompt?:string;
  sentInput: boolean = false;
  process: ChildProcess;
  timeout: number = 1000;
  timer: NodeJS.Timer;
  options: MockCLIUserOptions;

  constructor(
    public command: string,
    public args: string[],
    _options: MockCLIUserOptions | string
  ) {
    if(typeof _options === "string") {
      this.options = {
        cwd: _options
      };
    } else {
      this.options = _options;
    }
  }

  private start() {
    this.started = true;
    this.process = spawn(this.command, this.args, {
      stdio: 'pipe',
      shell: true,
      ...this.options
    });

    this.process.stderr.on('data', (data:Buffer) => {
      const output = data.toString('utf-8');
      if(this.options.output) {
        this.options.output(output);
      }
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
    const resolve = this.resolve;
    this.clear();
    resolve(output);
  }

  private clear() {
    if(this.timer) {
      clearTimeout(this.timer);
    }

    this.resolve = null;
    this.reject = null;
    this.waitingFor = null;
    this.waitingForNext = false;
    this.sentInput = false;
    this.prompt = null;
    this.willSend = null
    this.timer = null;
  }

  setupResolution(resolve, reject, message) {
    this.resolve = resolve;
    this.reject = reject;

    if(!this.started) {
      this.start();
    }

    if(this.timeout > 0) {
      this.timer = setTimeout(() => {
        if(this.reject) {
          const error = message ? `Waiting for timeout reached: ${message}` : 'Waiting for timeout reached';
          this.reject(new Error(error));

          this.process.kill();
          this.clear();
        }
      }, this.timeout);
    }
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

    if(answer && this.willSend[this.willSend.length - 1] !== '\x0D') {
      this.willSend.push('\x0D');
    }

    return new Promise((resolve, reject) => this.setupResolution(resolve, reject, prompt));
  }

  test(tuples:Array<[string] | [string, string | string[]] | [string, string | string[], string]>) {
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
    if(!this.started) {
      this.start();
    }

    return new Promise<void>((resolve) => {
      this.process.on('exit', () => resolve());
    });
  }
}
