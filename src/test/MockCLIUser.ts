import {ChildProcess, spawn, SpawnOptions} from "child_process";

export class MockCLIUser {
  waitingFor?:string;
  willSend?:string[];
  resolve?:Function;
  prompt?:string;
  sentInput: boolean = false;
  process: ChildProcess;

  constructor(
    command: string,
    args: string[],
    options: SpawnOptions
  ) {
    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'inherit'],
      ...options
    });

    this.process.stdout.on('data', (data:Buffer) => {
      if(!this.resolve) {
        return;
      }

      const output = data.toString('utf-8');
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

    return new Promise((resolve) => this.resolve = resolve);
  }

  waitFor(prompt: string): Promise<string> {
    this.waitingFor = prompt;

    return new Promise((resolve) => this.resolve = resolve);
  }

  waitTillDone() {
    return new Promise<void>((resolve) => {
      this.process.on('exit', () => resolve());
    });
  }
}