import {ChildProcess, spawn, SpawnOptions} from "child_process";
import {readStream} from "../funcs/readStream";
import {Writable} from "stream";
import {Tests, TestInputs} from "../types";

export interface MockCLIUserOptions extends SpawnOptions {
  output?: (output: string) => void;
}

interface TestOptions {
  timeout?: number;
}

interface SpecController {
  resolve: Function;
  reject: Function;
  timeout: number;
  timer?: NodeJS.Timer;
  spec: Spec;
}

interface Spec {
  shouldResolve(output:string): boolean;
  afterResolve?(stdin: Writable): void;
}

interface EncounterAllSpec extends Spec {
  prompts: string[];
}

interface WaitingForSpec extends Spec {
  prompt: string;
}

interface PromptSpec extends Spec {
  prompt: string;
  willSend: string[];
}

export class MockCLIUser {
  started: boolean = false;
  exited: boolean = false;
  controller?:SpecController;
  process: ChildProcess;
  testTimer: NodeJS.Timer;
  options: MockCLIUserOptions;
  specTimeout: number = 1000;
  stdoutGen: Generator<string>;

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

  private async readStdout() {
    const result = await this.stdoutGen.next();
    const output = result.value;

    if(this.options.output) {
      this.options.output(output);
    }

    if(!this.controller.spec.shouldResolve(output)) {
      return this.readStdout();
    }

    if(this.controller.timer) {
      clearTimeout(this.controller.timer);
    }

    const controller = this.controller;
    controller.resolve(output);
    this.controller = null;

    if(controller.spec.afterResolve) {
      controller.spec.afterResolve(this.process.stdin);
    }
  }

  private start() {
    this.started = true;
    this.process = spawn(this.command, this.args, {
      stdio: 'pipe',
      shell: true,
      ...this.options
    });
    this.stdoutGen = readStream(this.process.stdout);

    this.process.on('exit', () => this.exited = true);
  }

  setupController(controller:SpecController) {
    this.controller = controller;

    if(!this.started) {
      this.start();
    }

    if(this.exited) {
      throw new Error('Process already exited, unable to queue anymore actions');
    }

    if(this.controller.timeout > 0) {
      this.controller.timer = setTimeout(() => {
        if(this.controller) {
          this.controller.reject(new Error('Waiting for timeout reached'));
          this.process.kill();
          this.controller = null;
        }
      }, this.controller.timeout);
    }

    return this.readStdout();
  }

  test(tuples:TestInputs, options: TestOptions = {}) {
    const clearTimer = () => {
      if(this.testTimer) {
        clearTimeout(this.testTimer);
      }

      this.testTimer = null;
    }

    const commands:Tests = typeof tuples === 'function' ? tuples() : tuples;
    const tail = commands.reduce((tail, tuple) =>
      tail.then(() => {
        if(typeof tuple === "string") {
          return this.waitFor(tuple);
        } else if(tuple.length === 1) {
          return this.waitFor.apply(this, tuple);
        } else if(tuple.length === 2) {
          return this.send.apply(this, tuple)
        }
      })
    , Promise.resolve())

    tail.then(() => this.waitTillDone());
    tail.finally(() => clearTimer());

    this.testTimer = setTimeout(() => {
      this.process.kill(9);
      this.controller = null;
      this.testTimer = null;
      throw new Error('Test method timeout reached');
    }, options.timeout || 120000);

    return tail;
  }

  send(prompt: string, answer:string | string[]) {
    const willSend = Array.isArray(answer) ? answer : [ answer ];

    if(answer && willSend[willSend.length - 1] !== '\x0D') {
      willSend.push('\x0D');
    }

    return new Promise((resolve, reject) =>
      this.setupController({
        resolve,
        reject,
        timeout: this.specTimeout,
        spec: {
          prompt,
          willSend,
          shouldResolve(output: string): boolean {
            return output.includes(this.prompt);
          },
          afterResolve(stdin: Writable) {
            this.willSend.forEach((chunk) => stdin.write(chunk));
          }
        } as PromptSpec,
      })
    );
  }

  encounterAll(prompts: string[]) {
    return new Promise((resolve, reject) => {
      const spec:EncounterAllSpec = {
        prompts,
        shouldResolve(output: string): boolean {
          const filteredPrompts = spec.prompts.filter((prompt) => !output.includes(prompt));

          if(filteredPrompts.length !== spec.prompts.length) {
            spec.prompts = filteredPrompts;
          }

          return spec.prompts.length === 0;
        }
      }

      return this.setupController({
        resolve,
        reject,
        timeout: this.specTimeout,
        spec
      })
    });
  }

  nextMessage(): Promise<string> {
    return new Promise((resolve, reject) => {
      const spec:WaitingForSpec = {
        prompt: '',
        shouldResolve: () => true
      };

      this.setupController({
        resolve,
        reject,
        timeout: this.specTimeout,
        spec
      });
    });
  }

  waitFor(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const spec:WaitingForSpec = {
        prompt: prompt,
        shouldResolve(output: string): boolean {
          return output.includes(spec.prompt);
        }
      }

      return this.setupController({
        resolve,
        reject,
        timeout: this.specTimeout,
        spec
      })
    });
  }

  waitTillDone() {
    if(!this.started) {
      this.start();
    }

    if(this.exited) {
      throw new Error('Process already exited, unable to queue anymore actions');
    }

    return new Promise<void>((resolve) => {
      this.process.on('exit', () => resolve());
    });
  }
}
