import {ChildProcess, spawn, SpawnOptions} from "child_process";

function isPromptSpec(obj:any): obj is PromptSpec {
  return typeof obj.prompt === 'string'
    && Array.isArray(obj.willSend);
}

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
  resolve(output:string): boolean;
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
  controller?:SpecController;
  process: ChildProcess;
  testTimer: NodeJS.Timer;
  options: MockCLIUserOptions;
  specTimeout: number = 1000;

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

      if(!this.controller) {
        return;
      }

      if(this.controller.spec.resolve(output)) {
        if(this.controller.timer) {
          clearTimeout(this.controller.timer);
        }

        this.controller.resolve(output);
        this.controller = null;
      }
    });
  }

  setupController(controller:SpecController) {
    this.controller = controller;

    if(!this.started) {
      this.start();
    }
    
    if(this.controller.timeout > 0) {
      this.controller.timer = setTimeout(() => {
        if(this.controller) {
          const error = isPromptSpec(this.controller.spec) ? `Waiting for timeout reached: ${this.controller.spec.prompt}` : 'Waiting for timeout reached';
          this.controller.reject(new Error(error));
          this.process.kill();
          this.controller = null;
        }
      }, this.controller.timeout);
    }
  }

  test(tuples:Array<
    string
    | [string]
    | [string, string | string[]]
  >, options: TestOptions = {}) {
    const clearTimer = () => {
      if(this.testTimer) {
        clearTimeout(this.testTimer);
      }

      this.testTimer = null;
    }

    const tail = tuples.reduce((tail, tuple) =>
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
      if(this.process.connected) {
        this.process.kill();
        this.controller = null;
        throw new Error('Test method timeout reached');
      }

      this.testTimer = null;
    }, options.timeout || 10000);

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
          resolve(output: string): boolean {
            console.log(output);
            console.log('prompt:', this.prompt);
            console.log(output.includes(this.prompt))
            return output.includes(this.prompt);
          }
        } as PromptSpec,
      })
    );
  }

  encounterAll(prompts: string[]) {
    return new Promise((resolve, reject) => {
      const spec:EncounterAllSpec = {
        prompts,
        resolve(output: string): boolean {
          const filteredPrompts = spec.prompts.filter((prompt) => !output.includes(prompt));

          if(filteredPrompts.length !== spec.prompts.length) {
            spec.prompts = filteredPrompts;
          }

          return spec.prompts.length === 0;
        }
      }

      this.setupController({
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
        resolve: () => true
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
        resolve(output: string): boolean {
          return output.includes(spec.prompt);
        }
      }

      this.setupController({
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

    return new Promise<void>((resolve) => {
      this.process.on('exit', () => resolve());
    });
  }
}
